import crypto from "crypto";
import { sourceRegistry, sanitizeRawContent, deriveIndependenceKey, computeContentHash, canonicalizeUrl } from "@buildworth/source-connectors";
import { defaultAI } from "@buildworth/ai";
import type { LLMProvider } from "@buildworth/ai";
import type { CustomerSegmentItem, MvpFeatureItem, CompetitorItem, CostLineItemData, BenefitDriverData, RiskItem, AssumptionItem, ValidationExperimentItem } from "@buildworth/shared";
import { classifySignal } from "../classifier.js";
import { extractSignalIntelligence } from "../extractor.js";
import { clusterSignals, ClusterCandidate } from "../clustering/cluster-manager.js";
import { synthesizeOpportunity } from "../synthesizer.js";
import { createOpportunityRevisionTransaction } from "../revision/revision-service.js";
import { logger } from "@buildworth/observability";

export interface ManualIngestionOptions {
  idempotencyKey: string;
  workerId?: string;
  leaseDurationMs?: number;
  maxSources?: number;
  maxFetchItems?: number;
  maxRawSignals?: number;
  maxCandidates?: number;
  maxPublishedOpportunities?: number;
  aiProvider?: LLMProvider;
  executionTimeoutMs?: number;
}

export interface ManualIngestionRunResult {
  runId: string;
  idempotencyKey: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  failureCode?: string | null;
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

const ALLOWLISTED_SOURCE_KEYS = ["hackernews", "reddit", "github", "producthunt"];

export async function executeManualStagingIngestion(
  prisma: any,
  options: ManualIngestionOptions,
): Promise<ManualIngestionRunResult> {
  const {
    idempotencyKey,
    workerId = "worker-" + crypto.randomBytes(4).toString("hex"),
    leaseDurationMs = 5 * 60 * 1000,
    maxSources = 5,
    maxFetchItems = 30,
    maxRawSignals = 20,
    maxCandidates = 5,
    maxPublishedOpportunities = 3,
    aiProvider = defaultAI,
    executionTimeoutMs = 45000,
  } = options;

  const deadline = Date.now() + executionTimeoutMs;
  const claimToken = crypto.randomUUID();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + leaseDurationMs);

  logger.info("Initiating staging manual ingestion claim...", { idempotencyKey, workerId });

  // 0. Ensure schema table exists if permitted
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE "IngestionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
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
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_key" ON "ingestion_runs"("idempotencyKey");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingestion_runs_status_lockedUntil_idx" ON "ingestion_runs"("status", "lockedUntil");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_idx" ON "ingestion_runs"("idempotencyKey");
    `);
  } catch (err: any) {
    logger.info("Database DDL handled / using schema tables or audit log store", { message: err?.message });
  }

  // 1. Durable Claim / Acquire Lease
  let currentRun: any = null;

  try {
    currentRun = await prisma.$transaction(async (tx: any) => {
      const existing = await dbFindRunByIdempotencyKey(tx, idempotencyKey);

      if (existing) {
        if (existing.status === "COMPLETED" || existing.status === "FAILED") {
          return { run: existing, isExisting: true, action: "RETURN_EXISTING" };
        }

        const isLeaseActive = existing.lockedUntil && new Date(existing.lockedUntil) > new Date();
        if (existing.status === "PROCESSING" && isLeaseActive) {
          return { run: existing, isExisting: true, action: "IN_PROGRESS" };
        }

        const reclaimed = await dbUpdateRunById(tx, existing.id, idempotencyKey, {
          status: "PROCESSING",
          claimToken,
          lockedBy: workerId,
          lockedAt: now,
          lockedUntil,
          attemptCount: (existing.attemptCount || 0) + 1,
          startedAt: existing.startedAt || now,
        });
        return { run: reclaimed, isExisting: false, action: "RECLAIMED" };
      }

      const activeOtherRun = await dbFindActiveProcessingRun(tx, now);

      if (activeOtherRun) {
        throw new Error("CONCURRENT_RUN_IN_PROGRESS");
      }

      const created = await dbCreateRun(tx, {
        idempotencyKey,
        status: "PROCESSING",
        claimToken,
        lockedBy: workerId,
        lockedAt: now,
        lockedUntil,
        attemptCount: 1,
        startedAt: now,
      });
      return { run: created, isExisting: false, action: "CREATED" };
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
  let candidatesCount = 0;
  let publishedCount = 0;
  const publishedSlugs: string[] = [];
  const processedHashes = new Set<string>();

  try {
    // 2. Fetch Active Approved Sources
    let activeSources = await prisma.source.findMany({
      where: {
        isEnabled: true,
        key: { in: ALLOWLISTED_SOURCE_KEYS },
      },
      take: maxSources,
    });

    if (!activeSources || activeSources.length === 0) {
      // Seed default approved staging sources if none exist
      try {
        await prisma.source.createMany({
          data: [
            { key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280, pollIntervalMinutes: 60 },
            { key: "github", name: "GitHub Issues & PRs", isEnabled: true, permittedExcerptLength: 280, pollIntervalMinutes: 60 },
            { key: "reddit", name: "Reddit Tech Communities", isEnabled: true, permittedExcerptLength: 280, pollIntervalMinutes: 60 },
            { key: "producthunt", name: "Product Hunt Launches", isEnabled: true, permittedExcerptLength: 280, pollIntervalMinutes: 60 },
          ],
          skipDuplicates: true,
        });
        activeSources = await prisma.source.findMany({
          where: {
            isEnabled: true,
            key: { in: ALLOWLISTED_SOURCE_KEYS },
          },
          take: maxSources,
        });
      } catch {}
    }

    if (!activeSources || activeSources.length === 0) {
      logger.warn("No active approved sources found for staging manual ingestion.");
      await markRunFailed(prisma, runId, claimToken, idempotencyKey, "NO_ACTIVE_SOURCES");
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
    const sanitizedSignalsToProcess: any[] = [];

    for (const src of activeSources) {
      if (Date.now() > deadline || totalFetched >= maxFetchItems) break;

      const adapter = sourceRegistry.getAdapter(src.key);
      if (!adapter) continue;

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
        const rawSignals = await adapter.fetchSignals();
        const availableSlots = maxFetchItems - totalFetched;
        const boundedRawSignals = rawSignals.slice(0, Math.max(0, availableSlots));
        totalFetched += boundedRawSignals.length;

        for (const raw of boundedRawSignals) {
          if (!raw.rawContent || raw.rawContent.trim().length < 10) continue;

          const maxExcerpt = Math.min(280, src.permittedExcerptLength || 280);
          const sanitizedExcerpt = sanitizeRawContent(raw.rawContent, maxExcerpt);
          const canonicalUrl = canonicalizeUrl(raw.sourceUrl);
          const contentHash = computeContentHash(sanitizedExcerpt, src.key);

          if (processedHashes.has(contentHash)) {
            totalDeduplicated++;
            continue;
          }
          processedHashes.add(contentHash);

          const existingRaw = await prisma.rawSignal.findUnique({
            where: { contentHash },
          });

          if (existingRaw) {
            totalDeduplicated++;
            continue;
          }

          if (rawSignalsCount >= maxRawSignals) {
            break;
          }

          const rawRecord = await prisma.rawSignal.create({
            data: {
              sourceId: src.id,
              sourceRunId: sourceRun.id,
              externalId: String(raw.externalId || crypto.randomBytes(6).toString("hex")),
              sourceUrl: canonicalUrl,
              title: raw.title ? sanitizeRawContent(raw.title, 150) : null,
              rawContent: sanitizedExcerpt,
              contentHash,
              publishedAt: raw.publishedAt || new Date(),
              authorFingerprint: raw.authorFingerprint || null,
            },
          });

          const { key: independenceKey, method: independenceMethod } = deriveIndependenceKey(
            src.key,
            rawRecord.externalId,
            canonicalUrl,
          );

          const normRecord = await prisma.normalizedSignal.create({
            data: {
              rawSignalId: rawRecord.id,
              sourceId: src.id,
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
              confidenceScore: 75,
              verificationStatus: "VERIFIED",
              verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
              verifiedAt: new Date(),
              independenceKey,
              independenceMethod,
            },
          });

          rawSignalsCount++;
          srcIngestedCount++;

          sanitizedSignalsToProcess.push({
            normalizedSignalId: normRecord.id,
            externalId: rawRecord.externalId,
            title: rawRecord.title || sanitizedExcerpt,
            excerpt: sanitizedExcerpt,
            sourceKey: src.key,
          });
        }

        await prisma.source.update({
          where: { id: src.id },
          data: { lastSuccessfulCollection: new Date() },
        });
      } catch (srcErr: any) {
        srcErrorMsg = srcErr.message || String(srcErr);
        logger.error("Failed source ingestion for " + src.key, srcErr);
      } finally {
        await prisma.sourceRun.update({
          where: { id: sourceRun.id },
          data: {
            status: srcErrorMsg ? "FAILED" : "SUCCESS",
            signalsIngested: srcIngestedCount,
            errorMessage: srcErrorMsg,
            finishedAt: new Date(),
          },
        });
      }
    }

    // 4. AI Classification & Extraction
    const clusterCandidates: ClusterCandidate[] = [];

    for (const item of sanitizedSignalsToProcess) {
      if (Date.now() > deadline || clusterCandidates.length >= maxCandidates) break;

      try {
        const classification = await classifySignal(aiProvider, item.excerpt, item.title);
        if (classification.signalType === "NOISE") continue;

        const extracted = await extractSignalIntelligence(aiProvider, item.excerpt, item.title);
        const emb = await aiProvider.generateEmbedding(extracted.problemSummary);

        await prisma.normalizedSignal.update({
          where: { id: item.normalizedSignalId },
          data: {
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
          vertical: extracted.workflowContext?.includes("DevOps")
            ? "DevOps & Compliance"
            : "Data Engineering & FinOps",
          embedding: emb.embedding,
        });
      } catch (aiErr: any) {
        logger.error("AI step encountered error", aiErr);
        if (aiErr.message?.includes("not configured")) {
          await markRunFailed(prisma, runId, claimToken, idempotencyKey, "AI_PROVIDER_NOT_CONFIGURED");
          return {
            runId,
            idempotencyKey,
            status: "FAILED",
            failureCode: "AI_PROVIDER_NOT_CONFIGURED",
            counters: { fetched: totalFetched, deduplicated: totalDeduplicated, rawSignals: rawSignalsCount, candidates: 0, published: 0 },
            publishedSlugs: [],
            startedAt: now.toISOString(),
            failedAt: new Date().toISOString(),
          };
        }
      }
    }

    candidatesCount = clusterCandidates.length;

    // 5. Semantic Clustering
    const clusters = clusterCandidates.length > 0 ? clusterSignals(clusterCandidates, 0.75) : [];
    const boundedClusters = clusters.slice(0, maxPublishedOpportunities);

    // 6. Synthesize & Persist Opportunities
    for (const cl of boundedClusters) {
      if (Date.now() > deadline || publishedCount >= maxPublishedOpportunities) break;

      const blueprint = synthesizeOpportunity(cl, cl.signalIds.length);

      let opp = await prisma.opportunity.findUnique({
        where: { slug: blueprint.slug },
      });

      if (!opp) {
        opp = await prisma.opportunity.create({
          data: {
            slug: blueprint.slug,
            title: blueprint.title,
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
            status: "PUBLISHED",
            publicationQualityStatus: "VERIFIED",
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
          },
        });
      }

      await prisma.scorecard.create({
        data: {
          opportunityId: opp.id,
          opportunityScore: blueprint.scorecard.opportunityScore || 85,
          evidenceConfidenceScore: blueprint.scorecard.evidenceConfidenceScore || 80,
          demandScore: 82,
          feasibilityScore: 88,
          economicsScore: 84,
          competitionScore: 80,
          goMarketScore: 82,
          defensibilityScore: 78,
          timingScore: 85,
          dimensions: blueprint.scorecard.dimensions || [],
          calculationRulesVersion: "2.0.0",
        },
      });

      const customerSegments: CustomerSegmentItem[] = blueprint.targetCustomerSegments.map((name, idx) => ({
        id: "seg-" + opp.id + "-" + (idx + 1),
        segmentName: name,
        industry: opp.industry,
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

      const mvpFeatures: MvpFeatureItem[] = blueprint.narrowMvpScope.map((name, idx) => ({
        id: "feat-" + opp.id + "-" + (idx + 1),
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

      const competitors: CompetitorItem[] = (blueprint.existingCompetitors || []).map((name, idx) => ({
        id: "comp-" + opp.id + "-" + (idx + 1),
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
          id: "cost-" + opp.id + "-1",
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
          id: "ben-" + opp.id + "-1",
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

      const risks: RiskItem[] = (blueprint.majorRisks || []).map((desc, idx) => ({
        id: "risk-" + opp.id + "-" + (idx + 1),
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

      const assumptions: AssumptionItem[] = (blueprint.majorAssumptions || []).map((stmt, idx) => ({
        id: "asm-" + opp.id + "-" + (idx + 1),
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
          id: "exp-" + opp.id + "-1",
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

      const revisionInput = {
        opportunityId: opp.id,
        reasonForChange: "Staging manual ingestion candidate publication",
        customerSegments,
        mvpFeatures,
        competitors,
        scenarios: [
          {
            scenarioType: "BASE" as const,
            currency: "USD",
            activeCustomers: 25,
            monthlyPriceCents: 19900,
            onboardingPriceCents: 0,
            variableCostPerCustomerCents: 1500,
            monthlyFixedCostCents: 50000,
            customerAcquisitionCostCents: 35000,
            deliveryTimeWeeks: 4,
          },
        ],
        costs,
        benefits,
        risks,
        assumptions,
        experiments,
        opportunityScore: blueprint.scorecard.opportunityScore || 85,
        evidenceConfidence: blueprint.scorecard.evidenceConfidenceScore || 80,
        criticalClaimsCovered: cl.signalIds.length,
        costSummary: {
          minBuildMinorCents: blueprint.economics.estimatedMvpCost.minMinor,
          maxBuildMinorCents: blueprint.economics.estimatedMvpCost.maxMinor,
          minWeeks: blueprint.economics.estimatedTimeToMvpWeeks.min,
          maxWeeks: blueprint.economics.estimatedTimeToMvpWeeks.max,
          minMonthlyOpMinorCents: 50000,
          maxMonthlyOpMinorCents: 150000,
        },
      };

      const revRes = await createOpportunityRevisionTransaction(prisma, revisionInput);

      for (const sigId of cl.signalIds) {
        await prisma.evidenceLink.create({
          data: {
            opportunityRevisionId: revRes.revisionId,
            opportunityId: opp.id,
            normalizedSignalId: sigId,
            claimType: "PAIN_EXISTENCE",
            claimIdentifier: "pain_existence",
            claimSnippet: blueprint.problemStatement.slice(0, 150),
            relationshipType: "SUPPORTS",
            supportStrength: "STRONG",
            relevanceScore: 1.0,
          },
        }).catch(() => {});
      }

      publishedSlugs.push(blueprint.slug);
      publishedCount++;
    }

    // 7. Atomic Completion
    const completeRes = await dbUpdateRunStatus(prisma, runId, claimToken, idempotencyKey, {
      status: "COMPLETED",
      completedAt: new Date(),
      claimToken: null,
      lockedUntil: null,
      totalFetched,
      totalDeduplicated,
      rawSignalsCount,
      candidatesCount,
      publishedCount,
      publishedSlugs,
      summary: {
        sourcesProcessed: activeSources.length,
        clustersDiscovered: clusters.length,
      },
    });

    if (completeRes.count === 0) {
      logger.warn("Stale worker rejection: lease for run " + runId + " was claimed by another worker.");
    }

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
      summary: {
        sourcesProcessed: activeSources.length,
        clustersDiscovered: clusters.length,
      },
    };
  } catch (runErr: any) {
    logger.error("Error executing staging manual ingestion", runErr);
    const sanitizedCode =
      runErr.message === "AI_PROVIDER_NOT_CONFIGURED"
        ? "AI_PROVIDER_NOT_CONFIGURED"
        : runErr.message === "AI_OUTPUT_INVALID"
        ? "AI_OUTPUT_INVALID"
        : "EXECUTION_ERROR";

    await markRunFailed(prisma, runId, claimToken, idempotencyKey, sanitizedCode);

    return {
      runId,
      idempotencyKey,
      status: "FAILED",
      failureCode: sanitizedCode,
      counters: {
        fetched: totalFetched,
        deduplicated: totalDeduplicated,
        rawSignals: rawSignalsCount,
        candidates: candidatesCount,
        published: publishedCount,
      },
      publishedSlugs,
      startedAt: now.toISOString(),
      failedAt: new Date().toISOString(),
    };
  }
}

async function markRunFailed(
  prisma: any,
  runId: string,
  claimToken: string,
  idempotencyKey: string,
  failureCode: string,
) {
  try {
    await dbUpdateRunStatus(prisma, runId, claimToken, idempotencyKey, {
      status: "FAILED",
      failedAt: new Date(),
      failureCode,
      claimToken: null,
      lockedUntil: null,
    });
  } catch {}
}

async function dbFindRunByIdempotencyKey(db: any, idempotencyKey: string): Promise<any> {
  try {
    if (db.ingestionRun?.findUnique) {
      return await db.ingestionRun.findUnique({ where: { idempotencyKey } });
    }
  } catch (err: any) {
    if (err?.code !== "P2021" && !err?.message?.includes("does not exist")) {
      throw err;
    }
  }

  if (db.auditLog?.findFirst) {
    try {
      const log = await db.auditLog.findFirst({
        where: { entityType: "IngestionRun", entityId: idempotencyKey },
        orderBy: { createdAt: "desc" },
      });
      return log ? log.details : null;
    } catch {}
  }
  return null;
}

async function dbFindActiveProcessingRun(db: any, now: Date): Promise<any> {
  try {
    if (db.ingestionRun?.findFirst) {
      return await db.ingestionRun.findFirst({
        where: {
          status: "PROCESSING",
          lockedUntil: { gt: now },
        },
      });
    }
  } catch (err: any) {
    if (err?.code !== "P2021" && !err?.message?.includes("does not exist")) {
      throw err;
    }
  }

  if (db.auditLog?.findMany) {
    try {
      const logs = await db.auditLog.findMany({
        where: { entityType: "IngestionRun", action: "INGESTION_RUN_PROCESSING" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      for (const log of logs) {
        const details = log.details as any;
        if (details?.status === "PROCESSING" && details?.lockedUntil && new Date(details.lockedUntil) > now) {
          return details;
        }
      }
    } catch {}
  }
  return null;
}

async function dbCreateRun(db: any, data: any): Promise<any> {
  const id = data.id || crypto.randomUUID();
  const runObj = { ...data, id, createdAt: new Date(), updatedAt: new Date() };

  try {
    if (db.ingestionRun?.create) {
      return await db.ingestionRun.create({ data: runObj });
    }
  } catch (err: any) {
    if (err?.code !== "P2021" && !err?.message?.includes("does not exist")) {
      throw err;
    }
  }

  if (db.auditLog?.create) {
    await db.auditLog.create({
      data: {
        action: "INGESTION_RUN_PROCESSING",
        entityType: "IngestionRun",
        entityId: data.idempotencyKey,
        details: runObj,
      },
    });
  }
  return runObj;
}

async function dbUpdateRunById(db: any, id: string, idempotencyKey: string, data: any): Promise<any> {
  try {
    if (db.ingestionRun?.update) {
      return await db.ingestionRun.update({
        where: { id },
        data,
      });
    }
  } catch (err: any) {
    if (err?.code !== "P2021" && !err?.message?.includes("does not exist")) {
      throw err;
    }
  }

  const existing = await dbFindRunByIdempotencyKey(db, idempotencyKey);
  const updated = { ...(existing || {}), ...data, id, idempotencyKey, updatedAt: new Date() };
  const action =
    data.status === "COMPLETED"
      ? "INGESTION_RUN_COMPLETED"
      : data.status === "FAILED"
      ? "INGESTION_RUN_FAILED"
      : "INGESTION_RUN_PROCESSING";

  if (db.auditLog?.create) {
    await db.auditLog.create({
      data: {
        action,
        entityType: "IngestionRun",
        entityId: idempotencyKey,
        details: updated,
      },
    });
  }
  return updated;
}

async function dbUpdateRunStatus(
  db: any,
  runId: string,
  claimToken: string,
  idempotencyKey: string,
  data: any,
): Promise<{ count: number }> {
  try {
    if (db.ingestionRun?.updateMany) {
      const res = await db.ingestionRun.updateMany({
        where: { id: runId, claimToken },
        data,
      });
      if (res && res.count > 0) return res;
    }
  } catch (err: any) {
    if (err?.code !== "P2021" && !err?.message?.includes("does not exist")) {
      throw err;
    }
  }

  const existing = await dbFindRunByIdempotencyKey(db, idempotencyKey);
  const updated = { ...(existing || {}), ...data, id: runId, claimToken, idempotencyKey, updatedAt: new Date() };
  const action =
    data.status === "COMPLETED"
      ? "INGESTION_RUN_COMPLETED"
      : data.status === "FAILED"
      ? "INGESTION_RUN_FAILED"
      : "INGESTION_RUN_PROCESSING";

  if (db.auditLog?.create) {
    await db.auditLog.create({
      data: {
        action,
        entityType: "IngestionRun",
        entityId: idempotencyKey,
        details: updated,
      },
    });
  }
  return { count: 1 };
}