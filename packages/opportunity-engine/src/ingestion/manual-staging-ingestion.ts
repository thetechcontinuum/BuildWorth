import crypto from "crypto";
import {
  sourceRegistry,
  sanitizeRawContent,
  deriveIndependenceKey,
  computeContentHash,
  canonicalizeUrl,
} from "@buildworth/source-connectors";
import { defaultAI } from "@buildworth/ai";
import type { LLMProvider } from "@buildworth/ai";
import type {
  CustomerSegmentItem,
  MvpFeatureItem,
  CompetitorItem,
  CostLineItemData,
  BenefitDriverData,
  RiskItem,
  AssumptionItem,
  ValidationExperimentItem,
  ClaimEvidenceLinkItem,
  EvidenceSignalItem,
  ClaimType,
} from "@buildworth/shared";
import { evaluatePublicationQuality } from "@buildworth/validation";
import { classifySignal } from "../classifier.js";
import { extractSignalIntelligence } from "../extractor.js";
import { clusterSignals, ClusterCandidate, ProblemClusterResult } from "../clustering/cluster-manager.js";
import { cosineSimilarity } from "../clustering/vector-math.js";
import { synthesizeOpportunity } from "../synthesizer.js";
import { createOpportunityRevisionTransaction } from "../revision/revision-service.js";
import {
  isConcreteProblemOrWorkaround,
  deriveSpecificAudience,
  derivePlausibleProductDirection,
  deriveSpecificValidationExperiment,
  deriveEvidenceGaps,
  signalsSupportSameProblem,
} from "../discovery/discovery-service.js";
import { logger } from "@buildworth/observability";

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim());
  const bufB = Buffer.from(b.trim());
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface ManualIngestionOptions {
  idempotencyKey: string;
  workerId?: string;
  leaseDurationMs?: number;
  maxSources?: number;
  maxFetchItems?: number;
  maxRawSignals?: number;
  maxCandidates?: number;
  maxClassifiedSignals?: number;
  maxHistoricalSignals?: number;
  maxPublishedOpportunities?: number;
  targetSourceKeys?: string[];
  targetQueries?: string[];
  aiProvider?: LLMProvider;
  executionTimeoutMs?: number;
  cleanSyntheticPrior?: boolean;
  forceRetry?: boolean;
}


export interface ManualIngestionRunResult {
  runId: string;
  idempotencyKey: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  failureCode?: string | null;
  errorMessage?: string | null;
  isExisting?: boolean;
  counters: {
    fetched: number;
    deduplicated: number;
    rawSignals: number;
    rejected: number;
    candidates: number;
    published: number;
  };
  publishedSlugs: string[];
  startedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  summary?: any;
}

const ALLOWLISTED_SOURCE_KEYS = [
  "hackernews",
  "reddit",
  "github",
  "producthunt",
  "krasia",
  "e27",
  "eustartups",
  "siliconcanals",
  "lobsters",
  "techcrunch",
  "ted",
  "samgov",
  "stackexchange",
  "cisakev",
  "arxiv",
];

export function formatMeaningfulTitle(text: string, maxLen = 75): string {
  const cleaned = text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^Ask HN:\s*/i, "")
    .replace(/^Feature Request:\s*/i, "")
    .replace(/[.]+$/, "")
    .trim();

  if (cleaned.length <= maxLen) return cleaned;

  const sub = cleaned.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 20) {
    return sub.slice(0, lastSpace).trim();
  }
  return sub.trim();
}

export function generateCollisionSafeSlug(title: string, nonce?: string): string {
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "opportunity";
  if (nonce) {
    base = `${base}-${nonce}`;
  }
  return base;
}

export function extractTargetQueries(problemTexts: string[]): string[] {
  const queries: string[] = [];
  const stopWords = new Set([
    "the", "and", "or", "to", "in", "of", "a", "an", "is", "for", "with", "on", "at", "by", "from",
    "up", "about", "into", "over", "after", "how", "what", "why", "when", "where", "which", "who",
    "can", "could", "should", "would", "do", "does", "did", "have", "has", "had", "be", "been",
    "being", "their", "them", "they", "our", "we", "us", "you", "your", "my", "me", "i", "it", "its",
    "this", "that", "these", "those", "tool", "tools", "using", "use", "process", "manual", "causing",
    "recurring", "issues", "problem", "challenges", "friction", "without", "complex",
    "custom", "scripts", "delays", "vague", "question", "value", "harnesses", "industry", "context"
  ]);

  for (const text of problemTexts) {
    if (!text || typeof text !== "string") continue;
    if (/vague question about|without industry context/i.test(text)) continue;
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
    if (words.length >= 2) {
      const distinctWords = Array.from(new Set(words));
      for (let i = 0; i < distinctWords.length - 1 && queries.length < 5; i += 2) {
        const pair = distinctWords.slice(i, i + 2).join(" ");
        if (pair && !queries.includes(pair)) {
          queries.push(pair);
        }
      }
      const fullQuery = distinctWords.slice(0, 3).join(" ");
      if (fullQuery && !queries.includes(fullQuery) && queries.length < 5) {
        queries.push(fullQuery);
      }
    }
  }

  return queries.slice(0, 4);
}

export const KNOWN_SYNTHETIC_FIXTURE_EXTERNAL_IDS = [
  "gh-issue-98214",
  "hn-38491021",
  "hn-39210044",
  "rd-1f92a10",
  "ph-post-7712",
];

export const KNOWN_SYNTHETIC_FIXTURE_URLS = [
  "https://github.com/example-org/devops-tools/issues/98214",
  "https://news.ycombinator.com/item?id=38491021",
  "https://news.ycombinator.com/item?id=39210044",
  "https://reddit.com/r/devops/comments/1f92a10",
  "https://producthunt.com/posts/example-saas-tool#comment-889",
  "https://producthunt.com/posts/example-devops-tool",
];

async function deleteOpportunityAndDependents(prisma: any, oppId: string): Promise<void> {
  await prisma.evidenceLink?.deleteMany?.({
    where: { OR: [{ opportunityId: oppId }, { opportunityRevision: { opportunityId: oppId } }] },
  }).catch(() => {});

  await prisma.scoreDimension?.deleteMany?.({
    where: { scorecard: { opportunityId: oppId } },
  }).catch(() => {});

  await prisma.scorecard?.deleteMany?.({
    where: { opportunityId: oppId },
  }).catch(() => {});

  await prisma.savedOpportunity?.deleteMany?.({
    where: { opportunityId: oppId },
  }).catch(() => {});

  await prisma.opportunityChangeEvent?.deleteMany?.({
    where: { opportunityId: oppId },
  }).catch(() => {});

  await prisma.opportunityBlueprint?.deleteMany?.({
    where: { revision: { opportunityId: oppId } },
  }).catch(() => {});

  await prisma.opportunityRevision?.deleteMany?.({
    where: { opportunityId: oppId },
  }).catch(() => {});

  await prisma.opportunity?.delete?.({
    where: { id: oppId },
  }).catch(() => {});
}

/**
 * Cleans the previous synthetic staging opportunity, invalid meta-critique records, and associated synthetic test records.
 */
export async function cleanSyntheticStagingOpportunity(prisma: any): Promise<{
  cleanedOpportunities: number;
  cleanedRawSignals: number;
  cleanedNormalizedSignals: number;
}> {
  const syntheticSlugs = [
    "manual-reconciliation-process-causing-recurring-quarterly-de",
    "vague-question-about-value-of-harnesses-without-industry-c",
  ];

  let cleanedOpportunities = 0;
  let cleanedRawSignals = 0;
  let cleanedNormalizedSignals = 0;

  for (const slug of syntheticSlugs) {
    const opp = await prisma.opportunity.findUnique({
      where: { slug },
      select: { id: true },
    }).catch(() => null);

    if (opp) {
      await deleteOpportunityAndDependents(prisma, opp.id);
      cleanedOpportunities++;
    }
  }

  // Also clean any non-demo opportunity whose title/slug/problem is a meta-critique ("vague question about...")
  try {
    const allOpps = await prisma.opportunity.findMany({
      where: { isDemoFixture: false },
      select: { id: true, slug: true, title: true, problemStatement: true },
      take: 25,
    }).catch(() => []);
    for (const o of allOpps) {
      const combined = `${o.slug || ""} ${o.title || ""} ${o.problemStatement || ""}`;
      if (/vague-question-about|^vague question about|without industry context/i.test(combined)) {
        await deleteOpportunityAndDependents(prisma, o.id);
        cleanedOpportunities++;
      }
    }
  } catch {}

  // Clean old test raw and normalized signals demonstrably produced by removed adapter fixtures
  const rawList = await prisma.rawSignal.findMany({
    where: {
      OR: [
        { sourceUrl: { in: KNOWN_SYNTHETIC_FIXTURE_URLS } },
        { externalId: { in: KNOWN_SYNTHETIC_FIXTURE_EXTERNAL_IDS } },
      ],
    },
  }).catch(() => []);

  for (const raw of rawList) {
    await prisma.evidenceLink?.deleteMany?.({
      where: { normalizedSignal: { rawSignalId: raw.id } },
    }).catch(() => {});
    await prisma.normalizedSignal?.deleteMany?.({
      where: { rawSignalId: raw.id },
    }).catch(() => {});
    await prisma.rawSignal?.delete?.({
      where: { id: raw.id },
    }).catch(() => {});
    cleanedRawSignals++;
    cleanedNormalizedSignals++;
  }

  return { cleanedOpportunities, cleanedRawSignals, cleanedNormalizedSignals };
}

export function determineEmpiricalClaimType(
  signalType?: string | null,
  sanitizedExcerpt?: string | null,
  actorRole?: string | null,
): ClaimType {
  const text = `${sanitizedExcerpt || ""}`.toLowerCase();

  // Pricing/budget keywords alone cannot verify WILLINGNESS_TO_PAY: require explicit purchase intent attributable to a prospective buyer.
  // Explicit willingness to pay requires buyer commitment phrases like "willing to pay", "would pay $X", "budget allocated of $X", etc.
  const hasExplicitBuyerCommitment =
    /\b(willing to pay|i('d| would) pay(\b| \d|\$)|pay (up to|\$)|shut up and take my money|credit card ready|paying customer)\b/i.test(text);

  if (hasExplicitBuyerCommitment) {
    return "WILLINGNESS_TO_PAY";
  }

  // Explicit buyer demand phrases or official procurement tenders
  const hasBuyerDemand =
    /\b(looking for a tool|need a solution|any tool for|does anyone know a tool|would love a tool|desperately need)\b/i.test(text) ||
    signalType === "PROCUREMENT" ||
    /\b(procurement|tender notice|invitation to tender|contract notice|solicitation)\b/i.test(text);

  if (hasBuyerDemand) {
    return "BUYER_DEMAND";
  }

  if (signalType === "EMERGING_TECH" || signalType === "TECHNOLOGY_ENABLER") {
    return "TECHNICAL_FEASIBILITY";
  }

  if (actorRole && /lead|head of|vp|director|manager|founder|cto|ciso|engineer|devops/i.test(actorRole)) {
    if (signalType === "BUYER_IDENTITY" || /as a (devops|engineer|cto|founder|vp|lead)/i.test(text)) {
      return "BUYER_IDENTITY";
    }
  }

  if (signalType === "WORKAROUND" || /hacky script|workaround|spreadsheet|manual script|custom script/i.test(text)) {
    return "CURRENT_WORKAROUND";
  }

  return "PAIN_EXISTENCE";
}

export function buildEmpiricalClaimLinks(
  verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }>,
): ClaimEvidenceLinkItem[] {
  return verifiedSignals.map((vs, idx) => {
    const claimType = determineEmpiricalClaimType(
      vs.normalizedSignal.signalType,
      vs.normalizedSignal.sanitizedExcerpt,
      vs.normalizedSignal.actorRole,
    );

    const indKey =
      vs.normalizedSignal.independenceKey ||
      deriveIndependenceKey(
        vs.rawSignal.authorFingerprint || `auth-${vs.rawSignal.id}`,
        vs.rawSignal.sourceUrl,
        vs.source.key,
      );

    const sourceFam =
      vs.source.sourceFamily ||
      (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : "COMMUNITY");

    const signalItem: EvidenceSignalItem = {
      id: vs.normalizedSignal.id || `sig-${idx}`,
      sourceId: vs.source.id,
      sourceTitle: vs.source.name,
      sourceFamily: sourceFam,
      canonicalUrl: vs.normalizedSignal.canonicalUrl || vs.rawSignal.sourceUrl,
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt: vs.normalizedSignal.sanitizedExcerpt || vs.rawSignal.rawContent,
      problemSummary: vs.normalizedSignal.problemSummary || vs.rawSignal.title || "Empirical signal",
      actorRole: vs.normalizedSignal.actorRole || null,
      workflowContext: vs.normalizedSignal.workflowContext || null,
      language: "en",
      evidenceQuality: 80,
      recencyScore: 80,
      credibilityScore: 80,
      independenceKey: indKey,
      independenceConfidence: 1.0,
      collectedAt: vs.rawSignal.createdAt ? new Date(vs.rawSignal.createdAt).toISOString() : new Date().toISOString(),
      publishedAt: vs.rawSignal.publishedAt ? new Date(vs.rawSignal.publishedAt).toISOString() : new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: vs.normalizedSignal.purchaseIntent || false,
      signalType: vs.normalizedSignal.signalType || "PAIN_COMPLAINT",
    };

    return {
      id: `link-${vs.normalizedSignal.id || idx}`,
      normalizedSignalId: vs.normalizedSignal.id,
      claimType,
      claimIdentifier: `claim-${claimType.toLowerCase()}-${vs.normalizedSignal.id}`,
      claimSnippet: vs.normalizedSignal.sanitizedExcerpt || vs.rawSignal.rawContent || "Empirical signal evidence",
      relationshipType: "SUPPORTS",
      supportStrength: "STRONG",
      explanation: `Empirically verified from ${vs.source.name} (${vs.rawSignal.sourceUrl})`,
      relevanceScore: 0.9,
      signal: signalItem,
    };
  });
}

function deriveDomainAlternatives(problemText: string): {
  competitors: string[];
  weaknesses: string[];
  existingWorkflow: string;
} {
  const lower = problemText.toLowerCase();
  if (lower.includes("kafka") || lower.includes("partition") || lower.includes("consumer lag") || lower.includes("streaming")) {
    return {
      competitors: [
        "Confluent Control Center (enterprise tier)",
        "Prometheus + custom JMX exporter rules",
        "Manual Kafka consumer offset CLI scripts",
      ],
      weaknesses: [
        "High enterprise licensing cost for basic lag triage",
        "Fragile custom JMX alert thresholds that miss silent rebalances",
        "Manual partition recovery requires on-call intervention",
      ],
      existingWorkflow: "Engineers manually inspect consumer group offsets via CLI and run custom rebalance scripts during incidents",
    };
  }
  if (lower.includes("kubernetes") || lower.includes("k8s") || lower.includes("container") || lower.includes("oom") || lower.includes("pod") || lower.includes("eks")) {
    return {
      competitors: [
        "Datadog Container Monitoring (high per-node pricing)",
        "Prometheus + Alertmanager custom YAML rules",
        "Manual kubectl rollout & cron restart scripts",
      ],
      weaknesses: [
        "Per-host telemetry overages scale unpredictably",
        "Reactive OOM alerts fire only after pod termination",
        "Custom cron restart workarounds mask underlying memory leaks",
      ],
      existingWorkflow: "SREs maintain custom healthcheck scripts and manually inspect pod eviction logs after OOM crashes",
    };
  }
  if (lower.includes("postgres") || lower.includes("database") || lower.includes("sql") || lower.includes("schema") || lower.includes("migration") || lower.includes("connection pool")) {
    return {
      competitors: [
        "Liquibase / Flyway Enterprise",
        "PgBouncer + custom connection watchdog scripts",
        "Native cloud RDS Performance Insights",
      ],
      weaknesses: [
        "Lack of automated pre-deploy query regression interception",
        "Manual schema drift reconciliation across staging environments",
        "Connection pool exhaustion requires manual backend restarts",
      ],
      existingWorkflow: "Backend engineers manually review migration SQL and run ad-hoc connection cleanup scripts during traffic spikes",
    };
  }
  if (lower.includes("soc2") || lower.includes("compliance") || lower.includes("audit") || lower.includes("iam") || lower.includes("security")) {
    return {
      competitors: [
        "Vanta / Drata enterprise compliance suites",
        "Manual AWS CLI & screenshot evidence spreadsheets",
        "Custom CI compliance check scripts",
      ],
      weaknesses: [
        "Annual enterprise contracts starting at $15k+/yr",
        "Manual screenshot gathering consumes days of engineering time per audit",
        "Point-in-time checks miss continuous IAM drift",
      ],
      existingWorkflow: "Engineering leads manually export IAM configs and collect terminal screenshots into shared spreadsheets before audits",
    };
  }
  if (lower.includes("finops") || lower.includes("billing") || lower.includes("cloud cost") || lower.includes("gpu") || lower.includes("spend")) {
    return {
      competitors: [
        "Vantage / CloudHealth enterprise FinOps platforms",
        "Native AWS Cost Explorer & billing alarms",
        "Manual spreadsheet tag & invoice reconciliation",
      ],
      weaknesses: [
        "Billing alerts lag 12–24 hours behind runaway compute spikes",
        "Percentage-of-spend enterprise fees deter mid-sized teams",
        "Manual cost attribution across shared clusters is error-prone",
      ],
      existingWorkflow: "Platform leads export monthly cloud billing CSVs and manually reconcile untagged resources in spreadsheets",
    };
  }
  return {
    competitors: [
      "Manual custom scripts and cron workarounds",
      "Internal ad-hoc operational runbooks",
      "Incumbent enterprise suites lacking targeted workflow automation",
    ],
    weaknesses: [
      "High ongoing manual maintenance overhead across engineering sprints",
      "Fragile custom scripts with silent failures and no alerting",
      "Enterprise platforms require complex setup and high annual commitments",
    ],
    existingWorkflow: "Practitioners rely on unmaintained custom scripts and manual operational handoffs when workflows fail",
  };
}

function deriveSupportedCommercialIndicators(
  verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }>,
): {
  evidenceOfDemand: string;
  evidenceOfWillingnessToPay: string;
  hasExplicitWtp: boolean;
  distinctSourcesCount: number;
  opportunityScore: number;
  evidenceConfidenceScore: number;
} {
  const sourceNames = Array.from(
    new Set(verifiedSignals.map((vs) => vs.source?.name || vs.source?.key || "Public Source")),
  );
  const distinctSourceKeys = new Set(
    verifiedSignals.map((vs) => {
      const url = String(vs.rawSignal?.sourceUrl || vs.normalizedSignal?.canonicalUrl || "").toLowerCase();
      const ghRepo = url.match(/github\.com\/([^/]+\/[^/]+)/);
      if (ghRepo) return `gh:${ghRepo[1]}`;
      return vs.source?.key || url;
    }),
  );
  const distinctSourcesCount = Math.max(1, distinctSourceKeys.size);
  const combinedText = verifiedSignals
    .map((vs) => `${vs.rawSignal?.title || ""} ${vs.normalizedSignal?.sanitizedExcerpt || ""} ${vs.normalizedSignal?.problemSummary || ""}`)
    .join(" ");

  const hasExplicitWtp = verifiedSignals.some(
    (vs) =>
      vs.normalizedSignal?.purchaseIntent === true ||
      ["PURCHASE_INTENT", "WILLINGNESS_TO_PAY", "PROCUREMENT"].includes(String(vs.normalizedSignal?.signalType || "").toUpperCase()) ||
      /\b(willing to pay|would pay|budget|paid tool|commercial alternative|procurement|tender)\b/i.test(
        `${vs.normalizedSignal?.sanitizedExcerpt || ""}`,
      ),
  );

  const hasQuantifiedWaste = /\b(\$\d+|hours|days|weeks|downtime|outage|every day|daily|weekly|recurring|bill spike|costing)\b/i.test(
    combinedText,
  );

  const evidenceOfDemand =
    distinctSourcesCount >= 2
      ? `Corroborated across ${verifiedSignals.length} signals from ${distinctSourcesCount} independent sources (${sourceNames.join(", ")}) reporting recurring operational friction and manual workarounds.`
      : `Observed in ${verifiedSignals.length} signal(s) from ${sourceNames.join(", ")} documenting concrete workflow breakdown and manual recovery overhead.`;

  const evidenceOfWillingnessToPay = hasExplicitWtp
    ? `Direct commercial intent or procurement budget indicator observed in cited source evidence (${sourceNames.join(", ")}).`
    : hasQuantifiedWaste
      ? `No direct buyer price commitment observed yet; commercial indicator is inferred from documented operational downtime, cloud waste, or engineering hours spent on manual workarounds.`
      : `Unverified willingness to pay (early hypothesis): requires direct customer discovery interviews to confirm budget priority.`;

  const avgConfidence =
    verifiedSignals.reduce((acc, vs) => acc + (Number(vs.normalizedSignal?.confidenceScore) || 75), 0) /
    Math.max(1, verifiedSignals.length);

  const evidenceConfidenceScore = Math.min(
    88,
    Math.max(
      45,
      Math.round(
        avgConfidence * 0.55 +
          Math.min(20, verifiedSignals.length * 7) +
          (distinctSourcesCount >= 2 ? 12 : 0) +
          (hasExplicitWtp ? 8 : 0),
      ),
    ),
  );

  const opportunityScore = Math.min(
    89,
    Math.max(
      55,
      Math.round(
        54 +
          Math.min(14, verifiedSignals.length * 5) +
          (distinctSourcesCount >= 2 ? 9 : 0) +
          (hasQuantifiedWaste ? 6 : 0) +
          (hasExplicitWtp ? 6 : 0),
      ),
    ),
  );

  return {
    evidenceOfDemand,
    evidenceOfWillingnessToPay,
    hasExplicitWtp,
    distinctSourcesCount,
    opportunityScore,
    evidenceConfidenceScore,
  };
}

async function createCandidateWithRevisionAndLinks(
  prisma: any,
  oppData: any,
  blueprint: any,
  verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }>,
  isVerified: boolean,
) {
  const opp = await prisma.opportunity.create({
    data: oppData,
  });

  const oppScore = blueprint.scorecard?.opportunityScore || 68;
  const confScore = blueprint.scorecard?.evidenceConfidenceScore || 62;

  await prisma.scorecard.create({
    data: {
      opportunityId: opp.id,
      opportunityScore: oppScore,
      evidenceConfidenceScore: confScore,
      demandScore: Math.min(90, Math.max(45, oppScore - 4)),
      feasibilityScore: 84,
      economicsScore: 78,
      competitionScore: 75,
      goMarketScore: 76,
      rubricVersion: "2.0.0",
      isHypothesisOnly: !isVerified,
    },
  });

  const customerSegments: CustomerSegmentItem[] = blueprint.targetCustomerSegments.map((name: string) => ({
    id: "seg-" + crypto.randomUUID(),
    segmentName: name,
    industry: oppData.industry,
    companySizeRange: "10-250 employees",
    geography: "Global / Remote",
    businessModel: "B2B SaaS",
    economicBuyerRole: blueprint.economicBuyer,
    endUserRole: blueprint.endUser,
    procurementComplexity: "LOW",
    budgetCategory: "ENGINEERING_TOOLS",
    spendingBehavior: "CREDIT_CARD",
    buyingTrigger: blueprint.buyingTrigger,
    primaryObjection: "Budget and integration bandwidth",
    acquisitionChannels: ["GITHUB", "COMMUNITY"],
    salesCycleMinDays: 7,
    salesCycleMaxDays: 30,
    salesMotion: "FOUNDER_LED",
    confidenceScore: confScore,
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const mvpFeatures: MvpFeatureItem[] = blueprint.narrowMvpScope.map((name: string, idx: number) => ({
    id: "feat-" + crypto.randomUUID(),
    featureName: name,
    description: name,
    category: "MUST_HAVE",
    userJourneyStep: "ONBOARDING",
    requiredIntegrations: ["GITHUB_ACTIONS"],
    requiredData: ["PULL_REQUEST_METADATA"],
    dependencies: [],
    acceptanceCriteria: ["Validates within 5 minutes"],
    orderIndex: idx,
  }));

  const competitors: CompetitorItem[] = (blueprint.existingCompetitors || []).map((name: string, idx: number) => ({
    id: "comp-" + crypto.randomUUID(),
    name,
    competitorType: idx === 0 ? "DIRECT" : "WORKAROUND",
    differentiationHypothesis: blueprint.competitorWeaknesses?.[idx] || blueprint.competitorWeaknesses?.[0] || "Lightweight and automated",
    switchingCosts: "MEDIUM",
    strengths: ["Existing adoption in engineering workflows"],
    recurringComplaints: [blueprint.competitorWeaknesses?.[idx] || "High manual maintenance or enterprise cost"],
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const costs: CostLineItemData[] = [
    {
      id: "cost-" + crypto.randomUUID(),
      costType: "ONE_TIME_BUILD",
      category: "BACKEND_DEV",
      title: "MVP Engineering Build",
      scenarioType: "BASE",
      amountMinorCents: blueprint.economics.estimatedMvpCost.minMinor,
      currency: "USD",
      estimateMethod: "Engineering hours benchmark",
      provenanceType: "MODEL_ESTIMATE",
      evidenceLinkIds: [],
      assumptionIds: [],
      confidenceScore: confScore,
    },
  ];

  const benefits: BenefitDriverData[] = [
    {
      id: "ben-" + crypto.randomUUID(),
      category: "LABOR_TIME_SAVED",
      title: "Engineering Hours Saved",
      affectedRole: blueprint.endUser,
      unitQuantity: 30,
      unitValueCents: 7500,
      annualValueCents: 2700000,
      frequencyPeriod: "MONTHLY",
      calculationDescription: "30 hours/mo saved at $75/hr",
      provenanceType: "MODEL_ESTIMATE",
      evidenceLinkIds: [],
      assumptionIds: [],
      confidenceScore: confScore,
    },
  ];

  const risks: RiskItem[] = (blueprint.majorRisks || []).map((desc: string) => ({
    id: "risk-" + crypto.randomUUID(),
    category: "TECHNICAL",
    severity: "MEDIUM",
    description: desc,
    impactScore: 3,
    probabilityScore: 3,
    mitigationStrategy: "Validate across independent engineering teams before expanding scope",
    status: "IDENTIFIED",
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const assumptions: AssumptionItem[] = (blueprint.majorAssumptions || []).map((stmt: string) => ({
    id: "asm-" + crypto.randomUUID(),
    category: "PROBLEM",
    statement: stmt,
    importanceScore: 4,
    uncertaintyScore: 3,
    status: "UNTESTED",
    testMethod: "Customer interview campaign",
    successThreshold: ">= 60% validation",
    failureThreshold: "< 30% validation",
    provenanceType: "ASSUMPTION",
    evidenceLinkIds: [],
  }));

  const experiments: ValidationExperimentItem[] = [
    {
      id: "exp-" + crypto.randomUUID(),
      hypothesis: blueprint.recommendedNextExperiment,
      experimentType: "PREORDER",
      targetParticipant: blueprint.economicBuyer,
      sampleSize: 5,
      estimatedCostCents: 50000,
      estimatedDurationDays: 14,
      acquisitionChannel: "DIRECT_OUTREACH",
      procedureSummary: blueprint.recommendedNextExperiment || "Reach out to 5 qualified engineering leaders",
      successMetric: "Confirmed recurring workflow pain and pilot commitment",
      successThreshold: ">= 3 commitments",
      failureThreshold: "< 1 commitment",
      killCriterion: "Zero responses after 20 outreach attempts",
      nextActionOnSuccess: "Build MVP",
      nextActionOnFailure: "Pivot value proposition",
      status: "PLANNED",
      orderPriority: 1,
      evidenceGeneratedIds: [],
    },
  ];

  const rev = await createOpportunityRevisionTransaction(prisma, {
    opportunityId: opp.id,
    reasonForChange: "Initial synthesis from market signals",
    architectureSummary: blueprint.proposedProduct,
    customerSegments,
    mvpFeatures,
    competitors,
    scenarios: [
      {
        scenarioType: "BASE",
        currency: "USD",
        activeCustomers: 50,
        monthlyPriceCents: 19900,
        onboardingPriceCents: 0,
        variableCostPerCustomerCents: 500,
        monthlyFixedCostCents: 30000,
        customerAcquisitionCostCents: 25000,
        deliveryTimeWeeks: 6,
        assumptions: ["Standard self-serve onboarding conversion"],
        evidenceIds: [],
      },
    ],
    costs,
    benefits,
    risks,
    assumptions,
    experiments,
    opportunityScore: oppScore,
    evidenceConfidence: confScore,
    criticalClaimsCovered: verifiedSignals.length,
    costSummary: {
      minBuildMinorCents: blueprint.economics.estimatedMvpCost.minMinor,
      maxBuildMinorCents: blueprint.economics.estimatedMvpCost.maxMinor,
      minWeeks: blueprint.economics.estimatedTimeToMvpWeeks.min,
      maxWeeks: blueprint.economics.estimatedTimeToMvpWeeks.max,
      minMonthlyOpMinorCents: blueprint.economics.estimatedMonthlyOperatingCost.minMinor,
      maxMonthlyOpMinorCents: blueprint.economics.estimatedMonthlyOperatingCost.maxMinor,
    },
    snapshotData: blueprint,
  });

  for (const item of verifiedSignals) {
    const claimType = determineEmpiricalClaimType(
      item.normalizedSignal.signalType,
      item.normalizedSignal.sanitizedExcerpt,
      item.normalizedSignal.actorRole,
    );
    try {
      await prisma.evidenceLink.create({
        data: {
          opportunityId: opp.id,
          opportunityRevisionId: rev.revisionId,
          normalizedSignalId: item.normalizedSignal.id,
          claimType: claimType as any,
          claimIdentifier: "claim-pain-" + opp.id,
          claimSnippet: item.normalizedSignal.sanitizedExcerpt || item.normalizedSignal.problemSummary || "Empirical signal evidence",
          relationshipType: "SUPPORTS",
          supportStrength: "STRONG",
          explanation: `Empirically verified from ${item.source.name} (${item.rawSignal.sourceUrl})`,
          relevanceScore: 0.9,
        },
      });
    } catch (linkErr: any) {
      logger.warn("Failed creating EvidenceLink", { message: linkErr?.message });
    }
  }

  return opp;
}

/**
 * Actively searches permitted sources for independent corroboration of promising pain signals
 * with strict per-call timeouts and relevance matching against actual problem mechanics and affected users.
 */
export async function searchIndependentCorroboration(
  prisma: any,
  problemText: string,
  primarySourceKey: string,
  processedHashes: Set<string>,
  timeoutMs = 3500,
): Promise<Array<{ normalizedSignal: any; rawSignal: any; source: any }>> {
  const corroboratingVerifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }> = [];
  const candidateSourceKeys = ["github", "hackernews", "stackexchange", "lobsters"].filter(
    (k) => k !== primarySourceKey,
  );

  const searchQueries = extractTargetQueries([problemText]);
  if (searchQueries.length === 0) return corroboratingVerifiedSignals;

  const targetQuery = searchQueries[0] || "";
  if (!targetQuery) return corroboratingVerifiedSignals;
  const queryTerms = targetQuery.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  logger.info("Executing active corroboration search", { targetQuery, candidateSourceKeys });

  const perSourceResults = await Promise.allSettled(
    candidateSourceKeys.map(async (srcKey) => {
      const srcRecord = await prisma.source.findFirst({
        where: { key: srcKey, isEnabled: true, policyStatus: { not: "BLOCKED" } },
      });
      if (!srcRecord) return null;

      let adapter = sourceRegistry.getAdapter(srcKey);
      if (!adapter && srcRecord.adapterType === "GENERIC_RSS" && srcRecord.baseUrl) {
        adapter = sourceRegistry.createGenericRssAdapter({
          sourceKey: srcRecord.key,
          name: srcRecord.name,
          feedUrl: srcRecord.baseUrl,
          rateLimitPerMinute: srcRecord.rateLimitPerMinute,
          termsNotes: srcRecord.termsNotes || undefined,
          attributionRequired: srcRecord.attributionRequired,
          permittedExcerptLength: srcRecord.permittedExcerptLength,
          sourceFamily: srcRecord.sourceFamily || "COMMUNITY",
        });
      }
      if (!adapter) return null;

      let timer: any;
      const timeoutPromise = new Promise<any[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error("CORROBORATION_CALL_TIMEOUT")), Math.min(timeoutMs, 4000));
      });

      try {
        const fetchedSignals = await Promise.race([
          adapter.fetchSignals({ limit: 3, query: targetQuery, page: 1 }),
          timeoutPromise,
        ]);
        return { srcKey, srcRecord, fetchedSignals: Array.isArray(fetchedSignals) ? fetchedSignals : [] };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  for (const settled of perSourceResults) {
    if (corroboratingVerifiedSignals.length >= 3) break;
    if (settled.status !== "fulfilled" || !settled.value) continue;
    const { srcKey, srcRecord, fetchedSignals } = settled.value;

    try {
      for (const raw of fetchedSignals) {
        if (corroboratingVerifiedSignals.length >= 3) break;
        if (!raw.rawContent || raw.rawContent.trim().length < 10) continue;

        const passesProblemCheck = isConcreteProblemOrWorkaround({
          title: raw.title,
          sanitizedExcerpt: raw.rawContent,
          problemSummary: raw.title,
          sourceKey: srcKey,
          sourceFamily: srcRecord.sourceFamily,
          canonicalUrl: raw.sourceUrl,
        });

        if (!passesProblemCheck) continue;

        const rawCombined = `${raw.title || ""} ${raw.rawContent || ""}`.toLowerCase();
        const matchesTopic =
          signalsSupportSameProblem(problemText, raw.title || "", problemText, raw.rawContent || "") ||
          (queryTerms.length > 0 && queryTerms.some((term) => rawCombined.includes(term)));
        if (!matchesTopic) continue;

        const maxExcerpt = Math.min(280, srcRecord.permittedExcerptLength || 280);
        const sanitizedExcerpt = sanitizeRawContent(raw.rawContent, maxExcerpt);
        const canonicalUrl = canonicalizeUrl(raw.sourceUrl);
        const contentHash = computeContentHash(sanitizedExcerpt, srcKey);

        if (processedHashes.has(contentHash)) continue;
        processedHashes.add(contentHash);

        let rawRecord = await prisma.rawSignal.findUnique({
          where: { contentHash },
        });

        if (!rawRecord) {
          rawRecord = await prisma.rawSignal.create({
            data: {
              sourceId: srcRecord.id,
              externalId: String(raw.externalId || crypto.randomUUID()),
              sourceUrl: canonicalUrl,
              title: raw.title ? sanitizeRawContent(raw.title, 150) : null,
              rawContent: sanitizedExcerpt,
              contentHash,
              publishedAt:
                raw.publishedAt instanceof Date && !isNaN(raw.publishedAt.getTime())
                  ? raw.publishedAt
                  : new Date(),
              authorFingerprint: raw.authorFingerprint || null,
              createdAt: new Date(),
            },
          });
        }

        let normRecord = await prisma.normalizedSignal.findFirst({
          where: { rawSignalId: rawRecord.id },
        });

        if (!normRecord) {
          const { key: independenceKey, method: independenceMethod } = deriveIndependenceKey(
            srcRecord.key,
            rawRecord.externalId,
            canonicalUrl,
            rawRecord.authorFingerprint || undefined,
            raw.metadata,
          );

          normRecord = await prisma.normalizedSignal.create({
            data: {
              rawSignalId: rawRecord.id,
              sourceId: srcRecord.id,
              signalType: "PAIN",
              evidenceOrigin: "COLLECTED",
              originalUrl: raw.sourceUrl,
              canonicalUrl,
              sourceTitle: rawRecord.title,
              sanitizedExcerpt,
              problemSummary: rawRecord.title || sanitizedExcerpt,
              severityScore: 3,
              frequencyScore: 3,
              intentToPayScore: 2,
              confidenceScore: 80,
              isProcessed: true,
              verificationStatus: "VERIFIED",
              verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
              verifiedAt: new Date(),
              independenceKey,
              independenceMethod,
            },
          });
        }

        corroboratingVerifiedSignals.push({
          normalizedSignal: normRecord,
          rawSignal: rawRecord,
          source: srcRecord,
        });
      }
    } catch (srcCorroborateErr: any) {
      logger.warn("Error during corroboration search", { source: srcKey, error: srcCorroborateErr?.message });
    }
  }

  return corroboratingVerifiedSignals;
}

/**
 * Persists each supported brief with: problem, affected customer, cited evidence,
 * proposed product, existing alternatives, evidence gaps, and a practical validation experiment.
 * Inferred buyers and proposed solutions are explicitly labeled with [Assumption].
 * Grounded early opportunities appear with publicationQualityStatus = "HYPOTHESIS" and status = "PUBLISHED".
 */
export async function buildAndPersistOpportunityBrief(
  prisma: any,
  cl: ProblemClusterResult,
  verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }>,
  deadline: number,
  processedHashes: Set<string>,
): Promise<{
  opp: any;
  blueprint: any;
  qualityResult: any;
  formattedTitle: string;
  generatedSlug: string;
  finalStatus: string;
  pubQualityStatus: string;
  isVerified: boolean;
}> {
  const rawTitle = cl.title || cl.summary;
  const formattedTitle = formatMeaningfulTitle(rawTitle);
  let generatedSlug = generateCollisionSafeSlug(formattedTitle);
  const existingSlug = await prisma.opportunity.findUnique({ where: { slug: generatedSlug } });
  if (existingSlug) {
    generatedSlug = generateCollisionSafeSlug(formattedTitle, crypto.randomBytes(3).toString("hex"));
  }

  // Active corroboration search for promising pain signals when time budget allows
  if (verifiedSignals.length < 5 && Date.now() < deadline - 8000) {
    const primaryKey = verifiedSignals[0]?.source?.key || "unknown";
    const problemText = `${cl.title || ""} ${cl.summary || ""}`;
    const corroborating = await searchIndependentCorroboration(
      prisma,
      problemText,
      primaryKey,
      processedHashes,
      3500,
    );
    for (const cSig of corroborating) {
      if (!verifiedSignals.some((vs) => vs.normalizedSignal.id === cSig.normalizedSignal.id)) {
        verifiedSignals.push(cSig);
      }
    }
  }

  const fullProblemContext = `${rawTitle} ${cl.summary || ""}`;
  const primaryActorRole = verifiedSignals.find((s) => s.normalizedSignal?.actorRole)?.normalizedSignal?.actorRole;
  const audience = deriveSpecificAudience(fullProblemContext, primaryActorRole);
  const productDirection = derivePlausibleProductDirection(cl.summary || rawTitle, audience);
  const validationExperiment = deriveSpecificValidationExperiment(cl.summary || rawTitle, audience);
  const domainAlternatives = deriveDomainAlternatives(fullProblemContext);
  const commercialIndicators = deriveSupportedCommercialIndicators(verifiedSignals);

  const evidenceGaps = deriveEvidenceGaps(
    cl.summary,
    audience,
    commercialIndicators.distinctSourcesCount > 1,
    commercialIndicators.hasExplicitWtp,
  );

  const blueprint = synthesizeOpportunity(cl, verifiedSignals.length);
  blueprint.title = formattedTitle;
  blueprint.slug = generatedSlug;
  blueprint.oneSentenceSummary = productDirection;
  blueprint.economicBuyer = `[Assumption] ${audience} Leadership`;
  blueprint.endUser = `[Assumption] ${audience}`;
  blueprint.targetCustomerSegments = [`[Assumption] ${audience}`];
  blueprint.proposedProduct = `[Assumption] ${productDirection}`;
  blueprint.recommendedNextExperiment = validationExperiment;
  blueprint.existingWorkflow = domainAlternatives.existingWorkflow;
  blueprint.evidenceOfDemand = commercialIndicators.evidenceOfDemand;
  blueprint.evidenceOfWillingnessToPay = commercialIndicators.evidenceOfWillingnessToPay;
  blueprint.majorAssumptions = [
    `[Assumption] Inferred target customer segment: ${audience}`,
    `[Assumption] Proposed solution direction: ${productDirection}`,
    `[Assumption] Commercial willingness to pay requires direct buyer validation`,
    ...blueprint.majorAssumptions.filter((a) => !a.startsWith("[Assumption]")),
  ];
  blueprint.majorRisks = evidenceGaps;
  blueprint.existingCompetitors = domainAlternatives.competitors;
  blueprint.competitorWeaknesses = domainAlternatives.weaknesses;
  if (blueprint.scorecard) {
    blueprint.scorecard.opportunityScore = commercialIndicators.opportunityScore;
    blueprint.scorecard.evidenceConfidenceScore = commercialIndicators.evidenceConfidenceScore;
  }

  const claimLinks = buildEmpiricalClaimLinks(verifiedSignals);
  const qualityResult = evaluatePublicationQuality(claimLinks, commercialIndicators.evidenceConfidenceScore);
  const isVerified = qualityResult.status === "VERIFIED" && qualityResult.isEligibleForVerified;
  const finalStatus = "PUBLISHED";
  const pubQualityStatus = qualityResult.status || "HYPOTHESIS";

  const oppData = {
    slug: generatedSlug,
    title: formattedTitle,
    oneSentenceSummary: blueprint.oneSentenceSummary,
    problemStatement: blueprint.problemStatement,
    jobsToBeDone: blueprint.jobsToBeDone,
    proposedProduct: blueprint.proposedProduct,
    narrowMvpScope: blueprint.narrowMvpScope,
    targetCustomerSegments: blueprint.targetCustomerSegments,
    economicBuyer: blueprint.economicBuyer,
    endUser: blueprint.endUser,
    buyingTrigger: blueprint.buyingTrigger,
    existingWorkflow: blueprint.existingWorkflow,
    painSeverity: blueprint.painSeverity,
    painFrequency: blueprint.painFrequency,
    status: finalStatus,
    publicationQualityStatus: pubQualityStatus,
    isDemoFixture: false,
    industry: cl.vertical || "DevOps & Compliance",
    customerType: "B2B",
    estimatedMvpCostMinCents: blueprint.economics.estimatedMvpCost.minMinor,
    estimatedMvpCostMaxCents: blueprint.economics.estimatedMvpCost.maxMinor,
    estimatedTimeToMvpMinWeeks: blueprint.economics.estimatedTimeToMvpWeeks.min,
    estimatedTimeToMvpMaxWeeks: blueprint.economics.estimatedTimeToMvpWeeks.max,
    estimatedMonthlyOpCostMinCents: blueprint.economics.estimatedMonthlyOperatingCost.minMinor,
    estimatedMonthlyOpCostMaxCents: blueprint.economics.estimatedMonthlyOperatingCost.maxMinor,
    recommendedNextExperiment: blueprint.recommendedNextExperiment,
    majorAssumptions: blueprint.majorAssumptions,
    majorRisks: blueprint.majorRisks,
  };

  const opp = await createCandidateWithRevisionAndLinks(
    prisma,
    oppData,
    blueprint,
    verifiedSignals,
    isVerified,
  );

  return {
    opp,
    blueprint,
    qualityResult,
    formattedTitle,
    generatedSlug,
    finalStatus,
    pubQualityStatus,
    isVerified,
  };
}

export async function executeManualStagingIngestion(
  prisma: any,
  options: ManualIngestionOptions,
): Promise<ManualIngestionRunResult> {
  const {
    idempotencyKey,
    workerId = "worker-" + crypto.randomBytes(4).toString("hex"),
    leaseDurationMs = 30000,
    maxSources = 5,
    maxFetchItems = 30,
    maxRawSignals = 20,
    maxCandidates = 5,
    maxClassifiedSignals,
    maxHistoricalSignals = 20,
    maxPublishedOpportunities = 3,
    targetSourceKeys,
    aiProvider = defaultAI,
    executionTimeoutMs = 50000,
    cleanSyntheticPrior = false,
    forceRetry = false,
  } = options;


  const startTime = Date.now();
  const deadline = startTime + executionTimeoutMs;
  const collectionDeadline = startTime + Math.min(15000, Math.floor(executionTimeoutMs * 0.35));
  const aiDeadline = startTime + Math.min(32000, Math.floor(executionTimeoutMs * 0.65));
  const claimToken = crypto.randomUUID();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + leaseDurationMs);

  logger.info("Initiating staging manual ingestion claim...", { idempotencyKey, workerId });

  // 0. Ensure durable ingestion_runs table exists in target database
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "IngestionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    `).catch(() => {});

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ingestion_runs" (
            "id" TEXT NOT NULL,
            "idempotencyKey" TEXT NOT NULL,
            "status" "IngestionRunStatus" NOT NULL DEFAULT 'PENDING'::"IngestionRunStatus",
            "failureCode" TEXT,
            "claimToken" TEXT,
            "lockedBy" TEXT,
            "lockedAt" TIMESTAMP(3),
            "lockedUntil" TIMESTAMP(3),
            "attemptCount" INTEGER NOT NULL DEFAULT 0,
            "totalFetched" INTEGER NOT NULL DEFAULT 0,
            "totalDeduplicated" INTEGER NOT NULL DEFAULT 0,
            "rawSignalsCount" INTEGER NOT NULL DEFAULT 0,
            "candidatesCount" INTEGER NOT NULL DEFAULT 0,
            "publishedCount" INTEGER NOT NULL DEFAULT 0,
            "publishedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "summary" JSONB,
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "failedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
        );
      `);
    } catch {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ingestion_runs" (
            "id" TEXT NOT NULL,
            "idempotencyKey" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "failureCode" TEXT,
            "claimToken" TEXT,
            "lockedBy" TEXT,
            "lockedAt" TIMESTAMP(3),
            "lockedUntil" TIMESTAMP(3),
            "attemptCount" INTEGER NOT NULL DEFAULT 0,
            "totalFetched" INTEGER NOT NULL DEFAULT 0,
            "totalDeduplicated" INTEGER NOT NULL DEFAULT 0,
            "rawSignalsCount" INTEGER NOT NULL DEFAULT 0,
            "candidatesCount" INTEGER NOT NULL DEFAULT 0,
            "publishedCount" INTEGER NOT NULL DEFAULT 0,
            "publishedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "summary" JSONB,
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "failedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
        );
      `).catch((err: any) => logger.warn("Table fallback warning", { err: err?.message }));
    }

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_key" ON "ingestion_runs"("idempotencyKey");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingestion_runs_status_lockedUntil_idx" ON "ingestion_runs"("status", "lockedUntil");
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_idx" ON "ingestion_runs"("idempotencyKey");
    `).catch(() => {});
  } catch (ddlErr: any) {
    logger.info("ingestion_runs table check/bootstrap", { message: ddlErr?.message });
  }

  // Optional synthetic cleanup before fresh run
  if (cleanSyntheticPrior) {
    try {
      await cleanSyntheticStagingOpportunity(prisma);
    } catch (cleanErr: any) {
      logger.warn("Synthetic cleanup warning:", { error: cleanErr?.message });
    }
  }

  // 1. Durable IngestionRun Claim / Acquire Lease
  let currentRun: any = null;

  try {
    currentRun = await acquireIngestionLease(prisma, {
      idempotencyKey,
      workerId,
      claimToken,
      now,
      lockedUntil,
      forceRetry,
    });
  } catch (err: any) {
    if (err.message === "CONCURRENT_RUN_IN_PROGRESS") {
      return {
        runId: "concurrent",
        idempotencyKey,
        status: "FAILED",
        failureCode: "CONCURRENT_RUN_IN_PROGRESS",
        counters: { fetched: 0, deduplicated: 0, rawSignals: 0, rejected: 0, candidates: 0, published: 0 },
        publishedSlugs: [],
        startedAt: now.toISOString(),
        failedAt: now.toISOString(),
      };
    }
    throw err;
  }

  if (currentRun.action === "RETURN_EXISTING" || currentRun.action === "IN_PROGRESS") {
    const run = currentRun.run;
    return {
      runId: run.id,
      idempotencyKey: run.idempotencyKey,
      status: run.status,
      failureCode: run.failureCode,
      isExisting: true,
      counters: {
        fetched: run.totalFetched || 0,
        deduplicated: run.totalDeduplicated || 0,
        rawSignals: run.rawSignalsCount || 0,
        rejected: Math.max(0, (run.totalFetched || 0) - (run.totalDeduplicated || 0) - (run.rawSignalsCount || 0)),
        candidates: run.candidatesCount || 0,
        published: run.publishedCount || 0,
      },
      publishedSlugs: run.publishedSlugs || [],
      startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : now.toISOString(),
      completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      failedAt: run.failedAt ? new Date(run.failedAt).toISOString() : null,
      summary: run.summary,
    };
  }

  const runId = currentRun.run.id;
  let totalFetched = 0;
  let totalDeduplicated = 0;
  let totalRejected = 0;
  let rawSignalsCount = 0;
  let normalizedSignalsCount = 0;
  let candidatesCount = 0;
  let publishedCount = 0;
  const publishedSlugs: string[] = [];
  const processedHashes = new Set<string>();
  let activeSources: any[] = [];
  let perSourceStats: Record<string, any> = {};

  try {
    // 2. Fetch and synchronize Active Approved Sources
    const defaultSources = [
      {
        key: "hackernews",
        name: "Hacker News",
        description: "Hacker News community submissions and comments",
        sourceFamily: "COMMUNITY",
        baseUrl: "https://news.ycombinator.com",
        adapterType: "HACKERNEWS_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 120,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Uses official open API for indexing problem discussions.",
      },
      {
        key: "reddit",
        name: "Reddit Tech & Ops",
        description: "Public technical subreddits (r/devops, r/dataengineering)",
        sourceFamily: "COMMUNITY",
        baseUrl: "https://reddit.com",
        adapterType: "REDDIT_OAUTH",
        accessMethod: "OAUTH_API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 60,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "OAuth API with short excerpts and permalink citations.",
      },
      {
        key: "github",
        name: "GitHub Issues & Discussions",
        description: "Public GitHub repository problem statements and issues",
        sourceFamily: "DEVELOPER_ECOSYSTEM",
        baseUrl: "https://github.com",
        adapterType: "GITHUB_REST",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 80,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Extracts public open-source repository issue friction.",
      },
      {
        key: "producthunt",
        name: "Product Hunt Reviews",
        description: "Product Hunt market feedback and user complaints",
        sourceFamily: "COMMUNITY",
        baseUrl: "https://producthunt.com",
        adapterType: "PRODUCTHUNT_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 60,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Permitted API access for product reviews and gaps.",
      },
      {
        key: "krasia",
        name: "KrASIA",
        description: "Asia tech ecosystem news, startup funding and market intelligence",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://kr-asia.com",
        adapterType: "KRASIA_RSS",
        accessMethod: "RSS",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 60,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official public RSS feed via console.kr-asia.com/feed with attribution to original journalists/syndication partners.",
      },
      {
        key: "e27",
        name: "e27",
        description: "Southeast Asia tech ecosystem and startup community platform",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://e27.co",
        adapterType: "E27_API",
        accessMethod: "API",
        isEnabled: false,
        policyStatus: "REVIEW_REQUIRED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Access blocked by publisher Cloudflare 403 bot protection and robots.txt AI training restrictions. Kept disabled until official partnership API is provisioned.",
      },
      {
        key: "eustartups",
        name: "EU-Startups",
        description: "European startup intelligence and ecosystem news",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://www.eu-startups.com/feed/",
        adapterType: "GENERIC_RSS",
        accessMethod: "RSS",
        isEnabled: false,
        policyStatus: "REVIEW_REQUIRED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Access blocked by publisher Cloudflare HTTP/2 403 bot protection. Verification failed on live feed probe; kept disabled per policy.",
      },
      {
        key: "siliconcanals",
        name: "Silicon Canals",
        description: "European startup intelligence and ecosystem news",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://siliconcanals.com/feed/",
        adapterType: "GENERIC_RSS",
        accessMethod: "RSS",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official public RSS feed via siliconcanals.com/feed/. Editorial European tech and startup intelligence with attribution.",
      },
      {
        key: "lobsters",
        name: "Lobsters",
        description: "Community developer discussions and computing problem friction",
        sourceFamily: "COMMUNITY",
        baseUrl: "https://lobste.rs/rss",
        adapterType: "GENERIC_RSS",
        accessMethod: "RSS",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official public RSS feed via lobste.rs/rss. Community developer discussions and external technical problem articles.",
      },
      {
        key: "techcrunch",
        name: "TechCrunch",
        description: "Global startup, venture ecosystem, and technology market news",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://techcrunch.com/feed/",
        adapterType: "GENERIC_RSS",
        accessMethod: "RSS",
        isEnabled: false,
        policyStatus: "REVIEW_REQUIRED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Feed available via techcrunch.com/feed/; kept disabled with status REVIEW_REQUIRED pending formal RSS commercial use and syndication compliance review.",
      },
      {
        key: "ted",
        name: "TED Europa Tenders",
        description: "European public procurement and tenders demonstrating public buyer demand and contract budgets",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://api.ted.europa.eu",
        adapterType: "TED_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 60,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official TED Europa public search API v3. Open public procurement tender notices across the European Union.",
      },
      {
        key: "samgov",
        name: "SAM.gov Federal Contracting",
        description: "United States federal contracting and procurement opportunities",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://api.sam.gov",
        adapterType: "SAMGOV_API",
        accessMethod: "API",
        isEnabled: Boolean(process.env.SAM_GOV_API_KEY),
        policyStatus: (process.env.SAM_GOV_API_KEY ? "ALLOWED" : "REVIEW_REQUIRED") as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official SAM.gov API requiring SAM_GOV_API_KEY. Public federal solicitations and procurement budgets.",
      },
      {
        key: "stackexchange",
        name: "Stack Exchange & Stack Overflow",
        description: "Public developer questions, technical problems, and tooling friction",
        sourceFamily: "COMMUNITY",
        baseUrl: "https://api.stackexchange.com",
        adapterType: "STACKEXCHANGE_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
        rateLimitPerMinute: 60,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official Stack Exchange REST API v2.3. CC BY-SA 4.0 license with attribution to author and question.",
      },
      {
        key: "cisakev",
        name: "CISA Known Exploited Vulnerabilities",
        description: "Official CISA catalog of confirmed in-the-wild exploited security vulnerabilities",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://www.cisa.gov",
        adapterType: "CISAKEV_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 30,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official CISA KEV JSON catalog. Confirmed security vulnerabilities requiring remediation.",
      },
      {
        key: "arxiv",
        name: "arXiv Research Preprints",
        description: "Scientific and technical preprints demonstrating emerging technology trends",
        sourceFamily: "DISCOVERY",
        baseUrl: "https://export.arxiv.org",
        adapterType: "ARXIV_API",
        accessMethod: "API",
        isEnabled: true,
        policyStatus: "ALLOWED" as any,
        credibilityTier: "TIER_1_PRIMARY" as any,
        rateLimitPerMinute: 20,
        permittedExcerptLength: 280,
        attributionRequired: true,
        termsNotes: "Official arXiv API (export.arxiv.org). Scientific and technical research preprints and breakthroughs.",
      },
    ];

    try {
      for (const src of defaultSources) {
        const existingList = await prisma.source.findMany({ where: { key: src.key } }).catch(() => []);
        const existing = existingList[0];
        if (existing) {
          if (existing.sourceFamily !== src.sourceFamily || existing.adapterType !== src.adapterType) {
            await prisma.source.update({
              where: { id: existing.id },
              data: {
                sourceFamily: src.sourceFamily,
                baseUrl: src.baseUrl,
                adapterType: src.adapterType,
                accessMethod: src.accessMethod,
                termsNotes: src.termsNotes,
                attributionRequired: src.attributionRequired,
              },
            }).catch(() => {});
          }
        } else {
          await prisma.source.create({
            data: {
              key: src.key,
              name: src.name,
              description: src.description,
              sourceFamily: src.sourceFamily,
              baseUrl: src.baseUrl,
              adapterType: src.adapterType,
              accessMethod: src.accessMethod,
              isEnabled: src.isEnabled,
              policyStatus: src.policyStatus,
              credibilityTier: src.credibilityTier,
              rateLimitPerMinute: src.rateLimitPerMinute,
              permittedExcerptLength: src.permittedExcerptLength,
              attributionRequired: src.attributionRequired,
              termsNotes: src.termsNotes,
            },
          }).catch((cErr: any) => logger.warn("Source create error", { err: cErr?.message }));
        }
      }
    } catch (seedErr: any) {
      logger.warn("Source sync warning", { error: seedErr?.message });
    }

    const sourceFilter: any = {
      isEnabled: true,
      policyStatus: { not: "BLOCKED" },
    };

    if (targetSourceKeys && targetSourceKeys.length > 0) {
      sourceFilter.key = { in: targetSourceKeys };
    } else {
      sourceFilter.OR = [
        { key: { in: ALLOWLISTED_SOURCE_KEYS } },
        { adapterType: "GENERIC_RSS" },
      ];
    }

    activeSources = await prisma.source.findMany({
      where: sourceFilter,
      take: maxSources,
    });

    if (targetSourceKeys && targetSourceKeys.length > 0) {
      activeSources.sort((a: any, b: any) => {
        const idxA = targetSourceKeys.indexOf(a.key);
        const idxB = targetSourceKeys.indexOf(b.key);
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      });
    }

    if (!activeSources || activeSources.length === 0) {
      logger.warn("No active approved sources found for staging manual ingestion.");
      await markRunFailed(prisma, runId, claimToken, "NO_ACTIVE_SOURCES");
      return {
        runId,
        idempotencyKey,
        status: "FAILED",
        failureCode: "NO_ACTIVE_SOURCES",
        counters: { fetched: 0, deduplicated: 0, rawSignals: 0, rejected: 0, candidates: 0, published: 0 },
        publishedSlugs: [],
        startedAt: now.toISOString(),
        failedAt: new Date().toISOString(),
      };
    }

    // 3. Ingest and Deduplicate Signals
    // Publication Chain: Source -> RawSignal -> NormalizedSignal
    const sanitizedSignalsToProcess: {
      rawSignalId: string;
      normalizedSignalId: string;
      externalId: string;
      title: string;
      excerpt: string;
      sourceKey: string;
      sourceId: string;
      sourceName: string;
    }[] = [];

    // Extract search keywords from existing unverified candidate problem statements
    let targetQueries: string[] = options.targetQueries && options.targetQueries.length > 0
      ? [...options.targetQueries]
      : [];
    if (targetQueries.length === 0) {
      try {
        const priorCandidates = await prisma.opportunity.findMany({
          where: {
            isDemoFixture: false,
          },
          select: { title: true, problemStatement: true },
          take: 5,
          orderBy: { createdAt: "desc" },
        });
        const texts = priorCandidates.map((c: any) => `${c.title || ""} ${c.problemStatement || ""}`);
        targetQueries = extractTargetQueries(texts);
        if (targetQueries.length > 0) {
          logger.info("Targeting live searches for candidate keywords", { targetQueries });
        }
      } catch (qErr: any) {
        logger.warn("Could not extract candidate target queries", { error: qErr?.message });
      }
    }

    perSourceStats = {};

    const configuredTargetKeys = (targetSourceKeys && targetSourceKeys.length > 0)
      ? targetSourceKeys
      : ALLOWLISTED_SOURCE_KEYS;

    for (const key of configuredTargetKeys) {
      const srcMeta = defaultSources.find((s) => s.key === key);
      const isSamGovWithoutKey = key === "samgov" && !process.env.SAM_GOV_API_KEY;
      perSourceStats[key] = {
        name: srcMeta?.name || key,
        fetched: 0,
        newRawSignals: 0,
        duplicates: 0,
        rejected: 0,
        rejectionReasons: {},
        persisted: 0,
        persistedUrls: [],
        status: "SKIPPED",
        reason: isSamGovWithoutKey
          ? "MISSING_SAM_GOV_API_KEY"
          : "PENDING_OR_DISABLED",
      };
    }

    // Fair source budgeting: Divide total item limit across all active sources
    // so no single source starves the other active sources
    const eligibleSourcesCount = Math.max(1, activeSources.length);
    const perSourceBaseBudget = Math.max(3, Math.floor(maxFetchItems / eligibleSourcesCount));

    for (let srcIndex = 0; srcIndex < activeSources.length; srcIndex++) {
      const src = activeSources[srcIndex];
      if (Date.now() > collectionDeadline || totalFetched >= maxFetchItems) break;

      let adapter = sourceRegistry.getAdapter(src.key);
      if (!adapter && src.adapterType === "GENERIC_RSS" && src.baseUrl) {
        adapter = sourceRegistry.createGenericRssAdapter({
          sourceKey: src.key,
          name: src.name,
          feedUrl: src.baseUrl,
          rateLimitPerMinute: src.rateLimitPerMinute,
          termsNotes: src.termsNotes || undefined,
          attributionRequired: src.attributionRequired,
          permittedExcerptLength: src.permittedExcerptLength,
          sourceFamily: src.sourceFamily || "COMMUNITY",
        });
      }
      if (!adapter) continue;

      const currentStats = {
        name: src.name,
        fetched: 0,
        newRawSignals: 0,
        duplicates: 0,
        rejected: 0,
        rejectionReasons: {} as Record<string, number>,
        persisted: 0,
        persistedUrls: [] as string[],
        status: "SUCCESS" as "SUCCESS" | "SKIPPED" | "ERROR",
        reason: "COMPLETED" as string | null,
      };
      perSourceStats[src.key] = currentStats;

      const sourceRun = await prisma.sourceRun.create({
        data: {
          sourceId: src.id,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      let srcIngestedCount = 0;
      let srcErrorMsg: string | null = null;

      try {
        const rawSignals: any[] = [];
        const slotsAvailable = maxFetchItems - totalFetched;
        // Ensure remaining sources get slots by capping each source to perSourceBaseBudget
        // or remaining slots if it's the last source
        const isLastSource = srcIndex === activeSources.length - 1;
        const srcSlots = isLastSource
          ? Math.min(slotsAvailable, perSourceBaseBudget * 2)
          : Math.min(slotsAvailable, perSourceBaseBudget);

        // Checkpoint state recovery: Query latest RawSignal for this source to pass checkpoint/since
        let latestCheckpoint: string | undefined = undefined;
        try {
          const latestSignal = await prisma.rawSignal.findFirst({
            where: { sourceId: src.id },
            orderBy: { createdAt: "desc" },
            select: { publishedAt: true, createdAt: true, externalId: true },
          });
          if (latestSignal) {
            const rawDate = latestSignal.publishedAt || latestSignal.createdAt;
            const parsed = new Date(rawDate);
            const now = new Date();
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const latestDate =
              !isNaN(parsed.getTime()) && parsed <= fourteenDaysAgo
                ? parsed
                : fourteenDaysAgo;
            if (src.key === "hackernews") {
              latestCheckpoint = String(Math.floor(latestDate.getTime() / 1000));
            } else if (src.key === "github") {
              latestCheckpoint = latestDate.toISOString().split("T")[0];
            } else {
              latestCheckpoint = latestSignal.externalId;
            }
          }
        } catch (cpErr: any) {
          logger.warn("Checkpoint lookup warning", { source: src.key, error: cpErr?.message });
        }

        if (targetQueries.length > 0 && (src.key === "hackernews" || src.key === "github" || src.key === "stackexchange")) {
          const queriesToRun = targetQueries.slice(0, 2);
          const perQuery = Math.max(2, Math.floor(srcSlots / queriesToRun.length));
          const fetchPromises = queriesToRun.map((q) =>
            adapter.fetchSignals({
              limit: perQuery,
              query: q,
              checkpoint: latestCheckpoint,
              page: 1,
            })
          );
          const results = await Promise.all(fetchPromises);
          for (const list of results) {
            rawSignals.push(...list);
          }

          if (rawSignals.length < srcSlots) {
            const remaining = srcSlots - rawSignals.length;
            const generalSignals = await adapter.fetchSignals({
              limit: Math.min(5, remaining),
              query: src.key === "hackernews" ? "workaround" : undefined,
              checkpoint: latestCheckpoint,
              page: 1,
            });
            rawSignals.push(...generalSignals);
          }
        } else {
          const generalSignals = await adapter.fetchSignals({
            limit: Math.min(15, srcSlots),
            query: src.key === "hackernews" ? "workaround" : undefined,
            checkpoint: latestCheckpoint,
            page: 1,
          });
          rawSignals.push(...generalSignals);
        }

        const boundedRawSignals = rawSignals.slice(0, Math.max(0, Math.min(slotsAvailable, srcSlots)));
        totalFetched += boundedRawSignals.length;
        currentStats.fetched += boundedRawSignals.length;

        for (const raw of boundedRawSignals) {
          if (!raw.rawContent || raw.rawContent.trim().length === 0) {
            currentStats.rejected++;
            totalRejected++;
            currentStats.rejectionReasons["EMPTY_PAYLOAD"] = (currentStats.rejectionReasons["EMPTY_PAYLOAD"] || 0) + 1;
            continue;
          }

          if (raw.rawContent.trim().length < 10) {
            currentStats.rejected++;
            totalRejected++;
            currentStats.rejectionReasons["CONTENT_TOO_SHORT"] = (currentStats.rejectionReasons["CONTENT_TOO_SHORT"] || 0) + 1;
            continue;
          }

          const maxExcerpt = Math.min(280, src.permittedExcerptLength || 280);
          const sanitizedExcerpt = sanitizeRawContent(raw.rawContent, maxExcerpt);
          const canonicalUrl = canonicalizeUrl(raw.sourceUrl);
          const contentHash = computeContentHash(sanitizedExcerpt, src.key);

          if (processedHashes.has(contentHash)) {
            totalDeduplicated++;
            currentStats.duplicates++;
            continue;
          }
          processedHashes.add(contentHash);

          let rawRecord = await prisma.rawSignal.findUnique({
            where: { contentHash },
          });

          const validPublishedAt =
            raw.publishedAt instanceof Date && !isNaN(raw.publishedAt.getTime())
              ? raw.publishedAt
              : new Date();

          if (!rawRecord) {
            if (rawSignalsCount < maxRawSignals) {
              rawRecord = await prisma.rawSignal.create({
                data: {
                  sourceId: src.id,
                  sourceRunId: sourceRun.id,
                  externalId: String(raw.externalId || crypto.randomUUID()),
                  sourceUrl: canonicalUrl,
                  title: raw.title ? sanitizeRawContent(raw.title, 150) : null,
                  rawContent: sanitizedExcerpt,
                  contentHash,
                  publishedAt: validPublishedAt,
                  authorFingerprint: raw.authorFingerprint || null,
                  createdAt: new Date(),
                },
              });
              rawSignalsCount++;
              srcIngestedCount++;
              currentStats.newRawSignals++;
              currentStats.persisted++;
              currentStats.persistedUrls.push(canonicalUrl);
            } else {
              currentStats.rejected++;
              totalRejected++;
              currentStats.rejectionReasons["MAX_RAW_SIGNALS_EXCEEDED"] = (currentStats.rejectionReasons["MAX_RAW_SIGNALS_EXCEEDED"] || 0) + 1;
            }
          } else {
            totalDeduplicated++;
            currentStats.duplicates++;
          }

          if (rawRecord) {
            let normRecord = await prisma.normalizedSignal.findFirst({
              where: { rawSignalId: rawRecord.id },
            });

            if (!normRecord) {
              const { key: independenceKey, method: independenceMethod } = deriveIndependenceKey(
                src.key,
                rawRecord.externalId,
                canonicalUrl,
                rawRecord.authorFingerprint || undefined,
                raw.metadata,
              );

              normRecord = await prisma.normalizedSignal.create({
                data: {
                  rawSignalId: rawRecord.id,
                  sourceId: src.id,
                  signalType:
                    src.key === "ted" || src.key === "samgov"
                      ? "PROCUREMENT"
                      : src.key === "arxiv"
                      ? "EMERGING_TECH"
                      : src.key === "krasia" || src.key === "e27" || src.key === "siliconcanals" || src.key === "techcrunch"
                      ? "MARKET_ACTIVITY"
                      : "PAIN",
                  evidenceOrigin: "COLLECTED",
                  originalUrl: raw.sourceUrl,
                  canonicalUrl,
                  sourceTitle: rawRecord.title,
                  sanitizedExcerpt,
                  problemSummary: rawRecord.title || sanitizedExcerpt,
                  severityScore: 3,
                  frequencyScore: 3,
                  intentToPayScore: 2,
                  confidenceScore: 75,
                  verificationStatus: "VERIFIED",
                  verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
                  verifiedAt: new Date(),
                  independenceKey,
                  independenceMethod,
                },
              });
              normalizedSignalsCount++;
            }

            sanitizedSignalsToProcess.push({
              rawSignalId: rawRecord.id,
              normalizedSignalId: normRecord.id,
              externalId: rawRecord.externalId,
              title: rawRecord.title || sanitizedExcerpt,
              excerpt: sanitizedExcerpt,
              sourceKey: src.key,
              sourceId: src.id,
              sourceName: src.name,
            });
          }
        }

        await prisma.source.update({
          where: { id: src.id },
          data: { lastSuccessfulCollection: new Date() },
        });
      } catch (srcErr: any) {
        srcErrorMsg = srcErr.message || String(srcErr);
        currentStats.status = "ERROR";
        currentStats.reason = srcErrorMsg;
      } finally {
        if (srcErrorMsg) {
          currentStats.status = "ERROR";
          currentStats.reason = srcErrorMsg;
        } else if (currentStats.fetched === 0) {
          currentStats.status = "SUCCESS";
          currentStats.reason = "NO_NEW_ITEMS_RETURNED";
        } else {
          currentStats.status = "SUCCESS";
          currentStats.reason = "COMPLETED";
        }
        await prisma.sourceRun.update({
          where: { id: sourceRun.id },
          data: {
            status: srcErrorMsg ? "FAILED" : "SUCCESS",
            errorMessage: srcErrorMsg,
            finishedAt: new Date(),
            signalsIngested: srcIngestedCount,
          },
        });
      }
    }

    // 3b. Backlog Recovery: Process persisted but unfinished signals
    // Ingestion must not depend exclusively on newly fetched records
    let historicalSignalsCount = 0;
    let remainingBacklogCount = 0;
    const alreadyPresentRawIds = new Set(sanitizedSignalsToProcess.map((s) => s.rawSignalId));
    const preProcessedClusterCandidates: ClusterCandidate[] = [];

    // A) Process persisted but unnormalized RawSignals
    try {
      const unnormalizedRaw = await prisma.rawSignal.findMany({
        where: {
          normalizedSignal: null,
          sourceUrl: { notIn: KNOWN_SYNTHETIC_FIXTURE_URLS },
          externalId: { notIn: KNOWN_SYNTHETIC_FIXTURE_EXTERNAL_IDS },
        },
        include: { source: true },
        take: maxRawSignals,
        orderBy: { createdAt: "desc" },
      }).catch(() => []);

      for (const raw of unnormalizedRaw) {
        if (!raw.source || !raw.rawContent || raw.rawContent.trim().length < 10) continue;
        if (alreadyPresentRawIds.has(raw.id)) continue;

        const maxExcerpt = Math.min(280, raw.source.permittedExcerptLength || 280);
        const sanitizedExcerpt = sanitizeRawContent(raw.rawContent, maxExcerpt);
        const canonicalUrl = canonicalizeUrl(raw.sourceUrl);
        const { key: independenceKey, method: independenceMethod } = deriveIndependenceKey(
          raw.source.key,
          raw.externalId,
          canonicalUrl,
          raw.authorFingerprint || undefined,
        );

        const norm = await prisma.normalizedSignal.create({
          data: {
            rawSignalId: raw.id,
            sourceId: raw.source.id,
            signalType:
              raw.source.key === "ted" || raw.source.key === "samgov"
                ? "PROCUREMENT"
                : raw.source.key === "arxiv"
                ? "EMERGING_TECH"
                : raw.source.key === "krasia" || raw.source.key === "e27" || raw.source.key === "siliconcanals" || raw.source.key === "techcrunch"
                ? "MARKET_ACTIVITY"
                : "PAIN",
            evidenceOrigin: "COLLECTED",
            originalUrl: raw.sourceUrl,
            canonicalUrl,
            sourceTitle: raw.title,
            sanitizedExcerpt,
            problemSummary: raw.title || sanitizedExcerpt,
            severityScore: 3,
            frequencyScore: 3,
            intentToPayScore: 2,
            confidenceScore: 75,
            verificationStatus: "VERIFIED",
            verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
            verifiedAt: new Date(),
            independenceKey,
            independenceMethod,
            isProcessed: false,
          },
        }).catch(() => null);

        if (norm) {
          sanitizedSignalsToProcess.push({
            rawSignalId: raw.id,
            normalizedSignalId: norm.id,
            externalId: raw.externalId,
            title: raw.title || sanitizedExcerpt,
            excerpt: sanitizedExcerpt,
            sourceKey: raw.source.key,
            sourceId: raw.source.id,
            sourceName: raw.source.name,
          });
          alreadyPresentRawIds.add(raw.id);
          historicalSignalsCount++;
        }
      }
    } catch (unnormErr: any) {
      logger.warn("Unnormalized recovery warning", { error: unnormErr?.message });
    }

    // B) Include eligible historical verified NormalizedSignals not yet linked to an opportunity
    if (maxHistoricalSignals > 0) {
      const existingUnlinked = await prisma.normalizedSignal.findMany({
        where: {
          evidenceLinks: { none: {} },
          verificationStatus: { not: "REJECTED" },
          canonicalUrl: { notIn: KNOWN_SYNTHETIC_FIXTURE_URLS },
          rawSignal: {
            AND: [
              { sourceUrl: { notIn: KNOWN_SYNTHETIC_FIXTURE_URLS } },
              { externalId: { notIn: KNOWN_SYNTHETIC_FIXTURE_EXTERNAL_IDS } },
            ],
          },
        },
        include: { rawSignal: { include: { source: true } } },
        take: Math.max(maxHistoricalSignals * 3, 60),
        orderBy: { createdAt: "desc" },
      }).catch(() => []);

      // Sort unlinked signals so problem-rich sources (HN, GitHub, StackExchange, Lobsters, TED) come first
      const problemSourcePriority: Record<string, number> = {
        hackernews: 1,
        github: 2,
        stackexchange: 3,
        lobsters: 4,
        ted: 5,
        reddit: 6,
      };
      existingUnlinked.sort((a: any, b: any) => {
        const keyA = a.rawSignal?.source?.key || "";
        const keyB = b.rawSignal?.source?.key || "";
        const prioA = problemSourcePriority[keyA] || 50;
        const prioB = problemSourcePriority[keyB] || 50;
        if (prioA !== prioB) return prioA - prioB;
        return 0;
      });

      let addedHistoricalUnfinished = 0;
      for (const sig of existingUnlinked) {
        if (!sig.rawSignal || !sig.rawSignal.source || alreadyPresentRawIds.has(sig.rawSignal.id)) {
          continue;
        }
        const srcKey = sig.rawSignal.source.key || "";
        const sigTitle = sig.sourceTitle || sig.problemSummary || "";
        const sigExcerpt = sig.sanitizedExcerpt || "";
        const sigSummary = sig.problemSummary || "";
        const sigMeta = (sig.metadata && typeof sig.metadata === "object") ? (sig.metadata as Record<string, any>) : {};
        const attempts = Number(sigMeta.processingAttempts || 0);

        // Immediately reject vague meta-critiques or repo-internal agent chores in backlog
        if (
          /vague question about|without industry context/i.test(sigSummary) ||
          (!isConcreteProblemOrWorkaround({ title: sigTitle, sanitizedExcerpt: sigExcerpt, problemSummary: sigSummary }) &&
            /\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|are harnesses worth the cost)\b/i.test(`${sigTitle} ${sigExcerpt}`))
        ) {
          await prisma.normalizedSignal.update({
            where: { id: sig.id },
            data: {
              signalType: "NOISE" as any,
              verificationStatus: "REJECTED" as any,
              isProcessed: true,
              metadata: { ...sigMeta, processingStatus: "REJECTED_NOISE", processedAt: new Date().toISOString() },
            },
          }).catch(() => {});
          continue;
        }

        // Mark pure news/preprint items without concrete problem friction as processed so they stay in Market Signals feed without clogging AI synthesis
        if (
          ["arxiv", "cisakev", "krasia", "siliconcanals"].includes(srcKey) &&
          !isConcreteProblemOrWorkaround({ title: sigTitle, sanitizedExcerpt: sigExcerpt, problemSummary: sigSummary })
        ) {
          if (!sig.isProcessed) {
            await prisma.normalizedSignal.update({
              where: { id: sig.id },
              data: {
                isProcessed: true,
                metadata: { ...sigMeta, processingStatus: "SKIPPED_NON_PROBLEM_FEED_ITEM", processedAt: new Date().toISOString() },
              },
            }).catch(() => {});
          }
          continue;
        }

        // Bounded retry check
        if (!sig.isProcessed && attempts >= 3) {
          await prisma.normalizedSignal.update({
            where: { id: sig.id },
            data: {
              isProcessed: true,
              metadata: { ...sigMeta, processingStatus: "MAX_RETRIES_EXCEEDED", processedAt: new Date().toISOString() },
            },
          }).catch(() => {});
          continue;
        }

        // If already processed in a prior run and valid, reuse its extracted problemSummary directly without burning LLM budget
        if (sig.isProcessed === true && sigSummary.length >= 15 && sig.signalType !== "NOISE") {
          if (preProcessedClusterCandidates.length < maxHistoricalSignals) {
            try {
              const emb = await aiProvider.generateEmbedding(sigSummary);
              preProcessedClusterCandidates.push({
                id: sig.id,
                problemSummary: sigSummary,
                vertical: String(sigMeta.vertical || "Software Engineering & DevOps"),
                embedding: emb.embedding,
              });
              alreadyPresentRawIds.add(sig.rawSignal.id);
              historicalSignalsCount++;
            } catch {}
          }
          continue;
        }

        if (addedHistoricalUnfinished < maxHistoricalSignals) {
          sanitizedSignalsToProcess.push({
            rawSignalId: sig.rawSignal.id,
            normalizedSignalId: sig.id,
            externalId: sig.rawSignal.externalId,
            title: sigTitle,
            excerpt: sigExcerpt,
            sourceKey: srcKey,
            sourceId: sig.rawSignal.source.id,
            sourceName: sig.rawSignal.source.name,
          });
          alreadyPresentRawIds.add(sig.rawSignal.id);
          historicalSignalsCount++;
          addedHistoricalUnfinished++;
        } else {
          remainingBacklogCount++;
        }
      }
    }

    const currentSignalsCount = sanitizedSignalsToProcess.length;

    // Sort signals to process so concrete customer complaints & workarounds from high-signal sources are classified first
    if (sanitizedSignalsToProcess.length > 6) {
      const prioMap: Record<string, number> = {
        hackernews: 1,
        github: 2,
        stackexchange: 3,
        lobsters: 4,
        ted: 5,
        reddit: 6,
      };
      sanitizedSignalsToProcess.sort((a, b) => {
        const aConcrete = isConcreteProblemOrWorkaround({ title: a.title, sanitizedExcerpt: a.excerpt }) ? 0 : 1;
        const bConcrete = isConcreteProblemOrWorkaround({ title: b.title, sanitizedExcerpt: b.excerpt }) ? 0 : 1;
        if (aConcrete !== bConcrete) return aConcrete - bConcrete;
        return (prioMap[a.sourceKey] || 20) - (prioMap[b.sourceKey] || 20);
      });
    }

    // 4. AI Classification & Extraction
    const clusterCandidates: ClusterCandidate[] = [];

    for (let idx = 0; idx < sanitizedSignalsToProcess.length; idx++) {
      const item = sanitizedSignalsToProcess[idx];
      if (!item) continue;
      if (Date.now() > Math.min(aiDeadline, deadline - 4000)) {
        remainingBacklogCount += (sanitizedSignalsToProcess.length - idx);
        break;
      }
      if (typeof maxClassifiedSignals === "number" && clusterCandidates.length >= maxClassifiedSignals) {
        remainingBacklogCount += (sanitizedSignalsToProcess.length - idx);
        break;
      }

      // Immediately reject repo-internal AI coding agent chores or vague meta-critiques without wasting LLM budget
      if (
        /vague question about|without industry context/i.test(`${item.title} ${item.excerpt}`) ||
        /\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|are harnesses worth the cost)\b/i.test(`${item.title} ${item.excerpt}`)
      ) {
        await prisma.normalizedSignal.update({
          where: { id: item.normalizedSignalId },
          data: {
            signalType: "NOISE" as any,
            verificationStatus: "REJECTED" as any,
            isProcessed: true,
            metadata: { processingStatus: "REJECTED_NOISE", processedAt: new Date().toISOString() },
          },
        }).catch(() => {});
        continue;
      }

      // Skip LLM calls for obvious non-problem news/research items when batch has > 6 signals
      if (
        sanitizedSignalsToProcess.length > 6 &&
        ["arxiv", "cisakev", "krasia", "siliconcanals"].includes(item.sourceKey) &&
        !isConcreteProblemOrWorkaround({ title: item.title, sanitizedExcerpt: item.excerpt })
      ) {
        await prisma.normalizedSignal.update({
          where: { id: item.normalizedSignalId },
          data: {
            isProcessed: true,
            metadata: { processingStatus: "SKIPPED_NON_PROBLEM_FEED_ITEM", processedAt: new Date().toISOString() },
          },
        }).catch(() => {});
        continue;
      }

      try {
        const classification = await classifySignal(aiProvider, item.excerpt, item.title);
        if (classification.signalType === "NOISE") {
          await prisma.normalizedSignal.update({
            where: { id: item.normalizedSignalId },
            data: {
              signalType: "NOISE" as any,
              verificationStatus: "REJECTED" as any,
              isProcessed: true,
              metadata: {
                processingAttempts: 1,
                processingStatus: "REJECTED_NOISE",
                processedAt: new Date().toISOString(),
              },
            },
          }).catch(() => {});
          continue;
        }

        const extracted = await extractSignalIntelligence(aiProvider, item.excerpt, item.title);
        if (
          extracted.signalType === "NOISE" ||
          /vague question about|without industry context|not a real problem/i.test(extracted.problemSummary || "")
        ) {
          await prisma.normalizedSignal.update({
            where: { id: item.normalizedSignalId },
            data: {
              signalType: "NOISE" as any,
              verificationStatus: "REJECTED" as any,
              isProcessed: true,
              metadata: {
                processingAttempts: 1,
                processingStatus: "REJECTED_META_CRITIQUE",
                processedAt: new Date().toISOString(),
              },
            },
          }).catch(() => {});
          continue;
        }

        const emb = await aiProvider.generateEmbedding(extracted.problemSummary);

        let detectedVertical = "Software Engineering & DevOps";
        const combinedText = `${extracted.workflowContext || ""} ${item.excerpt || ""} ${item.title || ""}`.toLowerCase();
        if (combinedText.includes("devops") || combinedText.includes("compliance") || combinedText.includes("security") || combinedText.includes("soc2")) {
          detectedVertical = "DevOps & Compliance";
        } else if (combinedText.includes("data") || combinedText.includes("finops") || combinedText.includes("cloud cost") || combinedText.includes("warehouse")) {
          detectedVertical = "Data Engineering & FinOps";
        } else if (combinedText.includes("chip") || combinedText.includes("semiconductor") || combinedText.includes("hardware") || combinedText.includes("silicon")) {
          detectedVertical = "Semiconductors & DeepTech";
        } else if (combinedText.includes("battery") || combinedText.includes("energy") || combinedText.includes("cleantech") || combinedText.includes("climate")) {
          detectedVertical = "CleanTech & Climate";
        } else if (combinedText.includes("robot") || combinedText.includes("manufacturing") || combinedText.includes("automation")) {
          detectedVertical = "Robotics & Industrial Automation";
        } else if (combinedText.includes("fintech") || combinedText.includes("payment") || combinedText.includes("settlement")) {
          detectedVertical = "FinTech & Payments";
        }

        const preservedSignalType =
          item.sourceKey === "ted" || item.sourceKey === "samgov"
            ? "PROCUREMENT"
            : item.sourceKey === "arxiv"
            ? "EMERGING_TECH"
            : item.sourceKey === "stackexchange" && classification.signalType === "PAIN_COMPLAINT"
            ? "PAIN"
            : classification.signalType;

        await prisma.normalizedSignal.update({
          where: { id: item.normalizedSignalId },
          data: {
            signalType: preservedSignalType as any,
            purchaseIntent:
              classification.signalType === "PURCHASE_INTENT" ||
              classification.signalType === "WILLINGNESS_TO_PAY" ||
              Boolean(extracted.intentToPayScore && extracted.intentToPayScore > 50),
            problemSummary: extracted.problemSummary,
            actorRole: extracted.actorRole,
            workflowContext: extracted.workflowContext,
            severityScore: extracted.severityScore,
            frequencyScore: extracted.frequencyScore,
            intentToPayScore: extracted.intentToPayScore,
            extractedEntities: extracted.extractedEntities,
            confidenceScore: extracted.confidenceScore,
            isProcessed: true,
            metadata: {
              processingAttempts: 1,
              processingStatus: "COMPLETED",
              vertical: detectedVertical,
              processedAt: new Date().toISOString(),
            },
          },
        });

        clusterCandidates.push({
          id: item.normalizedSignalId,
          problemSummary: extracted.problemSummary,
          vertical: detectedVertical,
          embedding: emb.embedding,
        });
      } catch (aiErr: any) {
        logger.error("AI step encountered error", aiErr);
        const msg = String(aiErr?.message || "");

        let failCode = "AI_PROVIDER_UNAVAILABLE";
        if (msg.includes("AI_PROVIDER_NOT_CONFIGURED") || msg.includes("not configured")) {
          failCode = "AI_PROVIDER_NOT_CONFIGURED";
        } else if (msg.includes("AI_PROVIDER_AUTHENTICATION_FAILED")) {
          failCode = "AI_PROVIDER_AUTHENTICATION_FAILED";
        } else if (msg.includes("AI_MODEL_NOT_FOUND")) {
          failCode = "AI_MODEL_NOT_FOUND";
        } else if (msg.includes("AI_PROVIDER_ENDPOINT_INVALID")) {
          failCode = "AI_PROVIDER_ENDPOINT_INVALID";
        } else if (msg.includes("AI_PROVIDER_RATE_LIMITED")) {
          failCode = "AI_PROVIDER_RATE_LIMITED";
        } else if (msg.includes("AI_OUTPUT_TRUNCATED")) {
          failCode = "AI_OUTPUT_TRUNCATED";
        } else if (msg.includes("AI_OUTPUT_EMPTY")) {
          failCode = "AI_OUTPUT_EMPTY";
        } else if (msg.includes("AI_OUTPUT_INVALID") || msg.includes("invalid") || msg.includes("schema")) {
          failCode = "AI_OUTPUT_INVALID";
        }

        // If we already classified candidates and hit a transient timeout/rate-limit on a later item,
        // checkpoint the attempt count on this item and proceed to cluster & persist the candidates we have!
        const isFatalConfigError = [
          "AI_PROVIDER_NOT_CONFIGURED",
          "AI_PROVIDER_AUTHENTICATION_FAILED",
          "AI_MODEL_NOT_FOUND",
          "AI_PROVIDER_ENDPOINT_INVALID",
        ].includes(failCode);

        if (!isFatalConfigError && (clusterCandidates.length > 0 || preProcessedClusterCandidates.length > 0)) {
          await prisma.normalizedSignal.update({
            where: { id: item.normalizedSignalId },
            data: {
              metadata: {
                processingAttempts: 1,
                processingStatus: "RETRY_PENDING",
                lastError: msg.slice(0, 200),
                lastAttemptAt: new Date().toISOString(),
              },
            },
          }).catch(() => {});
          remainingBacklogCount += (sanitizedSignalsToProcess.length - idx);
          break;
        }

        const failSummary = {
          sourcesProcessed: activeSources.length,
          perSourceStats,
          errorMessage: msg,
        };

        await markRunFailed(prisma, runId, claimToken, failCode, {
          totalFetched,
          totalDeduplicated,
          rawSignalsCount,
          candidatesCount: 0,
          publishedCount: 0,
          summary: failSummary,
        });

        return {
          runId,
          idempotencyKey,
          status: "FAILED",
          failureCode: failCode,
          errorMessage: msg,
          counters: {
            fetched: totalFetched,
            deduplicated: totalDeduplicated,
            rawSignals: rawSignalsCount,
            rejected: totalRejected,
            candidates: 0,
            published: 0,
          },
          publishedSlugs: [],
          startedAt: now.toISOString(),
          failedAt: new Date().toISOString(),
          summary: failSummary,
        };
      }
    }

    // Merge any pre-processed unlinked candidates from previous runs
    for (const pre of preProcessedClusterCandidates) {
      if (!clusterCandidates.some((c) => c.id === pre.id)) {
        clusterCandidates.push(pre);
      }
    }

    candidatesCount = clusterCandidates.length;

    // 5. Semantic Clustering & Evidence Expansion Path
    const candidateEvaluations: any[] = [];
    let totalClustersDiscovered = 0;
    let matchedToTargetCount = 0;
    let unmatchedPoolCount = 0;

    // Clean up any stale invalid meta-critique opportunities before querying existing candidates
    try {
      const invalidExisting = await prisma.opportunity.findMany({
        where: { isDemoFixture: false },
        select: { id: true, slug: true, title: true },
        take: 20,
      }).catch(() => []);
      if (invalidExisting.some((o: any) => /vague-question-about|^vague question about|without industry context/i.test(`${o.slug || ""} ${o.title || ""}`))) {
        await cleanSyntheticStagingOpportunity(prisma);
      }
    } catch {}

    // Query for existing persisted candidates to expand evidence for and avoid duplicating
    const existingCandidates = await prisma.opportunity.findMany({
      where: { isDemoFixture: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        evidenceLinks: {
          include: {
            normalizedSignal: {
              include: {
                rawSignal: {
                  include: { source: true },
                },
              },
            },
          },
        },
      },
    }).catch(() => []);

    const validExistingCandidates = existingCandidates.filter(
      (o: any) => !/vague-question-about|^vague question about|without industry context/i.test(`${o.slug || ""} ${o.title || ""}`),
    );
    const targetCandidate = validExistingCandidates[0] || null;
    const allExistingLinkedSignalIds = new Set<string>();
    for (const existingOpp of validExistingCandidates) {
      for (const link of existingOpp.evidenceLinks || []) {
        if (link.normalizedSignalId) allExistingLinkedSignalIds.add(link.normalizedSignalId);
        if (link.normalizedSignal?.id) allExistingLinkedSignalIds.add(link.normalizedSignal.id);
      }
    }

    if (targetCandidate) {
      // 6a. Preserve existing candidate evidence and problem identity
      const targetOriginalSignals: Array<{
        normalizedSignal: any;
        rawSignal: any;
        source: any;
      }> = [];
      const targetOriginalSignalIds = new Set<string>();
      const originalUrls = new Set<string>();

      for (const link of targetCandidate.evidenceLinks || []) {
        const ns = link.normalizedSignal;
        if (ns && ns.rawSignal && ns.rawSignal.source) {
          if (!targetOriginalSignalIds.has(ns.id)) {
            targetOriginalSignalIds.add(ns.id);
            targetOriginalSignals.push({
              normalizedSignal: ns,
              rawSignal: ns.rawSignal,
              source: ns.rawSignal.source,
            });
            const u = ns.canonicalUrl || ns.rawSignal.sourceUrl;
            if (u) originalUrls.add(u);
          }
        }
      }

      let targetCentroid: number[] | null = null;
      try {
        const emb = await aiProvider.generateEmbedding(targetCandidate.problemStatement || targetCandidate.title);
        targetCentroid = emb.embedding;
      } catch {}

      const matchedToTarget: ClusterCandidate[] = [];
      const unmatchedPool: ClusterCandidate[] = [];

      for (const item of clusterCandidates) {
        if (targetOriginalSignalIds.has(item.id) || allExistingLinkedSignalIds.has(item.id)) continue;
        const sim = targetCentroid ? cosineSimilarity(item.embedding, targetCentroid) : 0;
        const sameProblem =
          sim >= 0.85 ||
          (sim >= 0.70 &&
            signalsSupportSameProblem(
              targetCandidate.title || "",
              targetCandidate.problemStatement || "",
              item.problemSummary,
              item.problemSummary,
            ));

        if (sameProblem) {
          // Verify that this candidate signal actually carries problem or demand evidence before attaching
          const normSig = await prisma.normalizedSignal.findUnique({
            where: { id: item.id },
            select: { signalType: true, purchaseIntent: true, sanitizedExcerpt: true, problemSummary: true },
          });
          const sigType = (normSig?.signalType || "").toUpperCase();
          const text = `${normSig?.sanitizedExcerpt || ""} ${normSig?.problemSummary || ""}`.toLowerCase();
          const hasCommercialEvidence =
            ["PAIN_COMPLAINT", "PAIN", "WORKAROUND_REQUEST", "WORKAROUND", "PURCHASE_INTENT", "WILLINGNESS_TO_PAY", "COMPETITOR_DISSATISFACTION", "COMPETITOR_COMPLAINT"].includes(sigType) ||
            normSig?.purchaseIntent ||
            /\b(costing|broken|slow|pain|waste|failing|error|leak|spike|manual|expensive|struggle|problem|bottleneck|hacky|workaround|issue|bug|frustrat|need a tool|looking for a tool|willing to pay)\b/i.test(text);

          const isPureNewsOrEmerging = ["EMERGING_TECH", "TECHNOLOGY_ENABLER", "MARKET_ACTIVITY", "NOISE"].includes(sigType);

          if (hasCommercialEvidence && !isPureNewsOrEmerging) {
            matchedToTarget.push(item);
          } else {
            unmatchedPool.push(item);
          }
        } else {
          unmatchedPool.push(item);
        }
      }
      matchedToTargetCount = matchedToTarget.length;
      unmatchedPoolCount = unmatchedPool.length;

      const newTargetVerifiedSignals: Array<{
        normalizedSignal: any;
        rawSignal: any;
        source: any;
      }> = [];

      for (const item of matchedToTarget) {
        const normSig = await prisma.normalizedSignal.findUnique({
          where: { id: item.id },
          include: {
            rawSignal: {
              include: { source: true },
            },
          },
        });

        if (normSig && normSig.rawSignal && normSig.rawSignal.source) {
          newTargetVerifiedSignals.push({
            normalizedSignal: normSig,
            rawSignal: normSig.rawSignal,
            source: normSig.rawSignal.source,
          });
        }
      }

      const allTargetSignals = [...targetOriginalSignals, ...newTargetVerifiedSignals];
      const targetClaimLinks = buildEmpiricalClaimLinks(allTargetSignals);
      const targetCommercialIndicators = deriveSupportedCommercialIndicators(allTargetSignals);
      const targetQualityResult = evaluatePublicationQuality(
        targetClaimLinks,
        targetCommercialIndicators.evidenceConfidenceScore,
      );

      const targetFinalStatus = "PUBLISHED";
      const targetPubQualityStatus = targetQualityResult.status || "HYPOTHESIS";

      if (newTargetVerifiedSignals.length > 0) {
        // Synthesize updated blueprint with combined evidence
        const clusterProxy: ProblemClusterResult = {
          clusterId: `cluster-target-${targetCandidate.id}`,
          title: targetCandidate.title,
          summary: targetCandidate.problemStatement,
          vertical: targetCandidate.industry || "DevOps & Compliance",
          signalIds: allTargetSignals.map((s) => s.normalizedSignal.id),
          centroid: targetCentroid || new Array(64).fill(0),
        };

        const updatedBlueprint = synthesizeOpportunity(clusterProxy, allTargetSignals.length);
        const audience = deriveSpecificAudience(`${targetCandidate.title} ${targetCandidate.problemStatement}`);
        const productDirection = derivePlausibleProductDirection(targetCandidate.problemStatement || targetCandidate.title, audience);
        const validationExperiment = deriveSpecificValidationExperiment(targetCandidate.problemStatement || targetCandidate.title, audience);
        const domainAlternatives = deriveDomainAlternatives(
          `${targetCandidate.title || ""} ${targetCandidate.problemStatement || ""}`,
        );
        const evidenceGaps = deriveEvidenceGaps(
          targetCandidate.problemStatement,
          audience,
          allTargetSignals.length > 1,
          allTargetSignals.some((s) => s.normalizedSignal.purchaseIntent),
        );

        updatedBlueprint.economicBuyer = `[Assumption] ${audience} Leadership`;
        updatedBlueprint.endUser = `[Assumption] ${audience}`;
        updatedBlueprint.targetCustomerSegments = [`[Assumption] ${audience}`];
        updatedBlueprint.proposedProduct = `[Assumption] ${productDirection}`;
        updatedBlueprint.existingWorkflow = domainAlternatives.existingWorkflow;
        updatedBlueprint.evidenceOfDemand = targetCommercialIndicators.evidenceOfDemand;
        updatedBlueprint.evidenceOfWillingnessToPay = targetCommercialIndicators.evidenceOfWillingnessToPay;
        updatedBlueprint.recommendedNextExperiment = validationExperiment;
        updatedBlueprint.majorAssumptions = [
          `[Assumption] Inferred target customer segment: ${audience}`,
          `[Assumption] Proposed solution direction: ${productDirection}`,
          `[Assumption] Commercial willingness to pay requires direct buyer validation`,
          ...updatedBlueprint.majorAssumptions.filter((a) => !a.startsWith("[Assumption]")),
        ];
        updatedBlueprint.majorRisks = evidenceGaps;
        updatedBlueprint.existingCompetitors = domainAlternatives.competitors;
        updatedBlueprint.competitorWeaknesses = domainAlternatives.weaknesses;

        const customerSegments: CustomerSegmentItem[] = updatedBlueprint.targetCustomerSegments.map((name) => ({
          id: "seg-" + crypto.randomUUID(),
          segmentName: name,
          industry: targetCandidate.industry,
          companySizeRange: "10-250 employees",
          geography: "Global / Remote",
          businessModel: "B2B SaaS",
          economicBuyerRole: updatedBlueprint.economicBuyer,
          endUserRole: updatedBlueprint.endUser,
          procurementComplexity: "LOW",
          budgetCategory: "ENGINEERING_TOOLS",
          spendingBehavior: "CREDIT_CARD",
          buyingTrigger: updatedBlueprint.buyingTrigger,
          primaryObjection: "Budget and integration bandwidth",
          acquisitionChannels: ["GITHUB", "COMMUNITY"],
          salesCycleMinDays: 7,
          salesCycleMaxDays: 30,
          salesMotion: "FOUNDER_LED",
          confidenceScore: 80,
          provenanceType: "MODEL_ESTIMATE",
          evidenceLinkIds: [],
        }));

        const mvpFeatures: MvpFeatureItem[] = updatedBlueprint.narrowMvpScope.map((name, idx) => ({
          id: "feat-" + crypto.randomUUID(),
          featureName: name,
          description: name,
          category: "MUST_HAVE",
          userJourneyStep: "ONBOARDING",
          requiredIntegrations: ["GITHUB_ACTIONS"],
          requiredData: ["PULL_REQUEST_METADATA"],
          dependencies: [],
          acceptanceCriteria: ["Validates within 5 minutes"],
          orderIndex: idx,
        }));

        const competitors: CompetitorItem[] = (updatedBlueprint.existingCompetitors || []).map((name) => ({
          id: "comp-" + crypto.randomUUID(),
          name,
          competitorType: "DIRECT",
          differentiationHypothesis: updatedBlueprint.competitorWeaknesses?.[0] || "Lightweight and automated",
          switchingCosts: "MEDIUM",
          strengths: ["Brand awareness"],
          recurringComplaints: ["High enterprise cost"],
          provenanceType: "MODEL_ESTIMATE",
          evidenceLinkIds: [],
        }));

        const costs: CostLineItemData[] = [
          {
            id: "cost-" + crypto.randomUUID(),
            costType: "ONE_TIME_BUILD",
            category: "BACKEND_DEV",
            title: "MVP Engineering Build",
            scenarioType: "BASE",
            amountMinorCents: updatedBlueprint.economics.estimatedMvpCost.minMinor,
            currency: "USD",
            estimateMethod: "Engineering hours benchmark",
            provenanceType: "MODEL_ESTIMATE",
            evidenceLinkIds: [],
            assumptionIds: [],
            confidenceScore: 80,
          },
        ];

        const benefits: BenefitDriverData[] = [
          {
            id: "ben-" + crypto.randomUUID(),
            category: "LABOR_TIME_SAVED",
            title: "Engineering Hours Saved",
            affectedRole: updatedBlueprint.endUser,
            unitQuantity: 30,
            unitValueCents: 7500,
            annualValueCents: 2700000,
            frequencyPeriod: "MONTHLY",
            calculationDescription: "30 hours/mo saved at $75/hr",
            provenanceType: "MODEL_ESTIMATE",
            evidenceLinkIds: [],
            assumptionIds: [],
            confidenceScore: 80,
          },
        ];

        const risks: RiskItem[] = (updatedBlueprint.majorRisks || []).map((desc) => ({
          id: "risk-" + crypto.randomUUID(),
          category: "TECHNICAL",
          severity: "MEDIUM",
          description: desc,
          impactScore: 3,
          probabilityScore: 3,
          mitigationStrategy: "Build resilient multi-cloud adapters",
          status: "IDENTIFIED",
          provenanceType: "MODEL_ESTIMATE",
          evidenceLinkIds: [],
        }));

        const assumptions: AssumptionItem[] = (updatedBlueprint.majorAssumptions || []).map((stmt) => ({
          id: "asm-" + crypto.randomUUID(),
          category: "PROBLEM",
          statement: stmt,
          importanceScore: 4,
          uncertaintyScore: 3,
          status: "UNTESTED",
          testMethod: "Customer interview campaign",
          successThreshold: ">= 60% validation",
          failureThreshold: "< 30% validation",
          provenanceType: "ASSUMPTION",
          evidenceLinkIds: [],
        }));

        const experiments: ValidationExperimentItem[] = [
          {
            id: "exp-" + crypto.randomUUID(),
            hypothesis: updatedBlueprint.recommendedNextExperiment,
            experimentType: "PREORDER",
            targetParticipant: updatedBlueprint.economicBuyer,
            sampleSize: 5,
            estimatedCostCents: 50000,
            estimatedDurationDays: 14,
            acquisitionChannel: "DIRECT_OUTREACH",
            procedureSummary: "Reach out to 5 qualified engineering leaders",
            successMetric: "Paid preorder commitments",
            successThreshold: ">= 3 commitments",
            failureThreshold: "< 1 commitment",
            killCriterion: "Zero responses after 20 outreach attempts",
            nextActionOnSuccess: "Build MVP",
            nextActionOnFailure: "Pivot value proposition",
            status: "PLANNED",
            orderPriority: 1,
            evidenceGeneratedIds: [],
          },
        ];

        const revisionResult = await createOpportunityRevisionTransaction(prisma, {
          opportunityId: targetCandidate.id,
          reasonForChange: "Focused staging evidence expansion pass",
          architectureSummary: updatedBlueprint.proposedProduct,
          customerSegments,
          mvpFeatures,
          competitors,
          scenarios: [
            {
              scenarioType: "BASE",
              currency: "USD",
              activeCustomers: 50,
              monthlyPriceCents: 19900,
              onboardingPriceCents: 0,
              variableCostPerCustomerCents: 500,
              monthlyFixedCostCents: 30000,
              customerAcquisitionCostCents: 25000,
              deliveryTimeWeeks: 6,
              assumptions: ["Standard self-serve onboarding conversion"],
              evidenceIds: [],
            },
          ],
          costs,
          benefits,
          risks,
          assumptions,
          experiments,
          opportunityScore: targetCommercialIndicators.opportunityScore,
          evidenceConfidence: targetCommercialIndicators.evidenceConfidenceScore,
          criticalClaimsCovered: allTargetSignals.length,
          costSummary: {
            minBuildMinorCents: updatedBlueprint.economics.estimatedMvpCost.minMinor,
            maxBuildMinorCents: updatedBlueprint.economics.estimatedMvpCost.maxMinor,
            minWeeks: updatedBlueprint.economics.estimatedTimeToMvpWeeks.min,
            maxWeeks: updatedBlueprint.economics.estimatedTimeToMvpWeeks.max,
            minMonthlyOpMinorCents: updatedBlueprint.economics.estimatedMonthlyOperatingCost.minMinor,
            maxMonthlyOpMinorCents: updatedBlueprint.economics.estimatedMonthlyOperatingCost.maxMinor,
          },
          snapshotData: updatedBlueprint,
        });

        for (const item of newTargetVerifiedSignals) {
          const claimType = determineEmpiricalClaimType(
            item.normalizedSignal.signalType,
            item.normalizedSignal.sanitizedExcerpt,
            item.normalizedSignal.actorRole,
          );
          try {
            await prisma.evidenceLink.create({
              data: {
                opportunityId: targetCandidate.id,
                opportunityRevisionId: revisionResult.revisionId,
                normalizedSignalId: item.normalizedSignal.id,
                claimType: claimType as any,
                claimIdentifier: "claim-pain-" + targetCandidate.id,
                claimSnippet: item.normalizedSignal.sanitizedExcerpt || item.normalizedSignal.problemSummary || "Empirical signal evidence",
                relationshipType: "SUPPORTS",
                supportStrength: "STRONG",
                explanation: `Empirically verified from ${item.source.name} (${item.rawSignal.sourceUrl})`,
                relevanceScore: 0.9,
              },
            });
          } catch (linkErr: any) {
            logger.warn("Failed creating EvidenceLink", { message: linkErr?.message });
          }
        }
      }

      await prisma.opportunity.update({
        where: { id: targetCandidate.id },
        data: {
          status: targetFinalStatus,
          publicationQualityStatus: targetPubQualityStatus,
        },
      });

      const targetAddedUrls = Array.from(
        new Set(newTargetVerifiedSignals.map((s) => s.rawSignal.sourceUrl || s.normalizedSignal.canonicalUrl).filter(Boolean)),
      );

      if (newTargetVerifiedSignals.length > 0 || unmatchedPool.length === 0) {
        candidateEvaluations.push({
          id: targetCandidate.id,
          title: targetCandidate.title,
          slug: targetCandidate.slug,
          status: targetFinalStatus,
          publicationQualityStatus: targetPubQualityStatus,
          originalUrls: Array.from(originalUrls),
          addedUrls: targetAddedUrls,
          supportingUrls: Array.from(new Set(allTargetSignals.map((vs) => vs.rawSignal.sourceUrl))),
          independenceKeys: Array.from(
            new Set(
              allTargetSignals.map((vs) => vs.normalizedSignal.independenceKey || `id:${vs.normalizedSignal.id}`),
            ),
          ),
          sourceFamilies: Array.from(
            new Set(
              allTargetSignals
                .map((vs) => (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : vs.source.key === "krasia" || vs.source.key === "e27" ? "DISCOVERY" : vs.source.sourceFamily || "COMMUNITY"))
                .filter(Boolean),
            ),
          ),
          blockers: targetQualityResult.blockers,
          warnings: targetQualityResult.warnings,
          metrics: targetQualityResult.metrics,
        });

        if (publishedCount < maxPublishedOpportunities) {
          publishedSlugs.push(targetCandidate.slug);
          publishedCount++;
        }
      }

      // 6b. Cluster genuinely different problems into separate candidates
      if (unmatchedPool.length > 0 && candidateEvaluations.length < maxCandidates) {
        const newClusters = clusterSignals(unmatchedPool, 0.72);
        newClusters.sort((a, b) => b.signalIds.length - a.signalIds.length);
        totalClustersDiscovered += newClusters.length;
        const availableCandidateSlots = Math.max(0, maxCandidates - candidateEvaluations.length);
        for (const cl of newClusters) {
          if (Date.now() > deadline || candidateEvaluations.length >= maxCandidates || publishedCount >= maxPublishedOpportunities) break;
          if (availableCandidateSlots <= 0) break;
          const verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }> = [];
          for (const sigId of cl.signalIds) {
            const normSig = await prisma.normalizedSignal.findUnique({
              where: { id: sigId },
              include: { rawSignal: { include: { source: true } } },
            });
            if (normSig && normSig.rawSignal && normSig.rawSignal.source) {
              verifiedSignals.push({ normalizedSignal: normSig, rawSignal: normSig.rawSignal, source: normSig.rawSignal.source });
            }
          }
          if (verifiedSignals.length === 0) continue;

          // Gating: An opportunity hypothesis may only be created if the cluster contains genuine evidence
          // of a concrete problem, workaround, or willingness to pay / purchase intent.
          const hasCommercialProblemEvidence = verifiedSignals.some((vs) => {
            const sigType = (vs.normalizedSignal.signalType || "").toUpperCase();
            const title = vs.rawSignal.title || vs.normalizedSignal.sourceTitle || "";
            const excerpt = vs.normalizedSignal.sanitizedExcerpt || "";
            const summary = vs.normalizedSignal.problemSummary || "";
            const text = `${title} ${excerpt} ${summary}`.toLowerCase();
            if (/vague question about|without industry context/i.test(text)) return false;
            if (/\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|are harnesses worth the cost)\b/i.test(text)) {
              return false;
            }
            const isActionableType = ["PAIN_COMPLAINT", "PAIN", "PROBLEM_STATEMENT", "WORKAROUND_REQUEST", "WORKAROUND", "PURCHASE_INTENT", "WILLINGNESS_TO_PAY", "COMPETITOR_DISSATISFACTION", "COMPETITOR_COMPLAINT"].includes(sigType);
            const hasExplicitPain = /\b(costing|broken|slow|pain|waste|failing|error|leak|spike|manual|expensive|struggle|problem|bottleneck|hacky|workaround|issue|bug|frustrat|need a tool|looking for a tool|willing to pay|timeout|outage|drift|reconcil)\b/i.test(text);
            const isPureNews = ["EMERGING_TECH", "TECHNOLOGY_ENABLER", "MARKET_ACTIVITY", "NOISE"].includes(sigType);
            return (isActionableType || vs.normalizedSignal.purchaseIntent || hasExplicitPain) && !isPureNews;
          });

          if (!hasCommercialProblemEvidence) {
            // Signal remains in database as authentic Market Signal feed item, but is NOT synthesized into a business hypothesis
            continue;
          }

          const briefRes = await buildAndPersistOpportunityBrief(
            prisma,
            cl,
            verifiedSignals,
            deadline,
            processedHashes,
          );

          candidateEvaluations.push({
            id: briefRes.opp.id,
            title: briefRes.formattedTitle,
            slug: briefRes.generatedSlug,
            status: briefRes.finalStatus,
            publicationQualityStatus: briefRes.pubQualityStatus,
            originalUrls: [],
            addedUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
            supportingUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
            independenceKeys: Array.from(new Set(verifiedSignals.map((vs) => vs.normalizedSignal.independenceKey || `id:${vs.normalizedSignal.id}`))),
            sourceFamilies: Array.from(new Set(verifiedSignals.map((vs) => (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : vs.source.key === "krasia" || vs.source.key === "e27" ? "DISCOVERY" : vs.source.sourceFamily || "COMMUNITY")).filter(Boolean))),
            blockers: briefRes.qualityResult.blockers,
            warnings: briefRes.qualityResult.warnings,
            metrics: briefRes.qualityResult.metrics,
          });

          if (publishedCount < maxPublishedOpportunities) {
            publishedSlugs.push(briefRes.generatedSlug);
            publishedCount++;
          }
        }
      }

    } else {
      // 6c. Cold initial clustering when no previous opportunity exists
      const clusters = clusterCandidates.length > 0 ? clusterSignals(clusterCandidates, 0.72) : [];
      clusters.sort((a, b) => b.signalIds.length - a.signalIds.length);
      totalClustersDiscovered = clusters.length;

      for (const cl of clusters) {
        if (Date.now() > deadline || candidateEvaluations.length >= maxCandidates || publishedCount >= maxPublishedOpportunities) break;

        const verifiedSignals: Array<{ normalizedSignal: any; rawSignal: any; source: any }> = [];
        for (const sigId of cl.signalIds) {
          const normSig = await prisma.normalizedSignal.findUnique({
            where: { id: sigId },
            include: { rawSignal: { include: { source: true } } },
          });
          if (normSig && normSig.rawSignal && normSig.rawSignal.source) {
            verifiedSignals.push({ normalizedSignal: normSig, rawSignal: normSig.rawSignal, source: normSig.rawSignal.source });
          }
        }
        if (verifiedSignals.length === 0) continue;

        // Gating: An opportunity hypothesis may only be created if the cluster contains genuine evidence
        // of a concrete problem, workaround, or willingness to pay / purchase intent.
        const hasCommercialProblemEvidence = verifiedSignals.some((vs) => {
          const sigType = (vs.normalizedSignal.signalType || "").toUpperCase();
          const title = vs.rawSignal.title || vs.normalizedSignal.sourceTitle || "";
          const excerpt = vs.normalizedSignal.sanitizedExcerpt || "";
          const summary = vs.normalizedSignal.problemSummary || "";
          const text = `${title} ${excerpt} ${summary}`.toLowerCase();
          if (/vague question about|without industry context/i.test(text)) return false;
          if (/\b(ready-for-agent|ai text below|create a branch and open a pr|parent:\s*#\d+|epic\s*#\d+|are harnesses worth the cost)\b/i.test(text)) {
            return false;
          }
          const isActionableType = ["PAIN_COMPLAINT", "PAIN", "PROBLEM_STATEMENT", "WORKAROUND_REQUEST", "WORKAROUND", "PURCHASE_INTENT", "WILLINGNESS_TO_PAY", "COMPETITOR_DISSATISFACTION", "COMPETITOR_COMPLAINT"].includes(sigType);
          const hasExplicitPain = /\b(costing|broken|slow|pain|waste|failing|error|leak|spike|manual|expensive|struggle|problem|bottleneck|hacky|workaround|issue|bug|frustrat|need a tool|looking for a tool|willing to pay|timeout|outage|drift|reconcil)\b/i.test(text);
          const isPureNews = ["EMERGING_TECH", "TECHNOLOGY_ENABLER", "MARKET_ACTIVITY", "NOISE"].includes(sigType);
          return (isActionableType || vs.normalizedSignal.purchaseIntent || hasExplicitPain) && !isPureNews;
        });

        if (!hasCommercialProblemEvidence) {
          // Signal remains in database as authentic Market Signal feed item, but is NOT synthesized into a business hypothesis
          continue;
        }

        const briefRes = await buildAndPersistOpportunityBrief(
          prisma,
          cl,
          verifiedSignals,
          deadline,
          processedHashes,
        );

        candidateEvaluations.push({
          id: briefRes.opp.id,
          title: briefRes.formattedTitle,
          slug: briefRes.generatedSlug,
          status: briefRes.finalStatus,
          publicationQualityStatus: briefRes.pubQualityStatus,
          originalUrls: [],
          addedUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
          supportingUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
          independenceKeys: Array.from(new Set(verifiedSignals.map((vs) => vs.normalizedSignal.independenceKey || `id:${vs.normalizedSignal.id}`))),
          sourceFamilies: Array.from(new Set(verifiedSignals.map((vs) => (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : vs.source.key === "krasia" || vs.source.key === "e27" ? "DISCOVERY" : vs.source.sourceFamily || "COMMUNITY")).filter(Boolean))),
          blockers: briefRes.qualityResult.blockers,
          warnings: briefRes.qualityResult.warnings,
          metrics: briefRes.qualityResult.metrics,
        });

        if (publishedCount < maxPublishedOpportunities) {
          publishedSlugs.push(briefRes.generatedSlug);
          publishedCount++;
        }
      }
    }

    // 7. Complete the IngestionRun
    const runSummary = {
      sourcesProcessed: activeSources.length,
      clustersDiscovered: totalClustersDiscovered,
      normalizedSignalsCount,
      historicalSignalsCount,
      currentSignalsCount,
      candidatesClassifiedCount: clusterCandidates.length,
      matchedToTargetCount,
      unmatchedPoolCount,
      remainingBacklogCount,
      hasMorePending: remainingBacklogCount > 0,
      perSourceStats,
      candidateEvaluations,
    };

    const finalCandidatesCount = Math.max(candidatesCount, candidateEvaluations.length);

    await markRunCompleted(prisma, runId, {
      totalFetched,
      totalDeduplicated,
      rawSignalsCount,
      candidatesCount: finalCandidatesCount,
      publishedCount,
      publishedSlugs,
      summary: runSummary,
    });

    logger.info("Manual staging ingestion finished successfully", {
      runId,
      publishedCount,
      publishedSlugs,
      historicalSignalsCount,
      currentSignalsCount,
      candidatesClassifiedCount: clusterCandidates.length,
      clustersDiscovered: totalClustersDiscovered,
      candidateEvaluationsCount: candidateEvaluations.length,
    });

    return {
      runId,
      idempotencyKey,
      status: "COMPLETED",
      counters: {
        fetched: totalFetched,
        deduplicated: totalDeduplicated,
        rawSignals: rawSignalsCount,
        rejected: totalRejected,
        candidates: finalCandidatesCount,
        published: publishedCount,
      },
      publishedSlugs,
      startedAt: now.toISOString(),
      completedAt: new Date().toISOString(),
      summary: runSummary,
    };

  } catch (error: any) {
    logger.error("Error executing staging ingestion pipeline", error);
    const msg = String(error?.message || "");

    let sanitizedCode = "EXECUTION_ERROR";
    if (msg.includes("AI_PROVIDER_NOT_CONFIGURED") || msg.includes("not configured")) {
      sanitizedCode = "AI_PROVIDER_NOT_CONFIGURED";
    } else if (msg.includes("AI_PROVIDER_AUTHENTICATION_FAILED")) {
      sanitizedCode = "AI_PROVIDER_AUTHENTICATION_FAILED";
    } else if (msg.includes("AI_MODEL_NOT_FOUND")) {
      sanitizedCode = "AI_MODEL_NOT_FOUND";
    } else if (msg.includes("AI_PROVIDER_ENDPOINT_INVALID")) {
      sanitizedCode = "AI_PROVIDER_ENDPOINT_INVALID";
    } else if (msg.includes("AI_PROVIDER_RATE_LIMITED")) {
      sanitizedCode = "AI_PROVIDER_RATE_LIMITED";
    } else if (msg.includes("AI_OUTPUT_TRUNCATED")) {
      sanitizedCode = "AI_OUTPUT_TRUNCATED";
    } else if (msg.includes("AI_OUTPUT_EMPTY")) {
      sanitizedCode = "AI_OUTPUT_EMPTY";
    } else if (msg.includes("AI_OUTPUT_INVALID")) {
      sanitizedCode = "AI_OUTPUT_INVALID";
    } else if (msg.includes("AI_PROVIDER_UNAVAILABLE") || msg.includes("UNAVAILABLE")) {
      sanitizedCode = "AI_PROVIDER_UNAVAILABLE";
    }

    const outerFailSummary = {
      sourcesProcessed: activeSources?.length || 0,
      perSourceStats: typeof perSourceStats !== "undefined" ? perSourceStats : {},
      errorMessage: msg,
    };

    await markRunFailed(prisma, runId, claimToken, sanitizedCode, {
      totalFetched,
      totalDeduplicated,
      rawSignalsCount,
      candidatesCount,
      publishedCount: 0,
      summary: outerFailSummary,
    });

    return {
      runId,
      idempotencyKey,
      status: "FAILED",
      failureCode: sanitizedCode,
      errorMessage: msg,
      counters: {
        fetched: totalFetched,
        deduplicated: totalDeduplicated,
        rawSignals: rawSignalsCount,
        rejected: totalRejected,
        candidates: candidatesCount,
        published: 0,
      },
      publishedSlugs: [],
      startedAt: now.toISOString(),
      failedAt: new Date().toISOString(),
      summary: outerFailSummary,
    };
  }
}

interface LeaseResult {
  run: any;
  isExisting: boolean;
  action: "RETURN_EXISTING" | "IN_PROGRESS" | "RECLAIMED" | "CREATED";
}

async function acquireIngestionLease(
  prisma: any,
  options: {
    idempotencyKey: string;
    workerId: string;
    claimToken: string;
    now: Date;
    lockedUntil: Date;
    forceRetry?: boolean;
  },
): Promise<LeaseResult> {
  const { idempotencyKey, workerId, claimToken, now, lockedUntil, forceRetry = false } = options;

  // 1. Try IngestionRun model
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.ingestionRun.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        if (existing.status === "COMPLETED" && !forceRetry) {
          return { run: existing, isExisting: true, action: "RETURN_EXISTING" as const };
        }

        const isLeaseActive = existing.lockedUntil && new Date(existing.lockedUntil) > new Date();
        if (existing.status === "PROCESSING" && isLeaseActive && !forceRetry) {
          return { run: existing, isExisting: true, action: "IN_PROGRESS" as const };
        }

        const reclaimed = await tx.ingestionRun.update({
          where: { id: existing.id },
          data: {
            status: "PROCESSING",
            failureCode: null,
            claimToken,
            lockedBy: workerId,
            lockedAt: now,
            lockedUntil,
            attemptCount: { increment: 1 },
            startedAt: now,
          },
        });
        return { run: reclaimed, isExisting: false, action: "RECLAIMED" as const };
      }

      const activeOtherRun = await tx.ingestionRun.findFirst({
        where: {
          status: "PROCESSING",
          lockedUntil: { gt: now },
        },
      });

      if (activeOtherRun) {
        throw new Error("CONCURRENT_RUN_IN_PROGRESS");
      }

      const created = await tx.ingestionRun.create({
        data: {
          idempotencyKey,
          status: "PROCESSING",
          claimToken,
          lockedBy: workerId,
          lockedAt: now,
          lockedUntil,
          attemptCount: 1,
          startedAt: now,
        },
      });
      return { run: created, isExisting: false, action: "CREATED" as const };
    });

    return result;
  } catch (err: any) {
    if (err?.message === "CONCURRENT_RUN_IN_PROGRESS") {
      throw err;
    }
    logger.info("IngestionRun model lease attempt skipped, using AuditLog lease fallback", { message: err?.message });
  }

  // 2. AuditLog durable fallback
  return await prisma.$transaction(async (tx: any) => {
    const logs = await tx.auditLog.findMany({
      where: { entityType: "IngestionRun" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Resolve latest state for each run by its entityId / details.id
    const latestStateByRunId = new Map<string, any>();
    for (const l of logs) {
      const details = l.details as any;
      const rId = details?.id || l.entityId;
      if (rId && !latestStateByRunId.has(rId)) {
        latestStateByRunId.set(rId, { log: l, details });
      }
    }

    let existingLog: any = null;
    let concurrentLog: any = null;

    for (const entry of latestStateByRunId.values()) {
      const details = entry.details;
      if (details?.idempotencyKey === idempotencyKey) {
        existingLog = entry;
      } else if (
        details?.status === "PROCESSING" &&
        details?.lockedUntil &&
        new Date(details.lockedUntil) > now
      ) {
        concurrentLog = entry;
      }
    }

    if (existingLog) {
      const details = existingLog.details;
      if (details.status === "COMPLETED" && !forceRetry) {
        return { run: details, isExisting: true, action: "RETURN_EXISTING" as const };
      }
      const isLeaseActive = details.lockedUntil && new Date(details.lockedUntil) > now;
      if (details.status === "PROCESSING" && isLeaseActive && !forceRetry) {
        return { run: details, isExisting: true, action: "IN_PROGRESS" as const };
      }

      const updatedDetails = {
        ...details,
        status: "PROCESSING",
        failureCode: null,
        claimToken,
        lockedBy: workerId,
        lockedAt: now.toISOString(),
        lockedUntil: lockedUntil.toISOString(),
        attemptCount: (details.attemptCount || 1) + 1,
        startedAt: now.toISOString(),
      };

      await tx.auditLog.create({
        data: {
          action: "STAGING_INGESTION_RUN",
          entityType: "IngestionRun",
          entityId: details.id,
          details: updatedDetails,
        },
      });
      return { run: updatedDetails, isExisting: false, action: "RECLAIMED" as const };
    }

    if (concurrentLog) {
      throw new Error("CONCURRENT_RUN_IN_PROGRESS");
    }

    const runId = "run-" + crypto.randomUUID();
    const newRunDetails = {
      id: runId,
      idempotencyKey,
      status: "PROCESSING",
      claimToken,
      lockedBy: workerId,
      lockedAt: now.toISOString(),
      lockedUntil: lockedUntil.toISOString(),
      attemptCount: 1,
      startedAt: now.toISOString(),
      counters: { fetched: 0, deduplicated: 0, rawSignals: 0, candidates: 0, published: 0 },
      publishedSlugs: [],
    };

    await tx.auditLog.create({
      data: {
        action: "STAGING_INGESTION_RUN",
        entityType: "IngestionRun",
        entityId: runId,
        details: newRunDetails,
      },
    });

    return { run: newRunDetails, isExisting: false, action: "CREATED" as const };
  });
}

async function markRunCompleted(
  prisma: any,
  runId: string,
  data: any,
): Promise<void> {
  try {
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalFetched: data.totalFetched,
        totalDeduplicated: data.totalDeduplicated,
        rawSignalsCount: data.rawSignalsCount,
        candidatesCount: data.candidatesCount,
        publishedCount: data.publishedCount,
        publishedSlugs: data.publishedSlugs,
        summary: data.summary,
      },
    });
  } catch (err: any) {
    logger.info("IngestionRun update skipped, saving completed state to AuditLog", { message: err?.message });
    await prisma.auditLog.create({
      data: {
        action: "STAGING_INGESTION_RUN",
        entityType: "IngestionRun",
        entityId: runId,
        details: {
          id: runId,
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          ...data,
        },
      },
    }).catch(() => {});
  }
}

async function markRunFailed(
  prisma: any,
  runId: string,
  claimToken: string,
  failureCode: string,
  data?: any,
): Promise<void> {
  try {
    await prisma.ingestionRun.updateMany({
      where: { id: runId, claimToken },
      data: {
        status: "FAILED",
        failureCode,
        failedAt: new Date(),
        ...(data?.totalFetched !== undefined ? { totalFetched: data.totalFetched } : {}),
        ...(data?.totalDeduplicated !== undefined ? { totalDeduplicated: data.totalDeduplicated } : {}),
        ...(data?.rawSignalsCount !== undefined ? { rawSignalsCount: data.rawSignalsCount } : {}),
        ...(data?.candidatesCount !== undefined ? { candidatesCount: data.candidatesCount } : {}),
        ...(data?.publishedCount !== undefined ? { publishedCount: data.publishedCount } : {}),
        ...(data?.summary !== undefined ? { summary: data.summary } : {}),
      },
    });
  } catch (err: any) {
    logger.info("IngestionRun updateMany skipped, saving failed state to AuditLog", { message: err?.message });
    await prisma.auditLog.create({
      data: {
        action: "STAGING_INGESTION_RUN",
        entityType: "IngestionRun",
        entityId: runId,
        details: {
          id: runId,
          claimToken,
          status: "FAILED",
          failureCode,
          failedAt: new Date().toISOString(),
          ...data,
        },
      },
    }).catch(() => {});
  }
}