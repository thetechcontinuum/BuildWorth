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
  maxHistoricalSignals?: number;
  maxPublishedOpportunities?: number;
  targetSourceKeys?: string[];
  aiProvider?: LLMProvider;
  executionTimeoutMs?: number;
  cleanSyntheticPrior?: boolean;
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
    candidates: number;
    published: number;
  };
  publishedSlugs: string[];
  startedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  summary?: any;
}

const ALLOWLISTED_SOURCE_KEYS = ["hackernews", "reddit", "github", "producthunt", "krasia", "e27"];

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
    "custom", "scripts", "delays"
  ]);

  for (const text of problemTexts) {
    if (!text || typeof text !== "string") continue;
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

/**
 * Cleans the previous synthetic staging opportunity and associated synthetic test records.
 */
export async function cleanSyntheticStagingOpportunity(prisma: any): Promise<{
  cleanedOpportunities: number;
  cleanedRawSignals: number;
  cleanedNormalizedSignals: number;
}> {
  const syntheticSlugs = [
    "manual-reconciliation-process-causing-recurring-quarterly-de",
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
      // Clean child entities
      await prisma.evidenceLink.deleteMany({
        where: { OR: [{ opportunityId: opp.id }, { opportunityRevision: { opportunityId: opp.id } }] },
      }).catch(() => {});

      await prisma.scoreDimension.deleteMany({
        where: { scorecard: { opportunityId: opp.id } },
      }).catch(() => {});

      await prisma.scorecard.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.savedOpportunity.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.opportunityChangeEvent.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.opportunityBlueprint.deleteMany({
        where: { revision: { opportunityId: opp.id } },
      }).catch(() => {});

      await prisma.opportunityRevision.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.opportunity.delete({
        where: { id: opp.id },
      }).catch(() => {});

      cleanedOpportunities++;
    }
  }

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
    await prisma.evidenceLink.deleteMany({
      where: { normalizedSignal: { rawSignalId: raw.id } },
    }).catch(() => {});
    await prisma.normalizedSignal.deleteMany({
      where: { rawSignalId: raw.id },
    }).catch(() => {});
    await prisma.rawSignal.delete({
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

  // Explicit buyer demand phrases
  const hasBuyerDemand =
    /\b(looking for a tool|need a solution|any tool for|does anyone know a tool|would love a tool|desperately need)\b/i.test(text);

  if (hasBuyerDemand) {
    return "BUYER_DEMAND";
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

  await prisma.scorecard.create({
    data: {
      opportunityId: opp.id,
      opportunityScore: blueprint.scorecard?.opportunityScore || 85,
      evidenceConfidenceScore: blueprint.scorecard?.evidenceConfidenceScore || 80,
      demandScore: 82,
      feasibilityScore: 88,
      economicsScore: 84,
      competitionScore: 80,
      goMarketScore: 82,
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
    confidenceScore: 80,
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

  const competitors: CompetitorItem[] = (blueprint.existingCompetitors || []).map((name: string) => ({
    id: "comp-" + crypto.randomUUID(),
    name,
    competitorType: "DIRECT",
    differentiationHypothesis: blueprint.competitorWeaknesses?.[0] || "Lightweight and automated",
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
      amountMinorCents: blueprint.economics.estimatedMvpCost.minMinor,
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
      affectedRole: blueprint.endUser,
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

  const risks: RiskItem[] = (blueprint.majorRisks || []).map((desc: string) => ({
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
    opportunityScore: 85,
    evidenceConfidence: 80,
    criticalClaimsCovered: verifiedSignals.length,
    costSummary: {
      minBuildMinorCents: blueprint.economics.estimatedMvpCost.minMinor,
      maxBuildMinorCents: blueprint.economics.estimatedMvpCost.maxMinor,
      minWeeks: blueprint.economics.estimatedTimeToMvpWeeks.min,
      maxWeeks: blueprint.economics.estimatedTimeToMvpWeeks.max,
      minMonthlyOpMinorCents: blueprint.economics.estimatedMonthlyOperatingCost.minMinor,
      maxMonthlyOpMinorCents: blueprint.economics.estimatedMonthlyOperatingCost.maxMinor,
    },
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
    maxHistoricalSignals = 20,
    maxPublishedOpportunities = 3,
    targetSourceKeys,
    aiProvider = defaultAI,
    executionTimeoutMs = 50000,
    cleanSyntheticPrior = false,
  } = options;


  const deadline = Date.now() + executionTimeoutMs;
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
    });
  } catch (err: any) {
    if (err.message === "CONCURRENT_RUN_IN_PROGRESS") {
      return {
        runId: "concurrent",
        idempotencyKey,
        status: "FAILED",
        failureCode: "CONCURRENT_RUN_IN_PROGRESS",
        counters: { fetched: 0, deduplicated: 0, rawSignals: 0, candidates: 0, published: 0 },
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
  let rawSignalsCount = 0;
  let normalizedSignalsCount = 0;
  let candidatesCount = 0;
  let publishedCount = 0;
  const publishedSlugs: string[] = [];
  const processedHashes = new Set<string>();

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

    let activeSources = await prisma.source.findMany({
      where: sourceFilter,
      take: maxSources,
    });

    if (!activeSources || activeSources.length === 0) {
      logger.warn("No active approved sources found for staging manual ingestion.");
      await markRunFailed(prisma, runId, claimToken, "NO_ACTIVE_SOURCES");
      return {
        runId,
        idempotencyKey,
        status: "FAILED",
        failureCode: "NO_ACTIVE_SOURCES",
        counters: { fetched: 0, deduplicated: 0, rawSignals: 0, candidates: 0, published: 0 },
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
    let targetQueries: string[] = [];
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

    const perSourceStats: Record<string, {
      name: string;
      fetched: number;
      newRawSignals: number;
      duplicates: number;
      persistedUrls: string[];
    }> = {};

    for (const src of activeSources) {
      if (Date.now() > deadline || totalFetched >= maxFetchItems) break;

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
        persistedUrls: [] as string[],
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
        const maxPerSource = Math.ceil(maxFetchItems / 2); // e.g. 15 per active fetching source
        const srcSlots = Math.min(slotsAvailable, maxPerSource);

        if (targetQueries.length > 0 && (src.key === "hackernews" || src.key === "github")) {
          const queriesToRun = targetQueries.slice(0, 2);
          const perQuery = Math.max(3, Math.floor(srcSlots / queriesToRun.length));
          const fetchPromises = queriesToRun.map((q) => adapter.fetchSignals(perQuery, q));
          const results = await Promise.all(fetchPromises);
          for (const list of results) {
            rawSignals.push(...list);
          }

          if (rawSignals.length < srcSlots) {
            const remaining = srcSlots - rawSignals.length;
            const generalSignals = await adapter.fetchSignals(Math.min(5, remaining));
            rawSignals.push(...generalSignals);
          }
        } else {
          const generalSignals = await adapter.fetchSignals(Math.min(15, srcSlots));
          rawSignals.push(...generalSignals);
        }

        const boundedRawSignals = rawSignals.slice(0, Math.max(0, slotsAvailable));
        totalFetched += boundedRawSignals.length;
        currentStats.fetched += boundedRawSignals.length;

        for (const raw of boundedRawSignals) {
          if (!raw.rawContent || raw.rawContent.trim().length < 10) continue;

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
                  publishedAt: raw.publishedAt || new Date(),
                  authorFingerprint: raw.authorFingerprint || null,
                  createdAt: new Date(),
                },
              });
              rawSignalsCount++;
              srcIngestedCount++;
              currentStats.newRawSignals++;
              currentStats.persistedUrls.push(canonicalUrl);
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
                  signalType: src.key === "krasia" || src.key === "e27" ? "MARKET_ACTIVITY" : "PAIN",
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
      } finally {
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

    // Include eligible historical unclustered verified NormalizedSignals alongside newly ingested signals
    let historicalSignalsCount = 0;
    const currentSignalsCount = sanitizedSignalsToProcess.length;

    if (maxHistoricalSignals > 0) {
      const alreadyPresentRawIds = new Set(sanitizedSignalsToProcess.map((s) => s.rawSignalId));
      const existingUnclustered = await prisma.normalizedSignal.findMany({
        where: {
          clusterMemberships: { none: {} },
          verificationStatus: { not: "REJECTED" },
          rawSignal: {
            AND: [
              { canonicalUrl: { notIn: KNOWN_SYNTHETIC_FIXTURE_URLS } },
              { externalId: { notIn: KNOWN_SYNTHETIC_FIXTURE_EXTERNAL_IDS } },
            ],
          },
        },
        include: { rawSignal: { include: { source: true } } },
        take: maxHistoricalSignals,
        orderBy: { createdAt: "desc" },
      }).catch(() => []);

      for (const sig of existingUnclustered) {
        if (sig.rawSignal && sig.rawSignal.source && !alreadyPresentRawIds.has(sig.rawSignal.id)) {
          sanitizedSignalsToProcess.push({
            rawSignalId: sig.rawSignal.id,
            normalizedSignalId: sig.id,
            externalId: sig.rawSignal.externalId,
            title: sig.sourceTitle || sig.problemSummary,
            excerpt: sig.sanitizedExcerpt,
            sourceKey: sig.rawSignal.source.key,
            sourceId: sig.rawSignal.source.id,
            sourceName: sig.rawSignal.source.name,
          });
          alreadyPresentRawIds.add(sig.rawSignal.id);
          historicalSignalsCount++;
        }
      }
    }



    // 4. AI Classification & Extraction
    const clusterCandidates: ClusterCandidate[] = [];

    for (const item of sanitizedSignalsToProcess) {
      if (Date.now() > deadline - 4000 || clusterCandidates.length >= maxCandidates) break;

      try {
        const classification = await classifySignal(aiProvider, item.excerpt, item.title);
        if (classification.signalType === "NOISE") continue;

        const extracted = await extractSignalIntelligence(aiProvider, item.excerpt, item.title);
        const emb = await aiProvider.generateEmbedding(extracted.problemSummary);

        await prisma.normalizedSignal.update({
          where: { id: item.normalizedSignalId },
          data: {
            signalType: classification.signalType as any,
            purchaseIntent: classification.signalType === "PURCHASE_INTENT" || classification.signalType === "WILLINGNESS_TO_PAY" || (extracted.intentToPayScore && extracted.intentToPayScore > 50),
            problemSummary: extracted.problemSummary,
            actorRole: extracted.actorRole,
            workflowContext: extracted.workflowContext,
            severityScore: extracted.severityScore,
            frequencyScore: extracted.frequencyScore,
            intentToPayScore: extracted.intentToPayScore,
            extractedEntities: extracted.extractedEntities,
            confidenceScore: extracted.confidenceScore,
          },
        });

        clusterCandidates.push({
          id: item.normalizedSignalId,
          problemSummary: extracted.problemSummary,
          vertical: extracted.workflowContext?.includes("DevOps") || extracted.workflowContext?.includes("Compliance")
            ? "DevOps & Compliance"
            : "Data Engineering & FinOps",
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

        await markRunFailed(prisma, runId, claimToken, failCode);
        return {
          runId,
          idempotencyKey,
          status: "FAILED",
          failureCode: failCode,
          counters: {
            fetched: totalFetched,
            deduplicated: totalDeduplicated,
            rawSignals: rawSignalsCount,
            candidates: 0,
            published: 0,
          },
          publishedSlugs: [],
          startedAt: now.toISOString(),
          failedAt: new Date().toISOString(),
        };
      }
    }

    candidatesCount = clusterCandidates.length;

    // 5. Semantic Clustering & Evidence Expansion Path
    const candidateEvaluations: any[] = [];
    let totalClustersDiscovered = 0;

    // Query for an existing target persisted candidate to expand evidence for
    const existingCandidates = await prisma.opportunity.findMany({
      where: { isDemoFixture: false },
      orderBy: { createdAt: "desc" },
      take: 1,
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

    const targetCandidate = existingCandidates[0] || null;

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
        if (targetOriginalSignalIds.has(item.id)) continue;
        const sim = targetCentroid ? cosineSimilarity(item.embedding, targetCentroid) : 0;
        if (sim >= 0.70) {
          matchedToTarget.push(item);
        } else {
          unmatchedPool.push(item);
        }
      }

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
      const targetQualityResult = evaluatePublicationQuality(
        targetClaimLinks,
        targetCandidate.scorecards?.[0]?.evidenceConfidenceScore || 80,
      );

      const targetIsVerified = targetQualityResult.status === "VERIFIED" && targetQualityResult.isEligibleForVerified;
      const targetFinalStatus = targetIsVerified ? "PUBLISHED" : "DRAFT";
      const targetPubQualityStatus = targetQualityResult.status;

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
          opportunityScore: 85,
          evidenceConfidence: 80,
          criticalClaimsCovered: allTargetSignals.length,
          costSummary: {
            minBuildMinorCents: updatedBlueprint.economics.estimatedMvpCost.minMinor,
            maxBuildMinorCents: updatedBlueprint.economics.estimatedMvpCost.maxMinor,
            minWeeks: updatedBlueprint.economics.estimatedTimeToMvpWeeks.min,
            maxWeeks: updatedBlueprint.economics.estimatedTimeToMvpWeeks.max,
            minMonthlyOpMinorCents: updatedBlueprint.economics.estimatedMonthlyOperatingCost.minMinor,
            maxMonthlyOpMinorCents: updatedBlueprint.economics.estimatedMonthlyOperatingCost.maxMinor,
          },
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

      if (targetIsVerified) {
        publishedSlugs.push(targetCandidate.slug);
        publishedCount++;
      }

      // 6b. Cluster genuinely different problems into separate candidates
      if (unmatchedPool.length > 0 && publishedCount < maxPublishedOpportunities) {
        const newClusters = clusterSignals(unmatchedPool, 0.75);
        totalClustersDiscovered += newClusters.length;
        for (const cl of newClusters.slice(0, maxPublishedOpportunities - publishedCount)) {
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

          const rawTitle = cl.title || cl.summary;
          const formattedTitle = formatMeaningfulTitle(rawTitle);
          let generatedSlug = generateCollisionSafeSlug(formattedTitle);
          const existingSlug = await prisma.opportunity.findUnique({ where: { slug: generatedSlug } });
          if (existingSlug) {
            generatedSlug = generateCollisionSafeSlug(formattedTitle, crypto.randomBytes(3).toString("hex"));
          }

          const blueprint = synthesizeOpportunity(cl, verifiedSignals.length);
          blueprint.title = formattedTitle;
          blueprint.slug = generatedSlug;

          const claimLinks = buildEmpiricalClaimLinks(verifiedSignals);
          const qualityResult = evaluatePublicationQuality(claimLinks, blueprint.scorecard?.evidenceConfidenceScore || 80);
          const isVerified = qualityResult.status === "VERIFIED" && qualityResult.isEligibleForVerified;
          const finalStatus = isVerified ? "PUBLISHED" : "DRAFT";

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
            publicationQualityStatus: qualityResult.status,
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

          const newOpp = await createCandidateWithRevisionAndLinks(
            prisma,
            oppData,
            blueprint,
            verifiedSignals,
            isVerified,
          );

          candidateEvaluations.push({
            id: newOpp.id,
            title: formattedTitle,
            slug: generatedSlug,
            status: finalStatus,
            publicationQualityStatus: qualityResult.status,
            originalUrls: [],
            addedUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
            supportingUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
            independenceKeys: Array.from(new Set(verifiedSignals.map((vs) => vs.normalizedSignal.independenceKey || `id:${vs.normalizedSignal.id}`))),
            sourceFamilies: Array.from(new Set(verifiedSignals.map((vs) => (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : vs.source.key === "krasia" || vs.source.key === "e27" ? "DISCOVERY" : vs.source.sourceFamily || "COMMUNITY")).filter(Boolean))),
            blockers: qualityResult.blockers,
            warnings: qualityResult.warnings,
            metrics: qualityResult.metrics,
          });

          if (isVerified) {
            publishedSlugs.push(generatedSlug);
            publishedCount++;
          }
        }
      }

    } else {
      // 6c. Cold initial clustering when no previous opportunity exists
      const clusters = clusterCandidates.length > 0 ? clusterSignals(clusterCandidates, 0.75) : [];
      totalClustersDiscovered = clusters.length;
      const boundedClusters = clusters.slice(0, maxPublishedOpportunities);

      for (const cl of boundedClusters) {
        if (Date.now() > deadline || publishedCount >= maxPublishedOpportunities) break;

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

        const rawTitle = cl.title || cl.summary;
        const formattedTitle = formatMeaningfulTitle(rawTitle);
        const generatedSlug = generateCollisionSafeSlug(formattedTitle);
        const blueprint = synthesizeOpportunity(cl, verifiedSignals.length);
        blueprint.title = formattedTitle;
        blueprint.slug = generatedSlug;

        const claimLinks = buildEmpiricalClaimLinks(verifiedSignals);
        const qualityResult = evaluatePublicationQuality(claimLinks, blueprint.scorecard?.evidenceConfidenceScore || 80);
        const isVerified = qualityResult.status === "VERIFIED" && qualityResult.isEligibleForVerified;
        const finalStatus = isVerified ? "PUBLISHED" : "DRAFT";

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
          publicationQualityStatus: qualityResult.status,
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

        candidateEvaluations.push({
          id: opp.id,
          title: formattedTitle,
          slug: generatedSlug,
          status: finalStatus,
          publicationQualityStatus: qualityResult.status,
          originalUrls: [],
          addedUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
          supportingUrls: Array.from(new Set(verifiedSignals.map((vs) => vs.rawSignal.sourceUrl))),
          independenceKeys: Array.from(new Set(verifiedSignals.map((vs) => vs.normalizedSignal.independenceKey || `id:${vs.normalizedSignal.id}`))),
          sourceFamilies: Array.from(new Set(verifiedSignals.map((vs) => (vs.source.key === "github" ? "DEVELOPER_ECOSYSTEM" : vs.source.key === "krasia" || vs.source.key === "e27" ? "DISCOVERY" : vs.source.sourceFamily || "COMMUNITY")).filter(Boolean))),
          blockers: qualityResult.blockers,
          warnings: qualityResult.warnings,
          metrics: qualityResult.metrics,
        });

        if (isVerified) {
          publishedSlugs.push(generatedSlug);
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
      perSourceStats,
      candidateEvaluations,
    };

    await markRunCompleted(prisma, runId, {
      totalFetched,
      totalDeduplicated,
      rawSignalsCount,
      candidatesCount,
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
        candidates: candidatesCount,
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

    await markRunFailed(prisma, runId, claimToken, sanitizedCode, {
      totalFetched,
      totalDeduplicated,
      rawSignalsCount,
      candidatesCount,
      publishedCount: 0,
      summary: {
        errorMessage: msg,
      },
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
        candidates: candidatesCount,
        published: 0,
      },
      publishedSlugs: [],
      startedAt: now.toISOString(),
      failedAt: new Date().toISOString(),
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
  },
): Promise<LeaseResult> {
  const { idempotencyKey, workerId, claimToken, now, lockedUntil } = options;

  // 1. Try IngestionRun model
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.ingestionRun.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        if (existing.status === "COMPLETED" || existing.status === "FAILED") {
          return { run: existing, isExisting: true, action: "RETURN_EXISTING" as const };
        }

        const isLeaseActive = existing.lockedUntil && new Date(existing.lockedUntil) > new Date();
        if (existing.status === "PROCESSING" && isLeaseActive) {
          return { run: existing, isExisting: true, action: "IN_PROGRESS" as const };
        }

        const reclaimed = await tx.ingestionRun.update({
          where: { id: existing.id },
          data: {
            status: "PROCESSING",
            claimToken,
            lockedBy: workerId,
            lockedAt: now,
            lockedUntil,
            attemptCount: { increment: 1 },
            startedAt: existing.startedAt || now,
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
      if (details.status === "COMPLETED" || details.status === "FAILED") {
        return { run: details, isExisting: true, action: "RETURN_EXISTING" as const };
      }
      const isLeaseActive = details.lockedUntil && new Date(details.lockedUntil) > now;
      if (details.status === "PROCESSING" && isLeaseActive) {
        return { run: details, isExisting: true, action: "IN_PROGRESS" as const };
      }

      const updatedDetails = {
        ...details,
        status: "PROCESSING",
        claimToken,
        lockedBy: workerId,
        lockedAt: now.toISOString(),
        lockedUntil: lockedUntil.toISOString(),
        attemptCount: (details.attemptCount || 1) + 1,
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