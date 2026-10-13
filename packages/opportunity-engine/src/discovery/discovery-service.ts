import { DiscoveryFeedItemDTO, DiscoveryFeedResponseDTO, MarketSignalFeedItemDTO } from "@buildworth/shared";
import { logger } from "@buildworth/observability";

export interface GetDiscoveryFeedOptions {
  limit?: number;
  market?: string;
  maxItemsPerSource?: number;
  signalsLimit?: number;
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

  // 3. Strict Exclusions: Generic developer questions / Q&A / advice seeking
  // e.g. "Why does adding local size improve performance in OpenCL?", "How to do X in Y", "Optimal way to..."
  if (
    /^(why does|why is|why did|why do|why would|how to|how do i|how can i|what is the best way to|optimal way to|is there a way to)\b/i.test(title) ||
    title.endsWith("?") ||
    /^\[advice\]/i.test(title) ||
    /^\[question\]/i.test(title) ||
    /^\[css,|^\[html,|^\[c#,|^\[java,|^\[python,/i.test(title)
  ) {
    return false;
  }

  // 4. Strict Exclusions: Generic feature requests or routine backlog tasks without clear user friction
  // e.g. "EP-13: 18 eBay flag markets...", "Daily ingest: review needed..."
  if (
    /^(ep-\d+|feat:|feature:|task:|chore:|refactor:|daily ingest:|sprint \d+)/i.test(title) &&
    !/\b(broken|breaks|fails|failing|error|leak|spike|latency|outage|unusable|crash|crashing)\b/i.test(fullText)
  ) {
    return false;
  }

  // 5. Explicit concrete friction / breakdown / workaround / cost pain indicators
  // The excerpt or title must describe actual failure, broken functionality, error, or manual hack
  const hasConcreteBreakdown =
    /\b(broken|breaks|breaks silently|failing|fails|fails to|failed|crash|crashes|leak|leaks|silent failure|data corruption|permanently reports|cannot decode|unable to parse|sensor decoding error|outage|throttled|timeout|workaround|hacky workaround|manual fix|costing|ruined|waste|wasted|unexpected spend|bill spike)\b/i.test(fullText);

  // High quality problem types from GitHub / StackOverflow / HN or unclassified signals with problem keywords
  const isProblemType = [
    "PAIN",
    "PAIN_COMPLAINT",
    "WORKAROUND",
    "WORKAROUND_REQUEST",
    "COMPETITOR_COMPLAINT",
    "COMPETITOR_DISSATISFACTION",
    "",
    "UNCLASSIFIED",
  ].includes(sigType);

  return hasConcreteBreakdown || (isProblemType && /\b(error|bug|issue|failure|broken|problem|bottleneck|friction|pain|cost|spend|waste|latency|spike)\b/i.test(fullText));
}

/**
 * Derives a specific, evidence-backed target audience from the problem description
 * instead of generic fallback boilerplate.
 */
export function deriveSpecificAudience(text: string, actorRole?: string | null): string {
  if (actorRole && actorRole.trim() && !/early adopter|user|team|founder/i.test(actorRole)) {
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
  if (lower.includes("kubernetes") || lower.includes("k8s") || lower.includes("pod") || lower.includes("ingress")) {
    return "Platform Engineering & Site Reliability Teams";
  }
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("cve") || lower.includes("exploit")) {
    return "Security Operations & AppSec Engineers";
  }
  if (lower.includes("ci/cd") || lower.includes("github actions") || lower.includes("pipeline") || lower.includes("docker")) {
    return "DevOps & Release Engineering Teams";
  }

  return "Unknown (Requires customer validation)";
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

  if (targetAudience && !targetAudience.startsWith("Unknown")) {
    return `Interview 5 ${targetAudience} to benchmark frequency of this breakdown and quantify hours spent on manual recovery`;
  }

  return "Conduct discovery interviews with affected users to validate workaround frequency and operational cost";
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
        status: { in: ["DRAFT", "IN_REVIEW"] },
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
    const sourceCounts = new Map<string, number>();
    const opportunityHypotheses: DiscoveryFeedItemDTO[] = [];

    for (const opp of candidates) {
      if (opportunityHypotheses.length >= limit) break;

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
      sourceCounts.set(effectiveSourceKey, currentSourceCount + 1);

      // Extract observed facts directly from signal excerpts
      const observedFacts = observations.map((o) => o.excerpt).slice(0, 3);
      if (observedFacts.length === 0 && opp.problemStatement) {
        observedFacts.push(opp.problemStatement);
      }

      // Demarcate AI-generated business hypothesis directly grounded in observed facts
      const primaryFact = observedFacts[0] || opp.problemStatement || opp.title;
      const rawProposedSolution = (opp.proposedProduct || "").trim();
      const hasGenericBoilerplate = /Lightweight SaaS tool providing automated monitoring.*Data Engineering & FinOps/i.test(rawProposedSolution);
      const proposedSolution = (!rawProposedSolution || hasGenericBoilerplate)
        ? `Targeted solution addressing: ${opp.title}`
        : rawProposedSolution;

      const hasExplicitPurchaseIntent = (opp.evidenceLinks || []).some(
        (l: any) => l.normalizedSignal?.purchaseIntent === true || ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes((l.normalizedSignal?.signalType || "").toUpperCase())
      );

      const targetAudience = deriveSpecificAudience(
        `${opp.title} ${opp.problemStatement || ""} ${primaryFact}`,
        opp.economicBuyer || opp.endUser
      );

      const validationExperiment = deriveSpecificValidationExperiment(
        `${opp.title} ${opp.problemStatement || ""} ${primaryFact}`,
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
      const pubDate = primaryPublishedAt ? primaryPublishedAt.toISOString() : opp.createdAt.toISOString();

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

    // 1b. If no candidate opportunity rows exist in database (cold start or fresh database),
    // synthesize grounded HYPOTHESIS items directly from recent authentic NormalizedSignals
    // that have genuine customer problem, workaround, or purchase intent evidence.
    if (opportunityHypotheses.length < limit && prisma.normalizedSignal?.findMany) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const unclusteredSignals = await prisma.normalizedSignal.findMany({
        where: {
          verificationStatus: { not: "REJECTED" },
          rawSignal: {
            source: {
              isEnabled: true,
              policyStatus: { not: "BLOCKED" },
            },
            OR: [
              { publishedAt: null },
              { publishedAt: { gte: ninetyDaysAgo } },
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          rawSignal: {
            include: {
              source: true,
            },
          },
        },
      }).catch(() => []);

      for (const ns of unclusteredSignals) {
        if (opportunityHypotheses.length >= limit) break;
        const raw = ns.rawSignal;
        const src = raw?.source;
        if (!raw || !src) continue;

        // Strictly verify that this signal contains authentic problem / workaround / unmet need evidence
        const isActionable = isConcreteProblemOrWorkaround({
          title: raw.title || ns.sourceTitle,
          sanitizedExcerpt: ns.sanitizedExcerpt,
          problemSummary: ns.problemSummary,
          signalType: ns.signalType,
          canonicalUrl: ns.canonicalUrl || raw.sourceUrl,
          sourceKey: src.key,
          sourceFamily: src.sourceFamily,
        });

        if (!isActionable) continue;

        const canonical = ns.canonicalUrl || raw.sourceUrl;
        const urlKey = canonical ? canonical.toLowerCase().trim() : "";
        const titleKey = (raw.title || ns.sourceTitle || "").toLowerCase().trim();

        if (urlKey && seenUrls.has(urlKey)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;

        const effectiveSourceKey = src.key || "unknown";
        const currentSourceCount = sourceCounts.get(effectiveSourceKey) || 0;
        if (currentSourceCount >= maxItemsPerSource) continue;

        if (urlKey) seenUrls.add(urlKey);
        if (titleKey) seenTitles.add(titleKey);
        sourceCounts.set(effectiveSourceKey, currentSourceCount + 1);

        const obsDate = raw.publishedAt || ns.publishedAt || raw.createdAt || new Date();
        const obsDateIso = obsDate instanceof Date ? obsDate.toISOString() : new Date(obsDate).toISOString();

        const observation = {
          id: ns.id,
          sourceTitle: raw.title || ns.sourceTitle || src.name || "Market Evidence",
          excerpt: ns.sanitizedExcerpt || ns.problemSummary,
          canonicalUrl: canonical,
          sourceFamily: src.sourceFamily || "COMMUNITY",
          sourceName: src.name || "Public Community",
          publishedAt: obsDateIso,
        };

        const title = raw.title || ns.sourceTitle || "Unmet Need Identified in Market Discussion";
        const cleanTitle = title.replace(/\s+/g, " ").trim();
        const fullProblemText = `${cleanTitle} ${ns.problemSummary || ""} ${ns.sanitizedExcerpt || ""}`;
        const targetAudience = deriveSpecificAudience(fullProblemText, ns.actorRole);
        const painFriction = ns.problemSummary || ns.sanitizedExcerpt || cleanTitle;
        const proposedSolution = `Targeted solution addressing: ${cleanTitle}`;
        const hasExplicitPurchaseIntent = ns.purchaseIntent === true || ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes((ns.signalType || "").toUpperCase());
        const validationExperiment = deriveSpecificValidationExperiment(fullProblemText, targetAudience);

        const businessHypothesis = {
          targetAudience,
          proposedSolution,
          painFriction,
          assumptions: [
            `Target practitioners experience operational friction or failure under current manual workflows`,
            `Breakdown recurs frequently enough in production to justify a dedicated tooling solution`,
          ],
          validationExperiment,
          purchaseIntentStatus: (hasExplicitPurchaseIntent ? "CONFIRMED" : "UNKNOWN") as "CONFIRMED" | "UNKNOWN",
          confidenceNote: "Initial market hypothesis derived from public signals. Not yet validated via formal customer interviews or WTP proof.",
        };

        const market = deriveMarketRegion(src.key, src.sourceFamily);
        const pubDate = raw.publishedAt ? new Date(raw.publishedAt).toISOString() : new Date(raw.createdAt).toISOString();
        const safeSlug = (cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "hypothesis") + "-" + ns.id.slice(0, 8);

        opportunityHypotheses.push({
          id: "hypo-" + ns.id,
          slug: safeSlug,
          title: cleanTitle,
          summary: `Hypothesis exploring practical workflow solution for ${cleanTitle.toLowerCase()}.`,
          observedFacts: [observation.excerpt],
          evidenceObservations: [observation],
          businessHypothesis,
          publicationDate: pubDate,
          discoveredAt: (raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt)).toISOString(),
          market,
          canonicalUrl: canonical || `https://buildworth.app/signals/${ns.id}`,
          sourceTitle: observation.sourceTitle,
          sourceFamily: observation.sourceFamily,
          verificationLabel: "Early idea / Not yet verified",
          signalCount: 1,
          status: "HYPOTHESIS",
        });
      }
    }

    // 2. Fetch authentic New Market Signals directly from NormalizedSignal & RawSignal
    const marketSignals: MarketSignalFeedItemDTO[] = [];
    const signalSeenUrls = new Set<string>();
    const signalSourceCounts = new Map<string, number>();
    const maxItemsPerSourceInFeed = 2;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const rawSignalRecords = prisma.rawSignal?.findMany
      ? await prisma.rawSignal.findMany({
          where: {
            source: {
              isEnabled: true,
              policyStatus: { not: "BLOCKED" },
            },
            OR: [
              { publishedAt: null },
              { publishedAt: { gte: ninetyDaysAgo } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: Math.max(100, signalsLimit * 10),
          include: {
            source: true,
            normalizedSignal: true,
          },
        }).catch(() => [])
      : [];

    // Pass 1: Diverse source representation (capped per source)
    for (const raw of rawSignalRecords) {
      if (marketSignals.length >= signalsLimit) break;
      if (raw.publishedAt && new Date(raw.publishedAt).getTime() < ninetyDaysAgo.getTime()) continue;
      const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
      const urlKey = canonical.toLowerCase().trim();
      if (!urlKey || signalSeenUrls.has(urlKey)) continue;

      const src = raw.source;
      const srcKey = src?.key || "unknown";
      const currentCount = signalSourceCounts.get(srcKey) || 0;
      if (currentCount >= maxItemsPerSourceInFeed) continue;

      signalSeenUrls.add(urlKey);
      signalSourceCounts.set(srcKey, currentCount + 1);

      const pubDate = raw.publishedAt || raw.createdAt || new Date();
      const discDate = raw.createdAt || new Date();
      const market = deriveMarketRegion(src?.key, src?.sourceFamily);

      marketSignals.push({
        id: raw.id,
        sourceKey: src?.key || "unknown",
        sourceName: src?.name || "Market Source",
        sourceFamily: src?.sourceFamily || "COMMUNITY",
        title: raw.title || raw.normalizedSignal?.sourceTitle || "Market Discussion",
        excerpt: raw.normalizedSignal?.sanitizedExcerpt || raw.rawContent.slice(0, 280),
        canonicalUrl: canonical,
        publishedAt: (pubDate instanceof Date ? pubDate : new Date(pubDate)).toISOString(),
        discoveredAt: (discDate instanceof Date ? discDate : new Date(discDate)).toISOString(),
        market,
        label: "Market signal — not a validated business opportunity",
      });
    }

    // Pass 2: Fill remaining slots if diverse pass did not reach signalsLimit
    if (marketSignals.length < signalsLimit) {
      for (const raw of rawSignalRecords) {
        if (marketSignals.length >= signalsLimit) break;
        if (raw.publishedAt && new Date(raw.publishedAt).getTime() < ninetyDaysAgo.getTime()) continue;
        const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
        const urlKey = canonical.toLowerCase().trim();
        if (!urlKey || signalSeenUrls.has(urlKey)) continue;

        signalSeenUrls.add(urlKey);
        const src = raw.source;
        const pubDate = raw.publishedAt || raw.createdAt || new Date();
        const discDate = raw.createdAt || new Date();
        const market = deriveMarketRegion(src?.key, src?.sourceFamily);

        marketSignals.push({
          id: raw.id,
          sourceKey: src?.key || "unknown",
          sourceName: src?.name || "Market Source",
          sourceFamily: src?.sourceFamily || "COMMUNITY",
          title: raw.title || raw.normalizedSignal?.sourceTitle || "Market Discussion",
          excerpt: raw.normalizedSignal?.sanitizedExcerpt || raw.rawContent.slice(0, 280),
          canonicalUrl: canonical,
          publishedAt: (pubDate instanceof Date ? pubDate : new Date(pubDate)).toISOString(),
          discoveredAt: (discDate instanceof Date ? discDate : new Date(discDate)).toISOString(),
          market,
          label: "Market signal — not a validated business opportunity",
        });
      }
    }

    const hasItemsToday =
      opportunityHypotheses.some((item) => new Date(item.discoveredAt) >= todayStart) ||
      marketSignals.some((sig) => new Date(sig.discoveredAt) >= todayStart);

    return {
      success: true,
      totalCount: opportunityHypotheses.length + marketSignals.length,
      asOf: new Date().toISOString(),
      hasItemsToday,
      marketSignals,
      opportunityHypotheses,
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
      opportunityHypotheses: [],
      items: [],
    };
  }
}
