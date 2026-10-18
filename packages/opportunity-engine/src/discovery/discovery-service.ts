import {
  DiscoveryFeedItemDTO,
  DiscoveryFeedResponseDTO,
  MarketSignalFeedItemDTO,
  ResearchLeadFeedItemDTO,
} from "@buildworth/shared";
import { logger } from "@buildworth/observability";

export interface GetDiscoveryFeedOptions {
  limit?: number;
  market?: string;
  maxItemsPerSource?: number;
  signalsLimit?: number;
  researchLeadsLimit?: number;
}

/**
 * Derives a human-readable geographic market from source signals or vertical
 */
export function deriveMarketRegion(sourceKey?: string, sourceFamily?: string, industry?: string): string {
  if (sourceKey === "krasia" || sourceKey === "e27") {
    return "Asia / Pan-Asia";
  }
  if (sourceKey === "eustartups" || sourceKey === "siliconcanals" || sourceKey === "ted") {
    return "Europe";
  }
  if (sourceKey === "lobsters" || sourceKey === "github" || sourceKey === "stackexchange") {
    return "Global / Developer Ecosystem";
  }
  if (sourceKey === "samgov") {
    return "United States / Federal";
  }
  if (sourceKey === "cisakev") {
    return "Global / Cybersecurity";
  }
  if (sourceKey === "arxiv") {
    return "Global / Scientific & DeepTech";
  }
  if (sourceKey === "techcrunch") {
    return "North America & Global";
  }
  if (sourceKey === "hackernews" || sourceKey === "reddit") {
    return "Global / North America & Europe";
  }
  if (sourceFamily === "DISCOVERY") {
    return "Global Emerging Markets";
  }
  if (industry && industry.includes("Asia")) {
    return "Asia / Pan-Asia";
  }
  return "Global / Remote";
}

/**
 * Checks whether a signal describes a concrete user/operational problem or workaround,
 * as opposed to an academic paper, project launch, general discussion, or technical question.
 */
export function isConcreteProblemOrWorkaround(signal: {
  title?: string | null;
  sanitizedExcerpt?: string | null;
  problemSummary?: string | null;
  signalType?: string | null;
  canonicalUrl?: string | null;
  sourceKey?: string | null;
  sourceFamily?: string | null;
}): boolean {
  const title = (signal.title || "").trim();
  const excerpt = (signal.sanitizedExcerpt || "").trim();
  const summary = (signal.problemSummary || "").trim();
  const fullText = `${title} ${excerpt} ${summary}`.toLowerCase();
  const url = (signal.canonicalUrl || "").toLowerCase();
  const srcKey = (signal.sourceKey || "").toLowerCase();
  const sigType = (signal.signalType || "").toUpperCase();

  // 1. Strict Exclusions: Research papers, academic articles, books, journals
  if (
    srcKey === "arxiv" ||
    url.includes("arxiv.org") ||
    url.includes("onlinelibrary.wiley.com") ||
    url.includes("doi.org") ||
    url.includes("sciencedirect.com") ||
    url.includes("springer.com") ||
    url.includes("nature.com") ||
    /\b(arxiv|preprint|doi:|journal article|working paper|dissertation|literature review)\b/i.test(fullText)
  ) {
    return false;
  }

  // 2. Strict Exclusions: Product/Project/Release/Announcement launches
  // e.g. "MountX: A self-hosted dynamic language compiling to C99", "Show HN: ...", "Announcing v1.0", "Release v2.0"
  if (
    /^(show hn:|announcing|introducing|launching|released|release v\d|meet [a-z0-9_-]+:)\b/i.test(title) ||
    /^[a-z0-9_.-]+:\s*(a|an|the|open-source|fast|lightweight|modern|self-hosted|next-gen|tiny|simple)\s+/i.test(title)
  ) {
    return false;
  }

  // 3. Strict Exclusions: Generic developer questions / Q&A / advice seeking / opinion essays / meta-critiques
  // e.g. "Why does adding local size improve performance in OpenCL?", "How to do X in Y", "Are Harnesses Worth the Cost?"
  const isGenuineProblemInquiry =
    /\b(manual reconciliation|workaround|hacky workaround|bottleneck|production outage|memory leak|cost spike|bill spike|spiked|oom|oomkilled|crashloopbackoff|state lock|prompt regression|evaluation framework|benchmark|willing to pay|looking for a paid|looking for an alternative|recurring delays)\b/i.test(fullText);

  if (
    !isGenuineProblemInquiry &&
    (/^(why does|why is|why did|why do|why would|how to|how do i|how can i|what is the best way to|optimal way to|is there a way to|are .* worth the cost|is .* worth it)\b/i.test(title) ||
      title.endsWith("?") ||
      /^\[advice\]/i.test(title) ||
      /^\[question\]/i.test(title) ||
      /^\[css,|^\[html,|^\[c#,|^\[java,|^\[python,/i.test(title))
  ) {
    return false;
  }

  // 3b. Strict Exclusions: Meta-critiques or vague summaries emitted instead of concrete problems
  if (
    /\b(vague question about|unclear question|no specific problem|without industry context|opinion essay|thought piece)\b/i.test(fullText)
  ) {
    return false;
  }

  // 4. Strict Exclusions: Generic feature requests, AI coding agent tasks, or routine backlog tasks without clear user friction
  // e.g. "EP-13: 18 eBay flag markets...", "Daily ingest: review needed...", "ready-for-agent", "Parent: #308"
  if (
    /\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|auto-research loop)\b/i.test(fullText)
  ) {
    return false;
  }

  if (
    /^(ep-\d+|feat:|feature:|task:|chore:|refactor:|daily ingest:|sprint \d+)/i.test(title) &&
    !/\b(broken|breaks|fails|failing|error|leak|spike|latency|outage|unusable|crash|crashing)\b/i.test(fullText)
  ) {
    return false;
  }

  // 5. Strict Exclusions: Repository documentation, translation, typo fixes, markdown changes
  // e.g. "docs: write the project skills in English", "Update current state in readme", "translate documentation"
  if (
    /^(docs?|documentation|readme|translation|translate)\b/i.test(title) ||
    /^(fix|update|add|write)\s+(the\s+|current\s+state\s+in\s+)?(docs?|documentation|readme|skills?\s+in\s+english)\b/i.test(title) ||
    /\b(project skills under \.agents|write .* in english|typo in docs|fix markdown|update readme\.md|update current state in readme|in readme\b)\b/i.test(fullText)
  ) {
    return false;
  }

  // 6. Strict Exclusions: Generic news reporting on isolated physical incidents, automotive/mechanical defects
  // without software tooling, SaaS, or developer workflow demand.
  // e.g. "Maextro’s broken brake pedals put luxury car safety under scrutiny", vehicle recalls, car crashes
  if (
    /\b(brake pedal|brake pedals|luxury car|car safety|vehicle safety|automotive recall|traffic accident|plane crash|airbag defect|chassis crack)\b/i.test(fullText)
  ) {
    return false;
  }

  // 7. Strict Exclusions: CVEs, security vulnerability advisories, KEV bulletins
  // e.g. "CVE-2026-0322: Palo Alto Networks PAN-OS...", "CVE-2026-105133: Ahsay..."
  // cannot be treated as user workflow pain unless they describe actual production friction, outage, or manual recovery
  const isCveAdvisory =
    srcKey === "cisakev" ||
    url.includes("cve.org") ||
    url.includes("nvd.nist.gov") ||
    /^cve-\d+/i.test(title) ||
    /\b(cve-\d{4}-\d+)\b/i.test(fullText);

  if (isCveAdvisory) {
    if (!/\b(broken in production|production outage|manual recovery|data corruption|data loss|workaround|hacky workaround)\b/i.test(fullText)) {
      return false;
    }
  }

  // 8. Strict Exclusions: Generic news reporting, venture deals, funding rounds, corporate PR
  // e.g. "Deals in brief: NEU Battery Materials...", "Pony.ai and Uber plan to roll out...", "Gartner: 80% of Neocloud..."
  const isGenericNewsOrDeals =
    srcKey === "krasia" ||
    /^(deals in brief|funding alert|raises \$|secures series|plans to roll out|gartner:)\b/i.test(title) ||
    /\b(raises \$|secures series|series [a-z] funding|venture capital|funding round|private equity)\b/i.test(fullText);

  if (isGenericNewsOrDeals) {
    if (!/\b(broken in production|production outage|manual recovery|workaround|cost spike|data leak)\b/i.test(fullText)) {
      return false;
    }
  }

  // 9. Strict Exclusions: Isolated compiler, linker, syntax errors, and language-specific typos/toy errors
  // without broader workflow friction, tooling demand, or production impact.
  // e.g. "error: braces around scalar initializer for type...", "undefined reference to...", "syntax error: unexpected token"
  const isCompilerOrSyntaxTypo =
    /\b(scalar initializer for type|braces around scalar initializer|undefined reference to|cannot convert ['"].*['"] to|no matching function for call to|template argument deduction\/substitution failed|conflicting types for|stray ['"]?\\['"]? in program|expected [a-z0-9_<>]+ before|invalid conversion from|cannot find module .* or its corresponding type declarations|unhandled recheck error|syntaxerror:|typeerror: .* is not a function|nullpointerexception|attributeerror: '.*' object has no attribute|nameerror: name '.*' is not defined|indexoutofboundsexception|referenceerror: .* is not defined)\b/i.test(fullText);

  if (isCompilerOrSyntaxTypo) {
    if (!/\b(production outage|cluster failure|downtime|cost spike|data loss|data corruption|affects all teams|across multiple repositories)\b/i.test(fullText)) {
      return false;
    }
  }

  // 10. Strict Exclusions: Isolated internal API / library status codes lacking systemic operational context
  // e.g. "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error"
  const isIsolatedInternalCode =
    /\b(code 13 internal error|status code \d{3} in my test|causes a code \d+ internal error|returns code \d+ internal)\b/i.test(fullText) ||
    /causes a code \d+ internal error/i.test(title);

  if (isIsolatedInternalCode) {
    if (!/\b(production outage|downtime|cost spike|data loss|workaround|hacky workaround|manual fix)\b/i.test(fullText)) {
      return false;
    }
  }

  // 11. Strict Exclusions: Beginner styling, spreadsheet quirks, or toy script questions
  // e.g. "Similar Link Between Excel Files Update When Not Asked", "How do I fix an image repeating in background"
  if (
    /\b(similar link between excel files|fix an image ["']?repeating["']?|center a div|background of a html website)\b/i.test(fullText) ||
    /^(how do i fix|how to fix|center a div|repeating in the background)\b/i.test(title)
  ) {
    return false;
  }

  // 12. Explicit concrete friction / breakdown / workaround / cost pain indicators
  // The excerpt or title must describe actual failure, broken functionality, error, or manual hack
  const hasConcreteBreakdown =
    /\b(broken|breaks|breaks silently|failing|fails|fails to|failed|crash|crashes|crashloopbackoff|oom|oomkilled|oom-killed|out of memory|leak|leaks|silent failure|data corruption|permanently reports|cannot decode|unable to parse|sensor decoding error|outage|downtime|deadlock|deadlocks|throttled|timeout|workaround|hacky workaround|manual fix|manual reconciliation|costing|ruined|waste|wasted|unexpected spend|bill spike|bill spikes|spiked|billing surprises?|delays?|drift|lags?|state lock|locking failure|prompt regression|regression|degradation|hallucinat|building a proxy|manual proxy|spent (days|hours|weeks))\b/i.test(fullText);

  // High quality problem types from GitHub / StackOverflow / HN or unclassified signals with problem keywords
  const isProblemType = [
    "PAIN",
    "PAIN_COMPLAINT",
    "PROBLEM_STATEMENT",
    "WORKAROUND",
    "WORKAROUND_REQUEST",
    "COMPETITOR_COMPLAINT",
    "COMPETITOR_DISSATISFACTION",
    "",
    "UNCLASSIFIED",
  ].includes(sigType);

  return hasConcreteBreakdown || (isProblemType && /\b(error|bug|issue|failure|broken|problem|bottleneck|friction|pain|cost|spend|waste|latency|spikes?|spiked|deadlock|deadlocks|downtime|delay|delays|drift|oom|oomkilled|lock|locking|regression|evaluat|benchmark)\b/i.test(fullText));
}

/**
 * Derives a specific, evidence-backed target audience from the problem description
 * instead of generic fallback boilerplate.
 */
export function deriveSpecificAudience(text: string, actorRole?: string | null): string {
  if (
    actorRole &&
    actorRole.trim() &&
    !/early adopter|user|team|founder|consumer|individual|orchestrator|agent|bot|worker|runner|subagent/i.test(actorRole)
  ) {
    return actorRole.trim();
  }

  const lower = text.toLowerCase();
  if (lower.includes("iot") || lower.includes("rotex") || lower.includes("hpsu") || lower.includes("sensor") || lower.includes("uart") || lower.includes("esphome") || lower.includes("firmware")) {
    return "IoT & Smart HVAC Firmware Engineers";
  }
  if (lower.includes("kafka") || lower.includes("consumer lag") || lower.includes("partition")) {
    return "Distributed Systems & Streaming Infrastructure Engineers";
  }
  if (lower.includes("gpu") || lower.includes("h100") || lower.includes("cuda") || lower.includes("cluster cost")) {
    return "ML Platform & Cloud Infrastructure Teams";
  }
  if (lower.includes("database") || lower.includes("postgres") || lower.includes("mysql") || lower.includes("query timeout")) {
    return "Database Administrators & Backend Leads";
  }
  if (
    lower.includes("kubernetes") ||
    lower.includes("k8s") ||
    lower.includes("pod") ||
    lower.includes("ingress") ||
    lower.includes("container") ||
    lower.includes("oom") ||
    lower.includes("oom-killed") ||
    lower.includes("memory leak") ||
    (lower.includes("production") && /\b(outage|crash|crashes|freeze|freezes|dies?|kill|killed|leaks?)\b/i.test(lower))
  ) {
    return "Platform Engineering & Site Reliability Teams";
  }
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cve") || lower.includes("exploit")) {
    return "Security Operations & AppSec Engineers";
  }
  if (
    lower.includes("ci/cd") ||
    lower.includes("github actions") ||
    lower.includes("pipeline") ||
    lower.includes("docker") ||
    lower.includes("workflow")
  ) {
    return "DevOps & Release Engineering Teams";
  }
  if (lower.includes("cloud") || lower.includes("aws") || lower.includes("latency") || lower.includes("network") || lower.includes("cross-cloud") || lower.includes("infrastructure")) {
    return "Cloud Infrastructure & Network Engineering Teams";
  }
  if (lower.includes("frontend") || lower.includes("react") || lower.includes("next.js") || lower.includes("css") || lower.includes("web")) {
    return "Frontend & Web Application Engineering Teams";
  }
  if (lower.includes("api") || lower.includes("backend") || lower.includes("microservice") || lower.includes("grpc")) {
    return "Backend Systems & API Engineering Teams";
  }
  if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("flutter")) {
    return "Mobile Application Engineering Teams";
  }
  if (lower.includes("ecommerce") || lower.includes("e-commerce") || lower.includes("shopify") || lower.includes("marketplace")) {
    return "E-Commerce Technical Operations Teams";
  }
  if (lower.includes("hardware") || lower.includes("embedded") || lower.includes("firmware")) {
    return "Embedded Systems & Hardware Engineering Teams";
  }
  if (
    lower.includes("visual studio") ||
    lower.includes("vsix") ||
    /\b(compiler (toolchain|infrastructure|architecture|plugin|backend|frontend)|llvm|clang|tree-sitter|language server|custom compiler)\b/i.test(lower) ||
    lower.includes("ide plugin") ||
    lower.includes("extension") ||
    lower.includes("sdk")
  ) {
    return "Software Tooling & Systems Developers";
  }
  if (lower.includes("linux") || lower.includes("sysadmin") || lower.includes("storage") || lower.includes("server") || lower.includes("kernel")) {
    return "IT Systems & Infrastructure Administrators";
  }
  if (lower.includes("compliance") || lower.includes("audit") || lower.includes("soc2") || lower.includes("gdpr") || lower.includes("governance")) {
    return "Governance & Compliance Engineering Leads";
  }
  if (lower.includes("payment") || lower.includes("billing") || lower.includes("stripe") || lower.includes("invoice") || lower.includes("fintech")) {
    return "FinTech & Payment Engineering Teams";
  }
  if (
    lower.includes("developer") ||
    lower.includes("dev ") ||
    lower.includes("engineering") ||
    lower.includes("engineer") ||
    lower.includes("software") ||
    lower.includes("code") ||
    lower.includes("hn ") ||
    lower.includes("article problem") ||
    lower.includes("european")
  ) {
    return "Software Engineering & Technical Leads";
  }

  return "Unknown (Requires customer validation)";
}

/**
 * Derives a distinct, plausible product concept addressing the specific technical friction,
 * avoiding vague or repetitive "Targeted solution addressing: [title]" templates.
 */
export function derivePlausibleProductDirection(problemSummary: string, targetAudience: string): string {
  const lower = problemSummary.toLowerCase();

  if (lower.includes("protocol") || lower.includes("decoding") || lower.includes("uart") || lower.includes("rotex") || lower.includes("hpsu") || lower.includes("sensor") || lower.includes("firmware")) {
    return "Diagnostic serial bridge & protocol adapter CLI with automated frame parsing for legacy HVAC and sensor buses";
  }
  if (lower.includes("kafka") || lower.includes("lag") || lower.includes("partition")) {
    return "Predictive consumer lag alert engine with partition rebalance simulator and automated offset recovery";
  }
  if (lower.includes("gpu") || lower.includes("cuda") || lower.includes("h100") || lower.includes("cluster cost")) {
    return "Kubernetes node auto-reaper and GPU idle spend watchdog with automated eviction of dangling training jobs";
  }
  if (lower.includes("database") || lower.includes("postgres") || lower.includes("mysql") || lower.includes("query timeout")) {
    return "Slow-query regression analyzer with automated execution plan diffing and proactive indexing recommendations";
  }
  if (lower.includes("kubernetes") || lower.includes("k8s") || lower.includes("pod") || lower.includes("ingress")) {
    return "Automated ingress traffic triage & pod eviction root-cause visualizer for production clusters";
  }
  if (lower.includes("container") || lower.includes("oom") || lower.includes("memory leak") || lower.includes("freezes")) {
    return "Automated container memory profiling & leak watchdog with proactive session eviction for production workloads";
  }
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cve")) {
    return "Continuous runtime vulnerability reachability analyzer with automated PR patch generation";
  }

  const cleanProblem = problemSummary.replace(/^[a-z]+:\s*/i, "").replace(/[.!?]+$/, "").trim();
  if (targetAudience && !targetAudience.startsWith("Unknown")) {
    return `Specialized workflow automation tool eliminating manual workarounds for ${targetAudience}: ${cleanProblem}`;
  }
  return `Specialized workflow automation tool eliminating manual workarounds for ${cleanProblem}`;
}

/**
 * Derives a problem-specific validation experiment based on the nature of the identified friction.
 */
export function deriveSpecificValidationExperiment(problemSummary: string, targetAudience: string): string {
  const lower = problemSummary.toLowerCase();

  if (lower.includes("protocol") || lower.includes("decoding") || lower.includes("sensor") || lower.includes("uart") || lower.includes("hvac")) {
    return "Deploy packet-sniffing decoder prototype against 3 real hardware installations to verify protocol compatibility";
  }
  if (lower.includes("kafka") || lower.includes("lag") || lower.includes("streaming")) {
    return "Run synthetic rebalance benchmark simulating consumer lag threshold alerts with 5 data platform engineers";
  }
  if (lower.includes("gpu") || lower.includes("cost") || lower.includes("cloud")) {
    return "Audit idle cluster teardown logs with 5 ML platform teams to quantify monthly spend reclaim potential";
  }
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cve")) {
    return "Scan 10 production staging clusters to measure exposure window and test automated mitigation rules";
  }
  if (lower.includes("container") || lower.includes("oom") || lower.includes("memory leak") || lower.includes("freeze")) {
    return "Profile container heap dumps across 5 production deployments to benchmark memory leak trajectory and automated restart efficacy";
  }

  if (targetAudience && !targetAudience.startsWith("Unknown")) {
    return `Interview 5 ${targetAudience} to benchmark frequency of this breakdown and quantify hours spent on manual recovery`;
  }

  return "Conduct discovery interviews with affected users to validate workaround frequency and operational cost";
}

/**
 * Derives concrete, honest evidence gaps for a research lead, ensuring users know
 * precisely what validation is missing before this could become a real business opportunity.
 * Avoids inventing demand, buyers, or willingness to pay.
 */
export function deriveEvidenceGaps(
  problemSummary?: string,
  likelyAffectedUsers?: string,
  hasIndependentCorroboration = false,
  hasExplicitPurchaseIntent = false,
): string[] {
  const gaps: string[] = [];

  if (!hasIndependentCorroboration) {
    gaps.push("Single-source observation: lacks corroboration from independent sources or unrelated engineering teams");
  }

  if (!hasExplicitPurchaseIntent) {
    gaps.push("Commercial willingness to pay is unverified: no explicit pricing signals, budgets, or purchasing commitments observed");
  }

  const audienceLabel = likelyAffectedUsers && !likelyAffectedUsers.startsWith("Unknown")
    ? `across ${likelyAffectedUsers}`
    : "across organizations";
  gaps.push(`Recurrence ${audienceLabel} is unproven: operational friction may be isolated to this specific setup or edge-case configuration`);

  const problemContext = problemSummary ? `for ${problemSummary.toLowerCase().slice(0, 45)}` : "";
  gaps.push(`Workaround stickiness unknown: unverified whether affected users will adopt a dedicated product ${problemContext} versus continuing with manual fixes or internal scripts`);

  return gaps;
}

/**
 * Derives an authentic human B2B economic buyer with budget authority.
 * Strictly avoids generic fictitious suffixes like "Consumer Leadership" or "Orchestrator Leadership".
 */
export function deriveEconomicBuyerRole(audience: string, vertical?: string): string {
  const lower = `${audience} ${vertical || ""}`.toLowerCase();
  if (lower.includes("security") || lower.includes("compliance") || lower.includes("cve") || lower.includes("vulnerability") || lower.includes("appsec")) {
    return "Chief Information Security Officer (CISO) or Head of Security";
  }
  if (lower.includes("devops") || lower.includes("ci/cd") || lower.includes("release") || lower.includes("pipeline") || lower.includes("docker") || lower.includes("workflow")) {
    return "VP of Engineering or Head of DevOps";
  }
  if (lower.includes("data") || lower.includes("database") || lower.includes("streaming") || lower.includes("kafka") || lower.includes("postgres") || lower.includes("finops")) {
    return "Head of Data Platform or VP of Engineering";
  }
  if (lower.includes("cloud") || lower.includes("infrastructure") || lower.includes("kubernetes") || lower.includes("platform") || lower.includes("sre")) {
    return "Director of Infrastructure or Head of Platform Engineering";
  }
  if (lower.includes("firmware") || lower.includes("hardware") || lower.includes("iot") || lower.includes("embedded")) {
    return "VP of Hardware Engineering or Head of Embedded Systems";
  }
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("prompt") || lower.includes("eval") || lower.includes("model")) {
    return "Head of AI or VP of Engineering";
  }
  if (lower.includes("frontend") || lower.includes("web") || lower.includes("mobile")) {
    return "VP of Product Engineering or Head of Frontend";
  }
  return "VP of Engineering or Technical Operations Director";
}

/**
 * Derives the specific practitioner user affected by the technical bottleneck.
 */
export function deriveEndUserRole(audience: string, actorRole?: string | null): string {
  if (actorRole && !/orchestrator|agent|bot|worker|runner|consumer|user|team|founder|leadership/i.test(actorRole)) {
    return actorRole.trim();
  }
  const lower = audience.toLowerCase();
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("prompt") || lower.includes("eval")) {
    return "AI / Prompt Engineer or Applied LLM Developer";
  }
  if (lower.includes("devops") || lower.includes("release") || lower.includes("ci/cd")) {
    return "Senior DevOps / Release Engineer";
  }
  if (lower.includes("security") || lower.includes("compliance")) {
    return "Security Engineer / AppSec Specialist";
  }
  if (lower.includes("data") || lower.includes("database") || lower.includes("streaming")) {
    return "Senior Data / Distributed Systems Engineer";
  }
  if (lower.includes("cloud") || lower.includes("platform") || lower.includes("kubernetes")) {
    return "Site Reliability Engineer (SRE) / Platform Engineer";
  }
  if (lower.includes("firmware") || lower.includes("iot") || lower.includes("embedded")) {
    return "Embedded Systems / Firmware Engineer";
  }
  return "Senior Software Engineer";
}

export interface SolutionFeasibilityAssessment {
  isFeasible: boolean;
  blockReason?: string;
}

/**
 * Assesses whether an independent software product/service can technically and commercially
 * resolve the observed problem without requiring proprietary vendor platform access or bypasses.
 */
export function evaluateSolutionFeasibility(
  problemSummary: string,
  fullText: string = ""
): SolutionFeasibilityAssessment {
  const lower = `${problemSummary} ${fullText}`.toLowerCase();

  // Closed proprietary platform authentication & recovery (e.g. Apple ID recovery):
  if (
    lower.includes("apple id") ||
    lower.includes("apple account") ||
    lower.includes("icloud lock") ||
    lower.includes("activation lock") ||
    (lower.includes("apple") && lower.includes("account recovery")) ||
    (lower.includes("google") && lower.includes("account disabled"))
  ) {
    return {
      isFeasible: false,
      blockReason: "Solution involves closed, proprietary platform account recovery gated on vendor authentication servers with no 3rd-party API or automation interface.",
    };
  }

  // Macro-industry news, trade policy, geopolitics without software workflow:
  if (
    lower.includes("push for domestic") ||
    lower.includes("international competition") ||
    lower.includes("technology safety concerns") ||
    lower.includes("semiconductor sanctions") ||
    lower.includes("export controls") ||
    lower.includes("geopolitical")
  ) {
    return {
      isFeasible: false,
      blockReason: "Macro-industry trend or geopolitical trade development without a concrete customer software workflow or complaint.",
    };
  }

  return { isFeasible: true };
}

/**
 * Identifies whether an issue is an internal bug/chore inside a single repository
 * that requires multi-organization corroboration before presenting a broader business opportunity.
 */
export function isSingleRepoTicket(url?: string, problemText?: string): boolean {
  if (url && /github\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+/i.test(url)) {
    return true;
  }
  const lower = (problemText || "").toLowerCase();
  return (
    lower.includes("agents/") ||
    lower.includes(".md") ||
    lower.includes("workflow-gap in agents") ||
    lower.includes("harness-feedback") ||
    /github\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+/i.test(lower)
  );
}

/**
 * Identifies whether a signal is a product announcement, launch notice, or tool demonstration
 * by its maker/author.
 * A product announcement can establish an existing alternative, but customer pain and demand require separate evidence.
 */
export function isProductAnnouncement(
  title?: string,
  text?: string,
  url?: string,
  sourceKey?: string,
): boolean {
  const t = (title || "").trim();
  const lowerTitle = t.toLowerCase();
  const lowerText = (text || "").toLowerCase();
  const lowerUrl = (url || "").toLowerCase();
  const sKey = (sourceKey || "").toLowerCase();

  if (sKey === "producthunt" || lowerUrl.includes("producthunt.com") || lowerUrl.includes("/releases/tag/") || lowerUrl.includes("/releases")) return true;

  // Hacker News maker announcements
  if (/\b(show hn|launch hn)\b/i.test(t) || lowerTitle.startsWith("show hn:") || lowerTitle.startsWith("launch hn:")) {
    return true;
  }
  if (/\b(show hn|launch hn)\b/i.test(lowerText) || lowerText.startsWith("show hn:") || lowerText.startsWith("launch hn:")) {
    return true;
  }

  // Maker self-announcements across other tech communities
  if (
    /^(introducing|announcing|release:|v\d+\.\d+|launching)\b/i.test(t) ||
    /\b(an independent execution recorder for|i built an open source|we built an open source|i built a tool|we are launching|show hn)\b/i.test(lowerTitle) ||
    /\b(i gave access to my coding agent to do work on my repos|so i manually checked each transcript)\b/i.test(lowerText)
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a normalized author or organization identifier from a signal.
 */
export function extractAuthorOrRepoIdentifier(url?: string, authorFingerprint?: string): string {
  if (authorFingerprint && authorFingerprint.trim() && !["unknown", "public_user"].includes(authorFingerprint.trim().toLowerCase())) {
    return authorFingerprint.trim().toLowerCase();
  }
  if (url) {
    const gh = url.match(/github\.com\/([^/]+)/i);
    if (gh && gh[1]) return `gh-org:${gh[1].toLowerCase()}`;
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {}
  }
  return "unknown-author";
}

/**
 * Checks whether a candidate signal is from the same product author or organization as the primary signal.
 */
export function isAuthorSelfClaim(
  retrieved: { url?: string; authorFingerprint?: string; title?: string },
  primary: { url?: string; authorFingerprint?: string; title?: string },
): boolean {
  const pAuthor = extractAuthorOrRepoIdentifier(primary.url, primary.authorFingerprint);
  const rAuthor = extractAuthorOrRepoIdentifier(retrieved.url, retrieved.authorFingerprint);
  if (pAuthor !== "unknown-author" && rAuthor !== "unknown-author" && pAuthor === rAuthor) {
    return true;
  }
  if (primary.url && retrieved.url) {
    const pGh = primary.url.match(/github\.com\/([^/]+\/[^/]+)/i);
    const rGh = retrieved.url.match(/github\.com\/([^/]+\/[^/]+)/i);
    if (pGh && rGh && pGh[1] && rGh[1] && pGh[1].toLowerCase() === rGh[1].toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether two signals represent syndicated re-publications of the same content.
 */
export function isSyndicatedCopy(
  url1?: string,
  url2?: string,
  content1?: string,
  content2?: string,
): boolean {
  if (url1 && url2) {
    const u1 = url1.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    const u2 = url2.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (u1 === u2) return true;
  }
  if (content1 && content2) {
    const clean1 = content1.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const clean2 = content2.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    if (clean1.length > 50 && clean2.length > 50) {
      if (clean1.includes(clean2.substring(0, 50)) || clean2.includes(clean1.substring(0, 50))) {
        return true;
      }
    }
  }
  return false;
}

export interface CorroborationEvaluationResult {
  isIndependent: boolean;
  relationshipType: "SUPPORTS" | "CONTRADICTS" | "IRRELEVANT";
  rejectReason?: "AUTHOR_CLAIM" | "SYNDICATED_COPY" | "KEYWORD_OVERLAP_ONLY" | "NOT_CONCRETE_PROBLEM" | "SAME_ORGANIZATION";
  explanation: string;
}

/**
 * Evaluates whether retrieved evidence provides genuine independent corroboration,
 * rejecting author self-claims, syndicated copies, and superficial keyword overlap.
 */
export function evaluateCorroboratingEvidence(
  primarySignal: { url?: string; title?: string; text?: string; authorFingerprint?: string; sourceKey?: string },
  candidateSignal: { url?: string; title?: string; text?: string; authorFingerprint?: string; sourceKey?: string },
): CorroborationEvaluationResult {
  // 1. Syndicated copy exclusion
  if (isSyndicatedCopy(primarySignal.url, candidateSignal.url, primarySignal.text, candidateSignal.text)) {
    return {
      isIndependent: false,
      relationshipType: "IRRELEVANT",
      rejectReason: "SYNDICATED_COPY",
      explanation: "Syndicated copy: identical text or syndicated re-publication of the primary source.",
    };
  }

  // 2. Author self-claim exclusion
  if (isAuthorSelfClaim(candidateSignal, primarySignal)) {
    return {
      isIndependent: false,
      relationshipType: "IRRELEVANT",
      rejectReason: "AUTHOR_CLAIM",
      explanation: "Author self-claim: signal originates from the same product author or repository owner.",
    };
  }

  // 3. Must describe concrete user/practitioner problem or manual workaround
  const isConcrete = isConcreteProblemOrWorkaround({
    title: candidateSignal.title,
    sanitizedExcerpt: candidateSignal.text || "",
    problemSummary: candidateSignal.title || "",
    sourceKey: candidateSignal.sourceKey || "",
    canonicalUrl: candidateSignal.url || "",
  });
  if (!isConcrete) {
    return {
      isIndependent: false,
      relationshipType: "IRRELEVANT",
      rejectReason: "NOT_CONCRETE_PROBLEM",
      explanation: "Does not describe a concrete technical breakdown, failure, or manual workaround.",
    };
  }

  // 4. Must address the same underlying technical problem mechanics, not superficial keyword overlap
  const sameProblem = signalsSupportSameProblem(
    primarySignal.title || "",
    candidateSignal.title || "",
    primarySignal.text || "",
    candidateSignal.text || "",
  );
  if (!sameProblem) {
    return {
      isIndependent: false,
      relationshipType: "IRRELEVANT",
      rejectReason: "KEYWORD_OVERLAP_ONLY",
      explanation: "Superficial keyword overlap: discusses related technology terms without describing the same concrete breakdown.",
    };
  }

  // 5. Check if independent signal contradicts or disconfirms the problem
  const candidateLower = `${candidateSignal.title || ""} ${candidateSignal.text || ""}`.toLowerCase();
  const isContradiction = /\b(not a bug|expected behavior|wontfix|won't fix|already solved|use the native|native feature exists|user error|misconfiguration|closed as duplicate|invalid issue|standard config handles this|intended behavior)\b/i.test(candidateLower);

  if (isContradiction) {
    return {
      isIndependent: true,
      relationshipType: "CONTRADICTS",
      explanation: "Independent analysis indicates issue is expected behavior, standard misconfiguration, or resolved by native platform features.",
    };
  }

  return {
    isIndependent: true,
    relationshipType: "SUPPORTS",
    explanation: `Independent practitioner report from ${candidateSignal.sourceKey || "external source"}: confirms recurring workflow friction and manual recovery.`,
  };
}

export interface ResearchLeadPromotionEvaluation {
  isEligibleForPromotion: boolean;
  promotionStatus: "PROMOTED" | "UNVERIFIED";
  independentSourcesCount: number;
  distinctSources: string[];
  reasons: string[];
}

/**
 * Evaluates whether two signals or sources are genuinely independent.
 * Distinct source keys, distinct source families, distinct hostnames, or distinct GitHub repositories
 * are treated as independent.
 */
export function isIndependentSource(
  s1: { key?: string; sourceFamily?: string; canonicalUrl?: string },
  s2: { key?: string; sourceFamily?: string; canonicalUrl?: string },
): boolean {
  if (s1.key && s2.key && s1.key.toLowerCase() !== s2.key.toLowerCase()) {
    return true;
  }
  if (s1.sourceFamily && s2.sourceFamily && s1.sourceFamily.toLowerCase() !== s2.sourceFamily.toLowerCase()) {
    return true;
  }

  const u1 = (s1.canonicalUrl || "").toLowerCase();
  const u2 = (s2.canonicalUrl || "").toLowerCase();

  // If both are GitHub, check repository paths
  const ghMatch1 = u1.match(/github\.com\/([^/]+\/[^/]+)/);
  const ghMatch2 = u2.match(/github\.com\/([^/]+\/[^/]+)/);
  if (ghMatch1 && ghMatch2) {
    return ghMatch1[1] !== ghMatch2[1];
  }

  // Check distinct hostnames
  try {
    if (u1 && u2) {
      const h1 = new URL(u1).hostname.replace(/^www\./, "");
      const h2 = new URL(u2).hostname.replace(/^www\./, "");
      if (h1 && h2 && h1 !== h2) return true;
    }
  } catch {}

  return false;
}

/**
 * Checks whether two signals address the same underlying technical problem space.
 */
export function signalsSupportSameProblem(
  title1: string,
  title2: string,
  text1: string,
  text2: string,
): boolean {
  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !["with", "from", "that", "this", "have", "issue", "error", "problem", "fails", "failing"].includes(w));

  const words1 = new Set(normalize(`${title1} ${text1}`));
  const words2 = new Set(normalize(`${title2} ${text2}`));

  let overlap = 0;
  for (const w of words1) {
    if (words2.has(w)) overlap++;
  }

  // Common high-signal technical anchors
  const anchors = [
    "ingress", "websocket", "latency", "rebalance", "kafka", "gpu", "cluster",
    "memory", "leak", "deadlock", "timeout", "docker", "kubernetes", "sqlite",
    "postgres", "redis", "terraform", "datadog", "observability", "prompt",
    "evaluation", "benchmark", "vllm", "cuda", "finops", "state", "locking",
    "crashloopbackoff", "oomkilled", "cost"
  ];
  const anchorOverlap = anchors.some((a) => words1.has(a) && words2.has(a));

  return overlap >= 3 || (overlap >= 2 && anchorOverlap);
}

/**
 * Evaluates whether a Research Lead can be promoted to an Opportunity Hypothesis.
 * A lead can ONLY be promoted when independent sources support the same problem;
 * otherwise it must be kept clearly labeled UNVERIFIED.
 * Never invents demand, buyers, or willingness to pay, and never weakens the VERIFIED publication policy.
 */
export function evaluateResearchLeadPromotion(
  lead: {
    title: string;
    canonicalUrl?: string;
    sourceName?: string;
    sourceFamily?: string;
    sourceKey?: string;
  },
  corroboratingSignals: Array<{
    id?: string;
    sourceTitle?: string;
    canonicalUrl?: string;
    sourceName?: string;
    sourceFamily?: string;
    sourceKey?: string;
  }> = [],
): ResearchLeadPromotionEvaluation {
  const distinctSources = new Set<string>();

  // Add primary lead source
  const primaryKey = lead.sourceKey || lead.sourceName || "primary-source";
  distinctSources.add(primaryKey.toLowerCase());

  // Check corroborating signals
  for (const s of corroboratingSignals) {
    const sKey = s.sourceKey || s.sourceName || (s.canonicalUrl ? new URL(s.canonicalUrl).hostname : "other-source");
    if (sKey) {
      distinctSources.add(sKey.toLowerCase());
    }
  }

  const independentSourcesCount = distinctSources.size;
  const isEligibleForPromotion = independentSourcesCount >= 2;

  if (isEligibleForPromotion) {
    return {
      isEligibleForPromotion: true,
      promotionStatus: "PROMOTED",
      independentSourcesCount,
      distinctSources: Array.from(distinctSources),
      reasons: [
        `Corroborated across ${independentSourcesCount} independent sources (${Array.from(distinctSources).join(", ")})`,
        "Elevated to Opportunity Hypothesis for preliminary customer problem discovery",
      ],
    };
  }

  return {
    isEligibleForPromotion: false,
    promotionStatus: "UNVERIFIED",
    independentSourcesCount,
    distinctSources: Array.from(distinctSources),
    reasons: [
      "Only observed in a single source; lacks corroboration from independent sources",
      "Must remain strictly labeled UNVERIFIED until independent proof of recurrence is collected",
    ],
  };
}

export interface CandidateScoringInput {
  title?: string | null;
  sanitizedExcerpt?: string | null;
  problemSummary?: string | null;
  signalType?: string | null;
  purchaseIntent?: boolean | null;
  actorRole?: string | null;
  rawContent?: string | null;
  canonicalUrl?: string | null;
  sourceKey?: string | null;
  sourceFamily?: string | null;
  metadata?: any;
  corroboratingSignals?: Array<{
    id?: string;
    sourceTitle?: string;
    canonicalUrl?: string;
    sourceName?: string;
    sourceFamily?: string;
    sourceKey?: string;
    actorRole?: string;
  }>;
}

export interface CandidateQualityScore {
  totalScore: number;
  operationalFailureScore: number;
  recurrenceScore: number;
  costlyWorkaroundScore: number;
  independenceScore: number;
  purchaseIntentScore: number;
  noisePenalty: number;
  rankPriority: "HIGH" | "MEDIUM" | "LOW" | "NOISE";
  reasons: string[];
}

/**
 * Scores and prioritizes candidate signals for opportunity discovery.
 * Prioritizes:
 * 1. Recurrence evidence (cadence, frequent repetition, cross-team scope, community score)
 * 2. Costly workarounds (manual hacks, stopgaps, cloud bill spikes, engineering downtime)
 * 3. Independent users/sources (multi-source corroboration, distinct authors)
 * 4. Explicit purchase intent (commercial buying language, budget, willingness to pay)
 * Demotes isolated obscure errors (syntax typos, compiler flags, internal status codes) to NOISE.
 */
export function scoreCandidateQuality(input: CandidateScoringInput): CandidateQualityScore {
  const title = (input.title || "").trim();
  const excerpt = (input.sanitizedExcerpt || "").trim();
  const summary = (input.problemSummary || "").trim();
  const rawContent = (input.rawContent || "").trim();
  const fullText = `${title} ${excerpt} ${summary} ${rawContent}`.toLowerCase();
  const reasons: string[] = [];

  let operationalFailureScore = 0;
  let recurrenceScore = 0;
  let costlyWorkaroundScore = 0;
  let independenceScore = 0;
  let purchaseIntentScore = 0;
  let noisePenalty = 0;

  // 1. Concrete Operational Breakdown / Problem Baseline (up to 15 points)
  if (
    /\b(broken|breaks|breaking (build|pipeline|automation|tests)|broken (build|pipeline)|build automation|fails|failing|failed|crash|crashes|leak|leaks|silent failure|data corruption|unable to parse|cannot decode|outage|throttled|timeout|permission denied|unusable)\b/i.test(fullText)
  ) {
    operationalFailureScore = 15;
    reasons.push("Concrete operational failure or broken workflow verified");
  }

  // 2. Evidence of Recurrence (up to 40 points)
  if (
    /\b(recurring|recurs|constant(ly)?|every (day|week|sprint|release|hour|month)|daily|weekly|repeatedly|ongoing|intermittent(ly)?|keeps happening|frequently|all the time|continuous(ly)?)\b/i.test(fullText)
  ) {
    recurrenceScore += 15;
    reasons.push("Explicit recurring cadence or frequent repetition observed");
  }
  if (
    /\b(across (all|multiple|our) (teams|clusters|nodes|environments|services|repos|tenants|pods)|reproducible across|every engineer|all developers|multiple users reporting|affects multiple|widespread)\b/i.test(fullText)
  ) {
    recurrenceScore += 15;
    reasons.push("Multi-environment or multi-team organizational impact observed");
  }
  const meta = input.metadata || {};
  if (typeof meta.score === "number" && meta.score >= 20) {
    recurrenceScore += 10;
    reasons.push(`High community verification score (${meta.score} upvotes)`);
  } else if (typeof meta.score === "number" && meta.score >= 5) {
    recurrenceScore += 5;
    reasons.push(`Community verification score (${meta.score} upvotes)`);
  }
  if (typeof meta.viewCount === "number" && meta.viewCount >= 1000) {
    recurrenceScore += 5;
    reasons.push(`Broad organic visibility (${meta.viewCount} views)`);
  }
  recurrenceScore = Math.min(40, recurrenceScore);

  // 2. Costly Workarounds & Operational Waste (up to 40 points)
  if (
    /\b(workaround|hacky workaround|manual fix|temporary script|manual reconciliation|custom script to|have to manually|have to restart|cron job to kill|rebooting|patching every time|bandaid|stopgap)\b/i.test(fullText)
  ) {
    costlyWorkaroundScore += 20;
    reasons.push("Manual stopgap or hacky workaround required in workflow");
  }
  if (
    /\b(costs? \$|\$([0-9,]+)|bill spike|unexpected spend|idle spend|cloud bill|wasted (days|weeks|hours)|\d+\s*hours (spent|wasted|debugging)|downtime|outage|sla breach|production failure|data loss|data corruption|memory leak in production|oom-killed|production container)\b/i.test(fullText)
  ) {
    costlyWorkaroundScore += 20;
    reasons.push("Quantified financial loss, engineering time waste, or production downtime");
  }
  costlyWorkaroundScore = Math.min(40, costlyWorkaroundScore);

  // 3. Independent Users & Multi-Source Corroboration (up to 35 points)
  const corroborating = input.corroboratingSignals || [];
  if (corroborating.length >= 2) {
    independenceScore += 35;
    reasons.push(`Corroborated across ${corroborating.length + 1} independent sources`);
  } else if (corroborating.length === 1) {
    independenceScore += 20;
    reasons.push("Corroborated by independent secondary source");
  }
  independenceScore = Math.min(35, independenceScore);

  // 4. Explicit Purchase Intent & Commercial Signals (up to 45 points)
  const sigType = (input.signalType || "").toUpperCase();
  if (input.purchaseIntent === true || ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes(sigType)) {
    purchaseIntentScore += 25;
    reasons.push("Explicit commercial purchase intent flagged");
  }
  if (
    /\b(willing to pay|looking for a (paid|commercial|enterprise) (tool|solution|alternative)|budget for|procuring|ready to buy|would pay|paying customer|commercial license|rfp|procurement)\b/i.test(fullText)
  ) {
    purchaseIntentScore += 20;
    reasons.push("Direct commercial buying intent language in source text");
  }
  purchaseIntentScore = Math.min(45, purchaseIntentScore);

  // 5. Obscurity & Noise Penalties (-100 to 0 points)
  if (
    /\b(scalar initializer for type|braces around scalar initializer|undefined reference to|cannot convert ['"].*['"] to|stray ['"]?\\['"]? in program|syntaxerror:|typeerror: .* is not a function|nullpointerexception|attributeerror: '.*' object has no attribute|nameerror: name '.*' is not defined|indexoutofboundsexception|referenceerror: .* is not defined)\b/i.test(fullText)
  ) {
    if (!/\b(production outage|cluster failure|downtime|cost spike|data loss)\b/i.test(fullText)) {
      noisePenalty -= 80;
      reasons.push("Demoted: isolated compiler/syntax/runtime error without production impact");
    }
  }
  if (
    /\b(code 13 internal error|status code \d{3} in my test|causes a code \d+ internal error)\b/i.test(fullText)
  ) {
    if (!/\b(outage|downtime|workaround|cost spike|data loss)\b/i.test(fullText)) {
      noisePenalty -= 60;
      reasons.push("Demoted: isolated internal API status code without operational friction");
    }
  }
  if (
    /\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|update current state in readme|vague question about|without industry context)\b/i.test(fullText)
  ) {
    noisePenalty -= 80;
    reasons.push("Demoted: repository-internal chore task or vague non-problem critique");
  }
  if (
    operationalFailureScore === 0 &&
    recurrenceScore === 0 &&
    costlyWorkaroundScore === 0 &&
    independenceScore === 0 &&
    purchaseIntentScore === 0
  ) {
    noisePenalty -= 15;
    reasons.push("Demoted: single-user observation lacking recurrence, failure, or workaround evidence");
  }
  noisePenalty = Math.max(-100, noisePenalty);

  const totalScore = operationalFailureScore + recurrenceScore + costlyWorkaroundScore + independenceScore + purchaseIntentScore + noisePenalty;

  let rankPriority: "HIGH" | "MEDIUM" | "LOW" | "NOISE" = "LOW";
  if (totalScore >= 50) {
    rankPriority = "HIGH";
  } else if (totalScore >= 25) {
    rankPriority = "MEDIUM";
  } else if (totalScore > 0) {
    rankPriority = "LOW";
  } else {
    rankPriority = "NOISE";
  }

  return {
    totalScore,
    operationalFailureScore,
    recurrenceScore,
    costlyWorkaroundScore,
    independenceScore,
    purchaseIntentScore,
    noisePenalty,
    rankPriority,
    reasons,
  };
}

/**
 * Builds the public daily discovery feed separated into two clearly labeled sections:
 * 1. New Market Signals — authentic, newly collected articles/discussions with source metadata,
 *    clearly labeled: "Market signal — not a validated business opportunity". No invented buyer demand or WTP.
 * 2. Opportunity Hypotheses — synthesized problem hypotheses when the pipeline has enough evidence.
 *
 * Guarantees:
 * 1. Strictly allowlisted public fields via DTOs - NEVER leaks Pro blueprint fields,
 *    internal IDs, private user data, raw LLM outputs, or unreviewed text.
 * 2. Never marks a DRAFT or HYPOTHESIS candidate as VERIFIED.
 * 3. Shows original source publication date separately from the feed discovery timestamp.
 * 4. Deduplicated by canonicalUrl and content hash.
 * 5. Never fabricates posts or resets timestamps when today has no new posts; displays
 *    latest authentic posts with actual dates and clear metadata.
 */
export async function getDailyDiscoveryFeed(
  prisma: any,
  options: GetDiscoveryFeedOptions = {},
): Promise<DiscoveryFeedResponseDTO> {
  const limit = Math.min(10, Math.max(1, options.limit || 5));
  const signalsLimit = Math.min(20, Math.max(1, options.signalsLimit || 10));
  const maxItemsPerSource = Math.max(1, options.maxItemsPerSource || 2);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    // 1. Fetch genuine candidates that have evidence links (Opportunity Hypotheses)
    const candidates = await prisma.opportunity.findMany({
      where: {
        isDemoFixture: false,
        publicationQualityStatus: { in: ["HYPOTHESIS", "PARTIALLY_VERIFIED", "EVIDENCE_PENDING"] },
        status: { in: ["DRAFT", "IN_REVIEW", "PUBLISHED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        evidenceLinks: {
          take: 5,
          include: {
            normalizedSignal: {
              include: {
                rawSignal: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const leadSeenUrls = new Set<string>();
    const leadSeenTitles = new Set<string>();
    const sourceCounts = new Map<string, number>();
    const leadSourceCounts = new Map<string, number>();
    const opportunityHypotheses: DiscoveryFeedItemDTO[] = [];
    const researchLeads: ResearchLeadFeedItemDTO[] = [];
    const researchLeadsLimit = options.researchLeadsLimit ?? 6;

    for (const opp of candidates) {
      if (opportunityHypotheses.length >= limit) break;
      if (/vague-question-about|^vague question about|without industry context/i.test(`${opp.slug || ""} ${opp.title || ""} ${opp.problemStatement || ""}`)) {
        continue;
      }

      // Extract genuine evidence observations
      const observations: Array<{
        id: string;
        sourceTitle: string;
        excerpt: string;
        canonicalUrl: string;
        sourceFamily: string;
        sourceName: string;
        publishedAt: string;
      }> = [];

      let primaryCanonicalUrl = "";
      let primarySourceTitle = "";
      let primarySourceFamily = "COMMUNITY";
      let primarySourceKey = "";
      let primaryPublishedAt: Date | null = null;

      let hasActionableEvidence = false;

      for (const link of opp.evidenceLinks || []) {
        const ns = link.normalizedSignal;
        const raw = ns?.rawSignal;
        const src = raw?.source;
        if (!ns || !raw) continue;

        const canonical = ns.canonicalUrl || raw.sourceUrl;
        if (!primaryCanonicalUrl && canonical) {
          primaryCanonicalUrl = canonical;
          primarySourceTitle = raw.title || ns.sourceTitle || src?.name || "Market Signal";
          primarySourceFamily = src?.sourceFamily || (src?.key === "github" ? "DEVELOPER_ECOSYSTEM" : src?.key === "krasia" ? "DISCOVERY" : "COMMUNITY");
          primarySourceKey = src?.key || "";
          primaryPublishedAt = raw.publishedAt || ns.publishedAt || raw.createdAt;
        }

        const obsDate = raw.publishedAt || ns.publishedAt || raw.createdAt || new Date();
        const obsDateIso = obsDate instanceof Date ? obsDate.toISOString() : new Date(obsDate).toISOString();

        // Check if signal contains actionable problem/demand evidence
        // NOTE: Evidence MUST originate from the source signal itself, never the AI-generated opportunity title/problem statement.

        // Check if signal contains actionable problem/demand evidence
        // NOTE: Evidence MUST originate from the source signal itself, never the AI-generated opportunity title/problem statement.
        const isActionableType = isConcreteProblemOrWorkaround({
          title: raw.title || ns.sourceTitle,
          sanitizedExcerpt: ns.sanitizedExcerpt,
          problemSummary: ns.problemSummary,
          signalType: ns.signalType,
          canonicalUrl: canonical,
          sourceKey: src?.key,
          sourceFamily: src?.sourceFamily,
        });

        if (isActionableType) {
          hasActionableEvidence = true;
        }

        observations.push({
          id: ns.id,
          sourceTitle: raw.title || ns.sourceTitle || src?.name || "Market Evidence",
          excerpt: ns.sanitizedExcerpt || ns.problemSummary,
          canonicalUrl: canonical,
          sourceFamily: src?.sourceFamily || "COMMUNITY",
          sourceName: src?.name || "Public Community",
          publishedAt: obsDateIso,
        });
      }

      // If an opportunity has no grounded problem, workaround, or purchase intent evidence (e.g. general news or emerging tech),
      // do not display it as a fabricated business hypothesis.
      if (!hasActionableEvidence && observations.length > 0) {
        continue;
      }

      // A hypothesis must be based on a recent signal (published within 14 days)
      const now = Date.now();
      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
      const candidatePubDate = primaryPublishedAt || opp.createdAt;
      if (!candidatePubDate) {
        continue;
      }
      const pubTime = candidatePubDate instanceof Date ? candidatePubDate.getTime() : new Date(candidatePubDate).getTime();
      if (isNaN(pubTime) || now - pubTime > FOURTEEN_DAYS_MS || pubTime > now + 24 * 60 * 60 * 1000) {
        continue;
      }
      if (primaryPublishedAt) {
        const primTime = primaryPublishedAt instanceof Date ? primaryPublishedAt.getTime() : new Date(primaryPublishedAt).getTime();
        if (now - primTime > FOURTEEN_DAYS_MS) {
          continue;
        }
      }

      // A single GitHub issue is only a Market Signal unless independent evidence confirms the broader need
      const isGitHubEvidence =
        primaryCanonicalUrl.toLowerCase().includes("github.com") ||
        primarySourceKey === "github" ||
        primarySourceFamily === "DEVELOPER_ECOSYSTEM";

      if (isGitHubEvidence) {
        const distinctSources = new Set(
          observations.map((o) => {
            const url = (o.canonicalUrl || "").toLowerCase();
            const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
            return match ? match[1] : o.sourceName || o.sourceFamily;
          })
        );
        const hasIndependentCorroboration = observations.length >= 2 && distinctSources.size >= 2;
        if (!hasIndependentCorroboration) {
          continue;
        }
      }

      // Enforce public feed primary source limits to ensure diversity
      const effectiveSourceKey = primarySourceKey || "unknown";
      const currentSourceCount = sourceCounts.get(effectiveSourceKey) || 0;
      if (currentSourceCount >= maxItemsPerSource) {
        continue;
      }

      // Deduplication by primary URL and title
      const urlKey = primaryCanonicalUrl.toLowerCase().trim();
      const titleKey = opp.title.toLowerCase().trim();

      if (urlKey && seenUrls.has(urlKey)) continue;
      if (titleKey && seenTitles.has(titleKey)) continue;

      if (urlKey) seenUrls.add(urlKey);
      if (titleKey) seenTitles.add(titleKey);

      // Extract observed facts directly from signal excerpts
      const observedFacts = observations.map((o) => o.excerpt).slice(0, 3);
      if (observedFacts.length === 0 && opp.problemStatement) {
        observedFacts.push(opp.problemStatement);
      }

      // Demarcate AI-generated business hypothesis directly grounded in observed facts
      const primaryFact = observedFacts[0] || opp.problemStatement || opp.title;
      const fullProblemText = `${opp.title} ${opp.problemStatement || ""} ${primaryFact}`;

      const targetAudience = deriveSpecificAudience(
        fullProblemText,
        opp.economicBuyer || opp.endUser
      );

      // A hypothesis requires an identifiable buyer (no generic early adopters or unknown placeholders)
      if (!targetAudience || targetAudience.startsWith("Unknown") || /Early Adopter Teams/i.test(targetAudience)) {
        continue;
      }

      sourceCounts.set(effectiveSourceKey, currentSourceCount + 1);

      const rawProposedSolution = (opp.proposedProduct || "").trim();
      const hasGenericBoilerplate =
        /Lightweight SaaS tool providing automated monitoring.*Data Engineering & FinOps/i.test(rawProposedSolution) ||
        /^Targeted solution addressing:/i.test(rawProposedSolution);
      const proposedSolution = (!rawProposedSolution || hasGenericBoilerplate)
        ? derivePlausibleProductDirection(opp.title, targetAudience)
        : rawProposedSolution;

      const hasExplicitPurchaseIntent = (opp.evidenceLinks || []).some(
        (l: any) => l.normalizedSignal?.purchaseIntent === true || ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes((l.normalizedSignal?.signalType || "").toUpperCase())
      );

      const validationExperiment = deriveSpecificValidationExperiment(
        fullProblemText,
        targetAudience
      );

      const businessHypothesis = {
        targetAudience,
        proposedSolution,
        painFriction: opp.problemStatement || primaryFact || "Operational bottleneck identified in market signals",
        assumptions: [
          `Target practitioners experience operational friction or failure under current manual workflows`,
          `Breakdown recurs frequently enough in production to justify a dedicated tooling solution`,
        ],
        validationExperiment,
        purchaseIntentStatus: (hasExplicitPurchaseIntent ? "CONFIRMED" : "UNKNOWN") as "CONFIRMED" | "UNKNOWN",
        confidenceNote: "Initial market hypothesis derived from public signals. Not yet validated via formal customer interviews or WTP proof.",
      };

      const market = deriveMarketRegion(primarySourceKey, primarySourceFamily, opp.industry);
      const pubDate = (primaryPublishedAt ? (primaryPublishedAt instanceof Date ? primaryPublishedAt : new Date(primaryPublishedAt)) : (opp.createdAt instanceof Date ? opp.createdAt : new Date(opp.createdAt))).toISOString();

      // Sanitize summary to ensure no legacy boilerplate leaks
      let summary = (opp.oneSentenceSummary || "").trim();
      if (/Streamline and automate .* without complex custom scripts/i.test(summary) || !summary) {
        summary = `Exploration of ${opp.title.toLowerCase()} based on observed market developments.`;
      }

      opportunityHypotheses.push({
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        summary,
        observedFacts,
        evidenceObservations: observations,
        businessHypothesis,
        publicationDate: pubDate,
        discoveredAt: opp.createdAt.toISOString(),
        market,
        canonicalUrl: primaryCanonicalUrl || `https://buildworth.app/opportunities/${opp.slug}`,
        sourceTitle: primarySourceTitle || "Market Discussion",
        sourceFamily: primarySourceFamily,
        verificationLabel: "Early idea / Not yet verified",
        signalCount: opp.evidenceLinks?.length || 1,
        status: "HYPOTHESIS",
      });
    }

    // 1b. If no candidate opportunity rows exist in database or we have capacity for research leads,
    // evaluate unclustered signals directly from recent authentic NormalizedSignals or RawSignals.
    if (opportunityHypotheses.length < limit || researchLeads.length < researchLeadsLimit) {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      let unclusteredSignals: any[] = [];

      if (prisma.normalizedSignal?.findMany) {
        unclusteredSignals = await prisma.normalizedSignal.findMany({
          where: {
            verificationStatus: { not: "REJECTED" },
            rawSignal: {
              source: {
                isEnabled: true,
                policyStatus: { not: "BLOCKED" },
              },
              publishedAt: {
                not: null,
                gte: fourteenDaysAgo,
              },
            },
          },
          orderBy: { publishedAt: "desc" },
          take: 100,
          include: {
            rawSignal: {
              include: {
                source: true,
              },
            },
          },
        }).catch((err: any) => {
          logger.warn("Failed to query unclustered NormalizedSignals", { error: err?.message || err });
          return [];
        });
      }

      // Ingest recent raw signals alongside normalized signals so genuine production issues
      // not yet processed by the async normalization worker are evaluated as candidate leads.
      if (prisma.rawSignal?.findMany) {
        const rawSignals = await prisma.rawSignal.findMany({
          where: {
            source: {
              isEnabled: true,
              policyStatus: { not: "BLOCKED" },
            },
            publishedAt: {
              not: null,
              gte: fourteenDaysAgo,
            },
          },
          orderBy: { publishedAt: "desc" },
          take: 100,
          include: {
            source: true,
            normalizedSignal: true,
          },
        }).catch((err: any) => {
          logger.warn("Failed to query unclustered RawSignals for candidates", { error: err?.message || err });
          return [];
        });

        const seenRawIds = new Set(
          unclusteredSignals
            .map((s: any) => s.rawSignalId || s.rawSignal?.id)
            .filter(Boolean),
        );

        for (const r of rawSignals) {
          if (seenRawIds.has(r.id)) continue;
          seenRawIds.add(r.id);

          if (r.normalizedSignal) {
            unclusteredSignals.push({
              id: r.normalizedSignal.id || "norm-" + r.id,
              ...r.normalizedSignal,
              rawSignal: r,
            });
          } else {
            unclusteredSignals.push({
              id: "norm-" + r.id,
              rawSignalId: r.id,
              rawSignal: r,
              sourceTitle: r.title,
              sanitizedExcerpt: r.rawContent ? r.rawContent.slice(0, 500) : r.title,
              problemSummary: r.rawContent ? r.rawContent.slice(0, 500) : r.title,
              signalType: "PAIN",
              canonicalUrl: r.sourceUrl,
              publishedAt: r.publishedAt,
              verificationStatus: "UNVERIFIED",
            });
          }
        }
      }

      // Pass 1: Filter, corroborate, and score candidate signals
      const candidatePool: Array<{
        ns: any;
        raw: any;
        src: any;
        canonical: string;
        cleanTitle: string;
        fullProblemText: string;
        targetAudience: string;
        obsDateIso: string;
        corroboratingSignals: any[];
        promotionEval: ResearchLeadPromotionEvaluation;
        score: CandidateQualityScore;
        effectiveSourceKey: string;
        pubTime: number;
        hasExplicitPurchaseIntent: boolean;
        hasRecurringProblemEvidence: boolean;
        isGitHub: boolean;
        painFriction: string;
        proposedSolution: string;
        validationExperiment: string;
        market: string;
        safeSlug: string;
        observation: any;
      }> = [];

      for (const ns of unclusteredSignals) {
        const raw = ns.rawSignal;
        const src = raw?.source;
        if (!raw || !src) continue;

        // 1. Recency requirement: signal must be published within 14 days and never undated
        const rawPubDate = raw.publishedAt || ns.publishedAt;
        if (!rawPubDate) continue;
        const obsTime = rawPubDate instanceof Date ? rawPubDate.getTime() : new Date(rawPubDate).getTime();
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        if (isNaN(obsTime) || Date.now() - obsTime > FOURTEEN_DAYS_MS || obsTime > Date.now() + 24 * 60 * 60 * 1000) {
          continue;
        }

        const canonical = ns.canonicalUrl || raw.sourceUrl || "";

        // Strictly verify that this signal contains authentic problem / workaround / unmet need evidence
        const isActionable = isConcreteProblemOrWorkaround({
          title: raw.title || ns.sourceTitle,
          sanitizedExcerpt: ns.sanitizedExcerpt,
          problemSummary: ns.problemSummary,
          signalType: ns.signalType,
          canonicalUrl: canonical,
          sourceKey: src.key,
          sourceFamily: src.sourceFamily,
        });

        if (!isActionable) continue;

        const title = raw.title || ns.sourceTitle || "Unmet Need Identified in Market Discussion";
        const cleanTitle = title.replace(/\s+/g, " ").trim();
        const fullProblemText = `${cleanTitle} ${ns.problemSummary || ""} ${ns.sanitizedExcerpt || ""}`;
        const targetAudience = deriveSpecificAudience(fullProblemText, ns.actorRole);

        // An identifiable buyer is required (no generic early adopters or unknown placeholders)
        if (!targetAudience || targetAudience.startsWith("Unknown") || /Early Adopter Teams/i.test(targetAudience)) {
          continue;
        }

        const obsDateIso = (rawPubDate instanceof Date ? rawPubDate : new Date(rawPubDate)).toISOString();

        const observation = {
          id: ns.id,
          sourceTitle: raw.title || ns.sourceTitle || src.name || "Market Evidence",
          excerpt: ns.sanitizedExcerpt || ns.problemSummary,
          canonicalUrl: canonical,
          sourceFamily: src.sourceFamily || "COMMUNITY",
          sourceName: src.name || "Public Community",
          publishedAt: obsDateIso,
        };

        const painFriction = ns.problemSummary || ns.sanitizedExcerpt || cleanTitle;
        const proposedSolution = derivePlausibleProductDirection(cleanTitle, targetAudience);
        const validationExperiment = deriveSpecificValidationExperiment(fullProblemText, targetAudience);

        const hasExplicitPurchaseIntent =
          ns.purchaseIntent === true ||
          ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes((ns.signalType || "").toUpperCase());

        const market = deriveMarketRegion(src.key, src.sourceFamily);
        const signalId = String(ns.id || raw.id || "signal");
        const safeSlug = (cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "lead") + "-" + signalId.slice(0, 8);

        // Find corroborating signals from independent sources supporting the exact same problem
        const corroboratingSignals = unclusteredSignals.filter((otherNs: any) => {
          if (otherNs.id === ns.id) return false;
          const otherRaw = otherNs.rawSignal;
          const otherSrc = otherRaw?.source;
          if (!otherRaw || !otherSrc) return false;

          const otherCanonical = otherNs.canonicalUrl || otherRaw.sourceUrl || "";
          const otherIsActionable = isConcreteProblemOrWorkaround({
            title: otherRaw.title || otherNs.sourceTitle,
            sanitizedExcerpt: otherNs.sanitizedExcerpt,
            problemSummary: otherNs.problemSummary,
            signalType: otherNs.signalType,
            canonicalUrl: otherCanonical,
            sourceKey: otherSrc.key,
            sourceFamily: otherSrc.sourceFamily,
          });
          if (!otherIsActionable) return false;

          const isIndependent = isIndependentSource(
            { key: src.key, sourceFamily: src.sourceFamily, canonicalUrl: canonical },
            { key: otherSrc.key, sourceFamily: otherSrc.sourceFamily, canonicalUrl: otherCanonical },
          );
          if (!isIndependent) return false;

          return signalsSupportSameProblem(
            cleanTitle,
            otherRaw.title || otherNs.sourceTitle || "",
            fullProblemText,
            `${otherNs.sourceTitle || ""} ${otherNs.problemSummary || ""} ${otherNs.sanitizedExcerpt || ""}`,
          );
        });

        // Compute Candidate Quality Score (recurrence, costly workarounds, independent users, purchase intent, noise penalties)
        const score = scoreCandidateQuality({
          title: cleanTitle,
          sanitizedExcerpt: ns.sanitizedExcerpt,
          problemSummary: ns.problemSummary,
          signalType: ns.signalType,
          purchaseIntent: ns.purchaseIntent,
          actorRole: ns.actorRole,
          rawContent: raw.rawContent,
          canonicalUrl: canonical,
          sourceKey: src.key,
          sourceFamily: src.sourceFamily,
          metadata: raw.metadata,
          corroboratingSignals: corroboratingSignals.map((cs: any) => ({
            id: cs.id,
            sourceTitle: cs.rawSignal?.title || cs.sourceTitle,
            canonicalUrl: cs.canonicalUrl || cs.rawSignal?.sourceUrl,
            sourceKey: cs.rawSignal?.source?.key,
            sourceName: cs.rawSignal?.source?.name,
            sourceFamily: cs.rawSignal?.source?.sourceFamily,
          })),
        });

        // Demote and filter out obscure noise or non-positive score items from becoming Research Leads or Hypotheses
        if (score.rankPriority === "NOISE" || score.totalScore <= 0) {
          continue;
        }

        const promotionEval = evaluateResearchLeadPromotion(
          {
            title: cleanTitle,
            canonicalUrl: canonical,
            sourceKey: src.key,
            sourceName: src.name,
            sourceFamily: src.sourceFamily,
          },
          corroboratingSignals.map((cs: any) => ({
            id: cs.id,
            sourceTitle: cs.rawSignal?.title || cs.sourceTitle,
            canonicalUrl: cs.canonicalUrl || cs.rawSignal?.sourceUrl,
            sourceKey: cs.rawSignal?.source?.key,
            sourceName: cs.rawSignal?.source?.name,
            sourceFamily: cs.rawSignal?.source?.sourceFamily,
          })),
        );

        const isGitHub =
          src.key === "github" ||
          canonical.toLowerCase().includes("github.com") ||
          src.sourceFamily === "DEVELOPER_ECOSYSTEM";

        const hasRecurringProblemEvidence =
          /\b(recurring|recurs|constant(ly)?|every (day|week|month|hour)|daily|repeatedly|ongoing|workaround|hacky workaround|manual fix|costs? \$|\$([0-9,]+)\/(mo|month|yr|year)|bill spike|idle spend)\b/i.test(fullProblemText);

        candidatePool.push({
          ns,
          raw,
          src,
          canonical,
          cleanTitle,
          fullProblemText,
          targetAudience,
          obsDateIso,
          corroboratingSignals,
          promotionEval,
          score,
          effectiveSourceKey: src.key || "unknown",
          pubTime: obsTime,
          hasExplicitPurchaseIntent,
          hasRecurringProblemEvidence,
          isGitHub,
          painFriction,
          proposedSolution,
          validationExperiment,
          market,
          safeSlug,
          observation,
        });
      }

      // Pass 2: Sort candidates by quality score descending (ties broken by recency descending)
      candidatePool.sort((a, b) => b.score.totalScore - a.score.totalScore || b.pubTime - a.pubTime);

      // Pass 3: Process ranked candidates into Opportunity Hypotheses and Research Leads
      for (const candidate of candidatePool) {
        if (opportunityHypotheses.length >= limit && researchLeads.length >= researchLeadsLimit) break;

        const {
          ns,
          raw,
          canonical,
          cleanTitle,
          fullProblemText,
          targetAudience,
          obsDateIso,
          corroboratingSignals,
          promotionEval,
          score,
          effectiveSourceKey,
          hasExplicitPurchaseIntent,
          hasRecurringProblemEvidence,
          isGitHub,
          painFriction,
          proposedSolution,
          validationExperiment,
          market,
          safeSlug,
          observation,
        } = candidate;

        const urlKey = canonical ? canonical.toLowerCase().trim() : "";
        const titleKey = cleanTitle.toLowerCase().trim();

        if (urlKey && (seenUrls.has(urlKey) || leadSeenUrls.has(urlKey))) continue;
        if (titleKey && (seenTitles.has(titleKey) || leadSeenTitles.has(titleKey))) continue;

        const currentSourceCount = sourceCounts.get(effectiveSourceKey) || 0;
        const currentLeadSourceCount = leadSourceCounts.get(effectiveSourceKey) || 0;

        // Promote when independent sources support the same problem, or when high-priority verified recurring friction is present.
        // A single GitHub issue is NEVER promoted without independent corroboration.
        const qualifiesForHypothesis =
          promotionEval.isEligibleForPromotion ||
          (!isGitHub && (hasExplicitPurchaseIntent || (hasRecurringProblemEvidence && score.rankPriority === "HIGH")));

        if (qualifiesForHypothesis && opportunityHypotheses.length < limit && currentSourceCount < maxItemsPerSource) {
          if (urlKey) seenUrls.add(urlKey);
          if (titleKey) seenTitles.add(titleKey);
          sourceCounts.set(effectiveSourceKey, currentSourceCount + 1);

          const allObservations = [observation];
          for (const cs of corroboratingSignals) {
            const csRaw = cs.rawSignal;
            const csSrc = csRaw?.source;
            const csCanonical = cs.canonicalUrl || csRaw?.sourceUrl || "";
            const csPubDate = csRaw?.publishedAt || cs.publishedAt || new Date();
            const csPubIso = (csPubDate instanceof Date ? csPubDate : new Date(csPubDate)).toISOString();

            allObservations.push({
              id: cs.id,
              sourceTitle: csRaw?.title || cs.sourceTitle || csSrc?.name || "Corroborating Market Evidence",
              excerpt: cs.sanitizedExcerpt || cs.problemSummary,
              canonicalUrl: csCanonical,
              sourceFamily: csSrc?.sourceFamily || "COMMUNITY",
              sourceName: csSrc?.name || "Independent Source",
              publishedAt: csPubIso,
            });

            if (csCanonical) {
              seenUrls.add(csCanonical.toLowerCase().trim());
              leadSeenUrls.add(csCanonical.toLowerCase().trim());
            }
          }

          const businessHypothesis = {
            targetAudience,
            proposedSolution,
            painFriction,
            assumptions: [
              `Target practitioners experience operational friction or failure under current manual workflows`,
              `Breakdown recurs frequently enough across independent teams to justify an automated solution`,
            ],
            validationExperiment,
            purchaseIntentStatus: (hasExplicitPurchaseIntent ? "CONFIRMED" : "UNKNOWN") as "CONFIRMED" | "UNKNOWN",
            confidenceNote: `Promoted from Research Lead based on corroboration across ${promotionEval.independentSourcesCount} independent sources (${promotionEval.distinctSources.join(", ")}). Customer WTP remains unverified.`,
          };

          opportunityHypotheses.push({
            id: "hypo-" + ns.id,
            slug: safeSlug,
            title: cleanTitle,
            summary: `Hypothesis exploring practical workflow solution for ${cleanTitle.toLowerCase()}.`,
            observedFacts: allObservations.map((o) => o.excerpt),
            evidenceObservations: allObservations,
            businessHypothesis,
            publicationDate: obsDateIso,
            discoveredAt: (raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt)).toISOString(),
            market,
            canonicalUrl: canonical || `https://buildworth.app/signals/${ns.id}`,
            sourceTitle: observation.sourceTitle,
            sourceFamily: observation.sourceFamily,
            verificationLabel: "Early idea / Not yet verified",
            signalCount: allObservations.length,
            status: "HYPOTHESIS",
          });
        } else if (researchLeads.length < researchLeadsLimit && currentLeadSourceCount < maxItemsPerSource) {
          if (urlKey) leadSeenUrls.add(urlKey);
          if (titleKey) leadSeenTitles.add(titleKey);
          leadSourceCounts.set(effectiveSourceKey, currentLeadSourceCount + 1);

          const evidenceGaps = deriveEvidenceGaps(fullProblemText, targetAudience, false, hasExplicitPurchaseIntent);

          researchLeads.push({
            id: "lead-" + ns.id,
            slug: safeSlug,
            title: cleanTitle,
            summary: `Research lead investigating operational friction in ${cleanTitle.toLowerCase()}.`,
            canonicalUrl: canonical || `https://buildworth.app/signals/${ns.id}`,
            sourceTitle: observation.sourceTitle,
            sourceFamily: observation.sourceFamily,
            sourceName: observation.sourceName,
            publishedAt: obsDateIso,
            discoveredAt: (raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt)).toISOString(),
            market,
            label: "Research Lead — uncorroborated customer pain signal requiring validation",
            observedFacts: [observation.excerpt],
            sourceEvidence: [observation.excerpt],
            aiAssumptions: [
              "Target practitioners experience manual friction or operational overhead under current workflows",
              "Friction may recur across similar engineering setups but currently lacks multi-source corroboration",
              "Practitioners may prioritize a dedicated solution, but commercial willingness-to-pay remains unverified",
            ],
            plausibleBuyer: targetAudience,
            likelyAffectedUsers: targetAudience,
            evidenceGaps,
            concreteValidationStep: validationExperiment,
            practicalValidationExperiment: validationExperiment,
            verificationStatus: "UNVERIFIED",
            isPromoted: false,
            problemSummary: painFriction,
            status: "RESEARCH_LEAD",
            priorityRank: score.rankPriority as "HIGH" | "MEDIUM" | "LOW",
            candidateScore: score.totalScore,
          });
        }
      }
    }

    // 2. Fetch authentic New Market Signals directly from NormalizedSignal & RawSignal
    const marketSignals: MarketSignalFeedItemDTO[] = [];
    const signalSeenUrls = new Set<string>();
    const signalSourceCounts = new Map<string, number>();
    const maxItemsPerSourceInFeed = 2;

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const rawSignalRecords = prisma.rawSignal?.findMany
      ? await prisma.rawSignal.findMany({
          where: {
            source: {
              isEnabled: true,
              policyStatus: { not: "BLOCKED" },
            },
            publishedAt: {
              not: null,
              gte: fourteenDaysAgo,
            },
          },
          orderBy: { publishedAt: "desc" },
          take: Math.max(100, signalsLimit * 10),
          include: {
            source: true,
            normalizedSignal: true,
          },
        }).catch(() => [])
      : [];

    const signalSeenTitles = new Set<string>();

    // Pass 1: Diverse source representation (capped per source)
    for (const raw of rawSignalRecords) {
      if (marketSignals.length >= signalsLimit) break;
      if (!raw.publishedAt) continue;
      const pubTime = raw.publishedAt instanceof Date ? raw.publishedAt.getTime() : new Date(raw.publishedAt).getTime();
      if (isNaN(pubTime) || Date.now() - pubTime > 45 * 24 * 60 * 60 * 1000 || pubTime > Date.now() + 24 * 60 * 60 * 1000) {
        continue;
      }
      const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
      const urlKey = canonical ? canonical.toLowerCase().trim() : "";
      const rawTitle = raw.title || raw.normalizedSignal?.sourceTitle || "";
      const titleKey = rawTitle.toLowerCase().trim();
      if (!urlKey || signalSeenUrls.has(urlKey) || (titleKey && signalSeenTitles.has(titleKey))) continue;

      // Filter irrelevant or noise signals
      if (!rawTitle || rawTitle.trim().length < 5) continue;
      if (/^(untitled|unknown|test|404|not found)$/i.test(rawTitle.trim())) continue;
      if (raw.normalizedSignal?.verificationStatus === "REJECTED" || raw.normalizedSignal?.signalType === "NOISE") continue;

      const src = raw.source;
      const srcKey = src?.key || "unknown";
      const currentCount = signalSourceCounts.get(srcKey) || 0;
      if (currentCount >= maxItemsPerSourceInFeed) continue;

      signalSeenUrls.add(urlKey);
      if (titleKey) signalSeenTitles.add(titleKey);
      signalSourceCounts.set(srcKey, currentCount + 1);

      const market = deriveMarketRegion(src?.key, src?.sourceFamily);

      marketSignals.push({
        id: raw.id,
        sourceKey: src?.key || "unknown",
        sourceName: src?.name || "Market Source",
        sourceFamily: src?.sourceFamily || "COMMUNITY",
        title: rawTitle,
        excerpt: raw.normalizedSignal?.sanitizedExcerpt || (raw.rawContent ? raw.rawContent.slice(0, 280) : rawTitle),
        canonicalUrl: canonical,
        publishedAt: (raw.publishedAt instanceof Date ? raw.publishedAt : new Date(raw.publishedAt)).toISOString(),
        discoveredAt: (raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt || raw.publishedAt)).toISOString(),
        market,
        label: "Market signal — not a validated business opportunity",
      });
    }

    // Pass 2: Fill remaining slots if diverse pass did not reach signalsLimit
    if (marketSignals.length < signalsLimit) {
      for (const raw of rawSignalRecords) {
        if (marketSignals.length >= signalsLimit) break;
        if (!raw.publishedAt) continue;
        const pubTime = raw.publishedAt instanceof Date ? raw.publishedAt.getTime() : new Date(raw.publishedAt).getTime();
        if (isNaN(pubTime) || Date.now() - pubTime > 45 * 24 * 60 * 60 * 1000 || pubTime > Date.now() + 24 * 60 * 60 * 1000) {
          continue;
        }
        const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
        const urlKey = canonical ? canonical.toLowerCase().trim() : "";
        const rawTitle = raw.title || raw.normalizedSignal?.sourceTitle || "";
        const titleKey = rawTitle.toLowerCase().trim();
        if (!urlKey || signalSeenUrls.has(urlKey) || (titleKey && signalSeenTitles.has(titleKey))) continue;

        // Filter irrelevant or noise signals
        if (!rawTitle || rawTitle.trim().length < 5) continue;
        if (/^(untitled|unknown|test|404|not found)$/i.test(rawTitle.trim())) continue;
        if (raw.normalizedSignal?.verificationStatus === "REJECTED" || raw.normalizedSignal?.signalType === "NOISE") continue;

        signalSeenUrls.add(urlKey);
        if (titleKey) signalSeenTitles.add(titleKey);
        const src = raw.source;
        const market = deriveMarketRegion(src?.key, src?.sourceFamily);

        marketSignals.push({
          id: raw.id,
          sourceKey: src?.key || "unknown",
          sourceName: src?.name || "Market Source",
          sourceFamily: src?.sourceFamily || "COMMUNITY",
          title: rawTitle,
          excerpt: raw.normalizedSignal?.sanitizedExcerpt || (raw.rawContent ? raw.rawContent.slice(0, 280) : rawTitle),
          canonicalUrl: canonical,
          publishedAt: (raw.publishedAt instanceof Date ? raw.publishedAt : new Date(raw.publishedAt)).toISOString(),
          discoveredAt: (raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt || raw.publishedAt)).toISOString(),
          market,
          label: "Market signal — not a validated business opportunity",
        });
      }
    }

    const hasItemsToday =
      opportunityHypotheses.some((item) => new Date(item.discoveredAt) >= todayStart) ||
      researchLeads.some((lead) => new Date(lead.discoveredAt) >= todayStart) ||
      marketSignals.some((sig) => new Date(sig.discoveredAt) >= todayStart);

    const themesConfig = [
      {
        theme: "DevOps & Cloud Infrastructure",
        keywords: ["devops", "cloud", "aws", "kubernetes", "k8s", "docker", "ci/cd", "infrastructure", "latency", "pipeline", "network"],
        defaultAction: "Benchmark build and deployment error logs with 5 DevOps leads to validate pipeline recovery hours",
      },
      {
        theme: "Developer Tooling & Systems",
        keywords: ["developer", "code", "ide", "compiler", "extension", "visual studio", "sdk", "template", "workflow", "git", "test"],
        defaultAction: "Conduct user discovery sessions on manual tool workarounds with 5 engineering leads",
      },
      {
        theme: "Data Engineering & FinOps",
        keywords: ["data", "finops", "kafka", "database", "postgres", "query", "spend", "cost", "warehouse", "analytics", "sql", "gpu"],
        defaultAction: "Analyze query timeout patterns and audit cloud cluster teardown logs with 3 platform leads",
      },
      {
        theme: "Security & Compliance",
        keywords: ["security", "cve", "vulnerability", "auth", "compliance", "soc2", "audit", "patch", "exploit", "reachability"],
        defaultAction: "Scan staging clusters to measure exposure window and test automated mitigation rules",
      },
      {
        theme: "Embedded Systems & IoT",
        keywords: ["iot", "sensor", "firmware", "hardware", "embedded", "uart", "serial", "bus", "hvac", "rotex"],
        defaultAction: "Deploy packet-sniffing protocol prototype against 3 real hardware setups to confirm frame parsing",
      },
    ];

    const themesBrief = themesConfig.map((tc) => {
      const matchingSignals = marketSignals.filter((s) =>
        tc.keywords.some((k) => `${s.title} ${s.excerpt}`.toLowerCase().includes(k))
      );
      const matchingLeads = researchLeads.filter((l) =>
        tc.keywords.some((k) => `${l.title} ${l.summary} ${l.problemSummary || ""}`.toLowerCase().includes(k))
      );
      const matchingOpps = opportunityHypotheses.filter((h) =>
        tc.keywords.some((k) => `${h.title} ${h.summary} ${h.businessHypothesis?.painFriction || ""} ${h.businessHypothesis?.proposedSolution || ""}`.toLowerCase().includes(k))
      );

      const totalThemeItems = matchingSignals.length + matchingLeads.length + matchingOpps.length;
      let topPainHeadline = "no qualifying pain signals";
      let suggestedValidationAction = tc.defaultAction;

      if (matchingOpps.length > 0 && matchingOpps[0]) {
        topPainHeadline = matchingOpps[0].title;
        if (matchingOpps[0]?.businessHypothesis?.validationExperiment) {
          suggestedValidationAction = matchingOpps[0].businessHypothesis.validationExperiment;
        }
      } else if (matchingLeads.length > 0 && matchingLeads[0]) {
        topPainHeadline = matchingLeads[0].title;
        if (matchingLeads[0]?.concreteValidationStep) {
          suggestedValidationAction = matchingLeads[0].concreteValidationStep;
        }
      } else {
        const qualifyingSignal = matchingSignals.find((s) =>
          isConcreteProblemOrWorkaround({
            title: s.title,
            sanitizedExcerpt: s.excerpt,
            canonicalUrl: s.canonicalUrl,
            sourceKey: s.sourceKey,
            sourceFamily: s.sourceFamily,
          })
        );
        if (qualifyingSignal) {
          topPainHeadline = qualifyingSignal.title;
          suggestedValidationAction = tc.defaultAction;
        } else {
          topPainHeadline = "no qualifying pain signals";
        }
      }

      const momentum = totalThemeItems > 0
        ? `+${totalThemeItems} active signal${totalThemeItems > 1 ? "s" : ""} detected`
        : "Steady baseline monitoring";

      return {
        theme: tc.theme,
        signalsCount: matchingSignals.length,
        leadsCount: matchingLeads.length,
        corroboratedCount: matchingOpps.length,
        topPainHeadline,
        suggestedValidationAction,
        momentum,
      };
    });

    const dailyBrief = {
      date: new Date().toISOString().slice(0, 10),
      summary: `Intelligence briefing covering ${marketSignals.length} market signals, ${researchLeads.length} research leads, and ${opportunityHypotheses.length} corroborated opportunities across 5 engineering themes.`,
      themes: themesBrief,
    };

    return {
      success: true,
      totalCount: opportunityHypotheses.length + researchLeads.length + marketSignals.length,
      asOf: new Date().toISOString(),
      hasItemsToday,
      marketSignals,
      researchLeads,
      opportunityHypotheses,
      dailyBrief,
      items: opportunityHypotheses, // backwards compatibility
    };
  } catch (err: any) {
    logger.error("Failed to compile daily discovery feed", err);
    return {
      success: false,
      totalCount: 0,
      asOf: new Date().toISOString(),
      hasItemsToday: false,
      marketSignals: [],
      researchLeads: [],
      opportunityHypotheses: [],
      items: [],
    };
  }
}
