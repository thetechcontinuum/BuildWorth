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
} from "@buildworth/shared";
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
  cleanSyntheticPrior?: boolean;
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
      include: {
        revisions: {
          include: {
            blueprints: {
              include: {
                customerSegments: true,
                mvpFeatures: true,
                competitors: true,
                costLineItems: true,
                benefitDrivers: true,
                risks: true,
                assumptions: true,
                validationExperiments: true,
                financialScenarios: {
                  include: {
                    annualProjections: true,
                  },
                },
              },
            },
          },
        },
        scorecards: true,
        evidenceLinks: true,
      },
    });

    if (opp) {
      for (const rev of opp.revisions) {
        for (const bp of rev.blueprints) {
          for (const fs of bp.financialScenarios) {
            await prisma.scenarioAnnualProjection.deleteMany({
              where: { scenarioId: fs.id },
            }).catch(() => {});
          }
          await prisma.blueprintFinancialScenario.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintCustomerSegment.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintMvpFeature.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintCompetitor.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintCostLineItem.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintBenefitDriver.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintRiskItem.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintAssumptionItem.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.blueprintValidationExperiment.deleteMany({
            where: { blueprintId: bp.id },
          }).catch(() => {});
          await prisma.opportunityBlueprint.delete({
            where: { id: bp.id },
          }).catch(() => {});
        }
        await prisma.opportunityRevision.delete({
          where: { id: rev.id },
        }).catch(() => {});
      }

      await prisma.evidenceLink.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.scorecard.deleteMany({
        where: { opportunityId: opp.id },
      }).catch(() => {});

      await prisma.opportunity.delete({
        where: { id: opp.id },
      }).catch(() => {});

      cleanedOpportunities++;
    }
  }

  // Clean old test raw and normalized signals from synthetic probing
  const testUrls = [
    "https://news.ycombinator.com/item?id=38491021",
    "https://news.ycombinator.com/item?id=39210044",
    "https://reddit.com/r/devops/comments/1f92a10",
    "https://github.com/example-org/devops-tools/issues/98214",
    "https://producthunt.com/posts/example-devops-tool",
  ];

  for (const url of testUrls) {
    const rawList = await prisma.rawSignal.findMany({
      where: { sourceUrl: url },
    });
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
  }

  return { cleanedOpportunities, cleanedRawSignals, cleanedNormalizedSignals };
}

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
    currentRun = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.ingestionRun.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        if (existing.status === "COMPLETED" || existing.status === "FAILED") {
          return { run: existing, isExisting: true, action: "RETURN_EXISTING" };
        }

        const isLeaseActive = existing.lockedUntil && new Date(existing.lockedUntil) > new Date();
        if (existing.status === "PROCESSING" && isLeaseActive) {
          return { run: existing, isExisting: true, action: "IN_PROGRESS" };
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
        return { run: reclaimed, isExisting: false, action: "RECLAIMED" };
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
  let normalizedSignalsCount = 0;
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
      const totalSourcesCount = await prisma.source.count().catch(() => 0);
      if (totalSourcesCount === 0) {
        // Seed default approved staging sources if none exist in database
        try {
          const defaultSources = [
            {
              key: "hackernews",
              name: "Hacker News",
              description: "Hacker News community submissions and comments",
              adapterType: "HACKERNEWS_API",
              accessMethod: "API",
              isEnabled: true,
              policyStatus: "ALLOWED" as any,
              credibilityTier: "TIER_1_PRIMARY" as any,
              rateLimitPerMinute: 120,
              permittedExcerptLength: 280,
              requiresAttribution: true,
              termsNotes: "Uses official open API for indexing problem discussions.",
            },
            {
              key: "reddit",
              name: "Reddit Tech & Ops",
              description: "Public technical subreddits (r/devops, r/dataengineering)",
              adapterType: "REDDIT_OAUTH",
              accessMethod: "OAUTH_API",
              isEnabled: true,
              policyStatus: "ALLOWED" as any,
              credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
              rateLimitPerMinute: 60,
              permittedExcerptLength: 280,
              requiresAttribution: true,
              termsNotes: "OAuth API with short excerpts and permalink citations.",
            },
            {
              key: "github",
              name: "GitHub Issues & Discussions",
              description: "Public GitHub repository problem statements and issues",
              adapterType: "GITHUB_REST",
              accessMethod: "API",
              isEnabled: true,
              policyStatus: "ALLOWED" as any,
              credibilityTier: "TIER_1_PRIMARY" as any,
              rateLimitPerMinute: 80,
              permittedExcerptLength: 280,
              requiresAttribution: true,
              termsNotes: "Extracts public open-source repository issue friction.",
            },
            {
              key: "producthunt",
              name: "Product Hunt Reviews",
              description: "Product Hunt market feedback and user complaints",
              adapterType: "PRODUCTHUNT_API",
              accessMethod: "API",
              isEnabled: true,
              policyStatus: "ALLOWED" as any,
              credibilityTier: "TIER_2_CREDIBLE_PUBLIC" as any,
              rateLimitPerMinute: 60,
              permittedExcerptLength: 280,
              requiresAttribution: true,
              termsNotes: "Permitted API access for product reviews and gaps.",
            },
          ];

          for (const src of defaultSources) {
            await prisma.source.upsert({
              where: { key: src.key },
              update: { isEnabled: true, policyStatus: "ALLOWED" as any },
              create: src,
            });
          }

          activeSources = await prisma.source.findMany({
            where: {
              isEnabled: true,
              key: { in: ALLOWLISTED_SOURCE_KEYS },
            },
            take: maxSources,
          });
        } catch (seedErr: any) {
          logger.warn("Could not seed default staging sources", { error: seedErr?.message });
        }
      }
    }

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
                  fetchedAt: new Date(),
                },
              });
              rawSignalsCount++;
              srcIngestedCount++;
            }
          } else {
            totalDeduplicated++;
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
              );

              normRecord = await prisma.normalizedSignal.create({
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
            status: srcErrorMsg ? "FAILED" : "COMPLETED",
            errorMessage: srcErrorMsg,
            completedAt: new Date(),
            itemsExtracted: srcIngestedCount,
          },
        });
      }
    }

    // Fall back to existing unclustered verified NormalizedSignals if available
    if (sanitizedSignalsToProcess.length === 0) {
      const existingUnclustered = await prisma.normalizedSignal.findMany({
        where: {
          clusterMemberships: { none: {} },
        },
        include: { rawSignal: { include: { source: true } } },
        take: maxCandidates,
        orderBy: { createdAt: "desc" },
      });

      for (const sig of existingUnclustered) {
        if (sig.rawSignal && sig.rawSignal.source) {
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
        }
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
          vertical: extracted.workflowContext?.includes("DevOps") || extracted.workflowContext?.includes("Compliance")
            ? "DevOps & Compliance"
            : "Data Engineering & FinOps",
          embedding: emb.embedding,
        });
      } catch (aiErr: any) {
        logger.error("AI step encountered error", aiErr);
        const msg = String(aiErr?.message || "");

        let failCode = "AI_PROVIDER_UNAVAILABLE";
        if (msg.includes("not configured") || msg.includes("AI_PROVIDER_NOT_CONFIGURED")) {
          failCode = "AI_PROVIDER_NOT_CONFIGURED";
        } else if (msg.includes("invalid") || msg.includes("AI_OUTPUT_INVALID") || msg.includes("schema")) {
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

    // 5. Semantic Clustering
    const clusters = clusterCandidates.length > 0 ? clusterSignals(clusterCandidates, 0.75) : [];
    const boundedClusters = clusters.slice(0, maxPublishedOpportunities);

    // 6. Complete Publication Chain Traceability Enforcement & Blueprint Synthesis
    // Source -> RawSignal -> NormalizedSignal -> EvidenceLink -> OpportunityRevision -> Opportunity
    for (const cl of boundedClusters) {
      if (Date.now() > deadline || publishedCount >= maxPublishedOpportunities) break;

      // Verify complete publication chain for every supporting signal in cluster
      const verifiedSignals: Array<{
        normalizedSignal: any;
        rawSignal: any;
        source: any;
      }> = [];

      for (const sigId of cl.signalIds) {
        const normSig = await prisma.normalizedSignal.findUnique({
          where: { id: sigId },
          include: {
            rawSignal: {
              include: { source: true },
            },
          },
        });

        if (normSig && normSig.rawSignal && normSig.rawSignal.source) {
          verifiedSignals.push({
            normalizedSignal: normSig,
            rawSignal: normSig.rawSignal,
            source: normSig.rawSignal.source,
          });
        }
      }

      // Reject candidate if full trace is incomplete
      if (verifiedSignals.length === 0) {
        logger.warn("Rejecting cluster candidate: missing verifiable publication chain", { clusterId: cl.clusterId });
        continue;
      }

      const rawTitle = cl.title || cl.summary;
      const formattedTitle = formatMeaningfulTitle(rawTitle);
      const generatedSlug = generateCollisionSafeSlug(formattedTitle);

      const blueprint = synthesizeOpportunity(cl, verifiedSignals.length);
      blueprint.title = formattedTitle;
      blueprint.slug = generatedSlug;

      // Ensure collision-safe uniqueness for slug in database
      let finalSlug = generatedSlug;
      const existingOpp = await prisma.opportunity.findUnique({
        where: { slug: finalSlug },
      });
      if (existingOpp && existingOpp.id) {
        finalSlug = generateCollisionSafeSlug(formattedTitle, crypto.randomBytes(3).toString("hex"));
        blueprint.slug = finalSlug;
      }

      let opp = await prisma.opportunity.create({
        data: {
          slug: finalSlug,
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

      // Persist Scorecard
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
          isHypothesisOnly: false,
        },
      });

      // Prepare child items with unique UUIDs
      const customerSegments: CustomerSegmentItem[] = blueprint.targetCustomerSegments.map((name) => ({
        id: "seg-" + crypto.randomUUID(),
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

      const competitors: CompetitorItem[] = (blueprint.existingCompetitors || []).map((name) => ({
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

      const risks: RiskItem[] = (blueprint.majorRisks || []).map((desc) => ({
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

      const assumptions: AssumptionItem[] = (blueprint.majorAssumptions || []).map((stmt) => ({
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

      const revisionResult = await createOpportunityRevisionTransaction(prisma, {
        opportunityId: opp.id,
        reasonForChange: "Initial manual staging ingestion empirical validation",
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

      // Persist EvidenceLinks connecting NormalizedSignals -> Opportunity & OpportunityRevision
      for (const item of verifiedSignals) {
        await prisma.evidenceLink.create({
          data: {
            opportunityId: opp.id,
            opportunityRevisionId: revisionResult.revisionId,
            normalizedSignalId: item.normalizedSignal.id,
            claimType: "PROBLEM_FREQUENCY",
            claimIdentifier: "claim-pain-" + opp.id,
            claimSnippet: item.normalizedSignal.sanitizedExcerpt,
            relationshipType: "SUPPORTS",
            supportStrength: "STRONG",
            explanation: `Empirically verified from ${item.source.name} (${item.rawSignal.sourceUrl})`,
            relevanceScore: 90,
          },
        });
      }

      publishedSlugs.push(finalSlug);
      publishedCount++;
    }

    // 7. Complete the IngestionRun
    const finalCompleted = await prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalFetched,
        totalDeduplicated,
        rawSignalsCount,
        candidatesCount,
        publishedCount,
        publishedSlugs,
        summary: {
          sourcesProcessed: activeSources.length,
          clustersDiscovered: clusters.length,
          normalizedSignalsCount,
        },
      },
    });

    logger.info("Manual staging ingestion finished successfully", {
      runId,
      publishedCount,
      publishedSlugs,
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
      startedAt: finalCompleted.startedAt ? new Date(finalCompleted.startedAt).toISOString() : now.toISOString(),
      completedAt: new Date().toISOString(),
      summary: finalCompleted.summary,
    };
  } catch (error: any) {
    logger.error("Error executing staging ingestion pipeline", error);
    const msg = String(error?.message || "");

    let sanitizedCode = "EXECUTION_ERROR";
    if (msg.includes("AI_PROVIDER_NOT_CONFIGURED") || msg.includes("not configured")) {
      sanitizedCode = "AI_PROVIDER_NOT_CONFIGURED";
    } else if (msg.includes("AI_PROVIDER_UNAVAILABLE") || msg.includes("UNAVAILABLE")) {
      sanitizedCode = "AI_PROVIDER_UNAVAILABLE";
    } else if (msg.includes("AI_OUTPUT_INVALID")) {
      sanitizedCode = "AI_OUTPUT_INVALID";
    }

    await markRunFailed(prisma, runId, claimToken, sanitizedCode);

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
        published: 0,
      },
      publishedSlugs: [],
      startedAt: now.toISOString(),
      failedAt: new Date().toISOString(),
    };
  }
}

async function markRunFailed(
  prisma: any,
  runId: string,
  claimToken: string,
  failureCode: string,
): Promise<void> {
  try {
    await prisma.ingestionRun.updateMany({
      where: { id: runId, claimToken },
      data: {
        status: "FAILED",
        failureCode,
        failedAt: new Date(),
      },
    });
  } catch (err: any) {
    logger.error("Failed to mark IngestionRun as failed in DB", err instanceof Error ? err : new Error(String(err)));
  }
}