import crypto from "crypto";
import { computeOpportunityRevisionDiff } from "./diff-engine.js";
import { isSeverityAtLeast } from "./severity.js";
import {
  AuthoritativeRevisionSnapshot,
  RadarAlertCadence,
  RadarChangeSeverity,
  calculateNextDigestSchedule,
} from "./types.js";
import { calculateFounderFit } from "@buildworth/scoring";
import { logger } from "@buildworth/observability";

export function buildSnapshotFromDbRevision(rev: any): AuthoritativeRevisionSnapshot {
  const opp = rev.opportunity || {};
  const blueprint = rev.blueprint || {};
  const scenarios = blueprint.financialScenarios || [];
  const baseScenario = scenarios.find((s: any) => s.scenarioType === "BASE") || scenarios[0] || {};
  const costs = blueprint.costLineItems || [];
  const risks = blueprint.risks || [];
  const competitors = blueprint.competitors || [];
  const evidenceLinks = rev.evidenceLinks || [];

  const minBuild = costs
    .filter((c: any) => c.costType === "ONE_TIME_BUILD")
    .reduce((acc: number, c: any) => acc + (c.amountMinorCents || 0), 0);
  const maxBuild = Math.round(minBuild * 1.5);
  const baseBuild = minBuild;

  const snapshot = rev.snapshotData && typeof rev.snapshotData === "object" ? rev.snapshotData : {};

  return {
    id: rev.id,
    revisionNumber: rev.revisionNumber,
    opportunityId: rev.opportunityId,
    publicationQualityStatus:
      snapshot.publicationQualityStatus || opp.publicationQualityStatus || "HYPOTHESIS",
    evidenceConfidenceScore:
      snapshot.evidenceConfidenceScore ??
      opp.scorecards?.[0]?.evidenceConfidenceScore ??
      opp.evidenceConfidenceScore ??
      70,
    opportunityScore:
      snapshot.opportunityScore ??
      opp.scorecards?.[0]?.opportunityScore ??
      opp.opportunityScore ??
      70,
    decisionRecommendation:
      snapshot.decisionRecommendation ||
      blueprint.decisionEvaluation?.recommendation ||
      opp.decisionRecommendation ||
      "VALIDATE_FIRST",
    decisionReasonCodes:
      snapshot.decisionReasonCodes ||
      blueprint.decisionEvaluation?.reasonCodes ||
      opp.decisionReasonCodes ||
      [],
    pricing: {
      baseMonthlyPriceCents:
        baseScenario.monthlyPriceCents || snapshot.pricing?.baseMonthlyPriceCents || 0,
      currency: baseScenario.currency || snapshot.pricing?.currency || "USD",
    },
    mvpCost: {
      minBuildMinorCents: minBuild,
      maxBuildMinorCents: maxBuild,
      baseBuildMinorCents: baseBuild,
    },
    deliveryTimeWeeks: {
      minWeeks: baseScenario.deliveryTimeWeeks
        ? Math.max(1, baseScenario.deliveryTimeWeeks - 2)
        : 4,
      maxWeeks: baseScenario.deliveryTimeWeeks ? baseScenario.deliveryTimeWeeks + 4 : 12,
      baseWeeks: baseScenario.deliveryTimeWeeks || 8,
    },
    competitors: competitors.map((c: any) => ({
      name: c.name,
      competitorType: c.competitorType || "DIRECT",
      knownPricing: c.knownPricing,
    })),
    risks: risks.map((r: any) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      status: r.status,
      description: r.description,
    })),
    evidenceSignals: evidenceLinks.map((el: any) => ({
      id: el.normalizedSignal?.id || el.id,
      signalType: el.normalizedSignal?.signalType || "PAIN",
      purchaseIntent: !!el.normalizedSignal?.purchaseIntent,
      spendingSignal: el.normalizedSignal?.spendingSignal,
      verificationStatus: el.normalizedSignal?.verificationStatus || "VERIFIED",
      claimType: el.claimType,
      relationshipType: el.relationshipType,
    })),
  };
}

export async function processOpportunityRadarForRevision(
  prisma: any,
  toRevisionId: string,
): Promise<{
  changeEventId?: string;
  evaluationsCount: number;
  outboxItemsCount: number;
}> {
  // 1. Fetch current revision with full authoritative relations
  const toRev = await prisma.opportunityRevision.findUnique({
    where: { id: toRevisionId },
    include: {
      opportunity: {
        include: {
          scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      blueprint: {
        include: {
          financialScenarios: true,
          costLineItems: true,
          risks: true,
          competitors: true,
          decisionEvaluation: true,
          founderRequirements: {
            include: { requiredSkills: true },
          },
        },
      },
      evidenceLinks: {
        include: { normalizedSignal: true },
      },
    },
  });

  if (!toRev) {
    throw new Error(`RADAR_PROCESSOR_ERROR: Revision ${toRevisionId} not found.`);
  }

  // 2. Identify immediately previous revision deterministically
  const fromRev = await prisma.opportunityRevision.findFirst({
    where: {
      opportunityId: toRev.opportunityId,
      revisionNumber: toRev.revisionNumber - 1,
    },
    include: {
      opportunity: {
        include: {
          scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      blueprint: {
        include: {
          financialScenarios: true,
          costLineItems: true,
          risks: true,
          competitors: true,
          decisionEvaluation: true,
          founderRequirements: {
            include: { requiredSkills: true },
          },
        },
      },
      evidenceLinks: {
        include: { normalizedSignal: true },
      },
    },
  });

  // If revision 1 (no previous revision), initial creation does not produce a misleading "changed" alert
  if (!fromRev) {
    logger.info(
      `Radar: Revision ${toRev.revisionNumber} is initial revision for opportunity ${toRev.opportunityId}. Zero diff created.`,
    );
    await prisma.opportunityRadarJob.updateMany({
      where: { opportunityRevisionId: toRev.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    return { evaluationsCount: 0, outboxItemsCount: 0 };
  }

  // 3. Compute Deterministic Global Diff
  const fromSnapshot = buildSnapshotFromDbRevision(fromRev);
  const toSnapshot = buildSnapshotFromDbRevision(toRev);
  const diff = computeOpportunityRevisionDiff(fromSnapshot, toSnapshot);

  // If zero items changed, do not store empty event
  if (diff.items.length === 0) {
    logger.info(
      `Radar: Revisions ${fromRev.revisionNumber} -> ${toRev.revisionNumber} have zero material differences.`,
    );
    await prisma.opportunityRadarJob.updateMany({
      where: { opportunityRevisionId: toRev.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    return { evaluationsCount: 0, outboxItemsCount: 0 };
  }

  // 4. Create or Retrieve Global OpportunityChangeEvent
  let changeEvent = await prisma.opportunityChangeEvent.findUnique({
    where: {
      fromRevisionId_toRevisionId_diffVersion: {
        fromRevisionId: fromRev.id,
        toRevisionId: toRev.id,
        diffVersion: diff.diffVersion,
      },
    },
    include: { items: true },
  });

  if (!changeEvent) {
    changeEvent = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: toRev.opportunityId,
        fromRevisionId: fromRev.id,
        toRevisionId: toRev.id,
        diffVersion: diff.diffVersion,
        canonicalInputHash: diff.canonicalInputHash,
        overallSeverity: diff.overallSeverity,
        items: {
          create: diff.items.map((item) => ({
            dimension: item.dimension,
            direction: item.direction,
            severity: item.severity,
            reasonCode: item.reasonCode,
            sanitizedSummary: item.sanitizedSummary,
            beforeValue: item.beforeValue,
            afterValue: item.afterValue,
            numericDelta: item.numericDelta ?? null,
            evidenceSignalIds: item.evidenceSignalIds || [],
          })),
        },
      },
      include: { items: true },
    });
  }

  // 5. Load Active Watches for this Opportunity
  const watches = await prisma.savedOpportunity.findMany({
    where: {
      opportunityId: toRev.opportunityId,
      radarEnabled: true,
    },
    include: {
      user: {
        include: {
          notificationPreference: true,
          founderProfile: {
            include: {
              revisions: {
                orderBy: { revisionNumber: "desc" },
                take: 1,
                include: {
                  skills: true,
                  domainExpertise: true,
                  distributionAssets: true,
                  preference: true,
                  constraint: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let evaluationsCount = 0;
  let outboxItemsCount = 0;

  for (const watch of watches) {
    const user = watch.user;
    if (!user) continue;

    // Check if watch is muted
    if (watch.mutedUntil && new Date(watch.mutedUntil) > new Date()) {
      continue;
    }

    // 6. Filter change items according to watch preferences
    const matchingItems = diff.items.filter((item) => {
      // Check minimum severity
      if (!isSeverityAtLeast(item.severity, watch.minimumSeverity as RadarChangeSeverity)) {
        return false;
      }

      // Check dimension-specific toggles
      if (item.dimension === "PUBLICATION_STATUS" && !watch.alertOnStatusChange) return false;
      if (item.dimension === "DECISION_RECOMMENDATION" && !watch.alertOnRecommendationChange)
        return false;
      if (item.dimension === "WILLINGNESS_TO_PAY" && !watch.alertOnNewWtpEvidence) return false;
      if (item.dimension === "PRICING" && !watch.alertOnCostChange) return false;
      if (item.dimension === "MVP_COST" && !watch.alertOnCostChange) return false;
      if (item.dimension === "COMPETITOR" && !watch.alertOnCompetitorChange) return false;
      if (item.dimension === "CRITICAL_RISK" && !watch.alertOnRiskChange) return false;
      if (
        item.dimension === "EVIDENCE_CONFIDENCE" &&
        item.numericDelta &&
        Math.abs(item.numericDelta) < watch.minimumConfidenceDelta
      )
        return false;

      return true;
    });

    const isMatched = matchingItems.length > 0;
    const matchReasonCodes = matchingItems.map((i) => i.reasonCode);

    // 7. Calculate Personalized Founder Fit & Rank if Founder Profile exists
    let prevFitScore: number | null = null;
    let currFitScore: number | null = null;
    let fitDelta: number | null = null;
    let prevRank: number | null = null;
    let currRank: number | null = null;
    let rankDelta: number | null = null;
    let hardBlockersAdded: string[] = [];
    let hardBlockersRemoved: string[] = [];

    const activeProfileRevision = user.founderProfile?.revisions?.[0];

    if (activeProfileRevision && toRev.blueprint?.founderRequirements) {
      try {
        const profileData = {
          userId: user.id,
          skills: activeProfileRevision.skills.map((s: any) => ({
            skillKey: s.skillKey,
            proficiency: s.proficiency,
            isPrimary: s.isPrimary,
          })),
          domainExpertise: activeProfileRevision.domainExpertise.map((d: any) => ({
            industryOrDomain: d.industryOrDomain,
            yearsExperienceBand: d.yearsExperienceBand,
            workflowContext: d.workflowContext,
          })),
          distributionAssets: activeProfileRevision.distributionAssets.map((a: any) => ({
            assetType: a.assetType,
            audienceSizeBand: a.audienceSizeBand,
            description: a.description,
          })),
          preferences: {
            preferredIndustries: activeProfileRevision.preference?.preferredIndustries || [],
            excludedIndustries: activeProfileRevision.preference?.excludedIndustries || [],
            preferredBusinessModels:
              activeProfileRevision.preference?.preferredBusinessModels || [],
            targetGeographies: activeProfileRevision.preference?.targetGeographies || [],
            preferredBuyerRoles: activeProfileRevision.preference?.preferredBuyerRoles || [],
            preferredSalesMotion: activeProfileRevision.preference?.preferredSalesMotion || null,
          },
          constraints: {
            mvpBudgetBand: activeProfileRevision.constraint?.mvpBudgetBand || "UNDER_1K_USD",
            budgetCurrency: activeProfileRevision.constraint?.budgetCurrency || "USD",
            availableHoursPerWeekBand:
              activeProfileRevision.constraint?.availableHoursPerWeekBand || "HOURS_10_TO_20",
            teamSizeBand: activeProfileRevision.constraint?.teamSizeBand || "SOLO_FOUNDER",
            maxTimeToMvpWeeks: activeProfileRevision.constraint?.maxTimeToMvpWeeks || undefined,
            technicalRiskTolerance:
              activeProfileRevision.constraint?.technicalRiskTolerance || "MEDIUM",
            regulatoryRiskTolerance: "MEDIUM",
            salesComplexityTolerance: "MEDIUM",
            operationalBurdenTolerance: "MEDIUM",
            fundingPreference: "BOOTSTRAP_FIRST",
          },
        };

        // Evaluate on toRev
        const currReq = toRev.blueprint.founderRequirements;
        const currFitRes = calculateFounderFit(
          profileData as any,
          {
            blueprintId: toRev.blueprint.id,
            targetCustomerSegments: [],
            requiredSkills: currReq.requiredSkills || [],
            domainExpertiseRequirements: currReq.primaryIndustry
              ? [
                  {
                    industryOrDomain: currReq.primaryIndustry,
                    minimumExperienceBand: "YEARS_1_TO_3",
                    importance: 3,
                  },
                ]
              : [],
            distributionRequirements: [],
            minimumBudgetBand: currReq.minimumBudgetBand,
            minimumCapacityBand: currReq.minimumCapacityBand,
            minimumTeamSizeBand: currReq.minimumTeamSizeBand,
            primarySalesMotion: currReq.primarySalesMotion,
            technicalRiskLevel: currReq.technicalRiskLevel,
            regulatoryRiskLevel: currReq.regulatoryRiskLevel,
          } as any,
          {
            opportunityScore: toSnapshot.opportunityScore,
            evidenceConfidence: toSnapshot.evidenceConfidenceScore,
            publicationQualityStatus: toSnapshot.publicationQualityStatus,
            decisionRecommendation: toSnapshot.decisionRecommendation,
          },
        );

        currFitScore = currFitRes.founderFitScore;
        currRank = currFitRes.personalizedRank;

        // Evaluate on fromRev
        if (fromRev.blueprint?.founderRequirements) {
          const prevReq = fromRev.blueprint.founderRequirements;
          const prevFitRes = calculateFounderFit(
            profileData as any,
            {
              blueprintId: fromRev.blueprint.id,
              targetCustomerSegments: [],
              requiredSkills: prevReq.requiredSkills || [],
              domainExpertiseRequirements: prevReq.primaryIndustry
                ? [
                    {
                      industryOrDomain: prevReq.primaryIndustry,
                      minimumExperienceBand: "YEARS_1_TO_3",
                      importance: 3,
                    },
                  ]
                : [],
              distributionRequirements: [],
              minimumBudgetBand: prevReq.minimumBudgetBand,
              minimumCapacityBand: prevReq.minimumCapacityBand,
              minimumTeamSizeBand: prevReq.minimumTeamSizeBand,
              primarySalesMotion: prevReq.primarySalesMotion,
              technicalRiskLevel: prevReq.technicalRiskLevel,
              regulatoryRiskLevel: prevReq.regulatoryRiskLevel,
            } as any,
            {
              opportunityScore: fromSnapshot.opportunityScore,
              evidenceConfidence: fromSnapshot.evidenceConfidenceScore,
              publicationQualityStatus: fromSnapshot.publicationQualityStatus,
              decisionRecommendation: fromSnapshot.decisionRecommendation,
            },
          );
          prevFitScore = prevFitRes.founderFitScore;
          prevRank = prevFitRes.personalizedRank;

          const prevBlockers = new Set(prevFitRes.blockers.map((b: any) => b.code));
          const currBlockers = new Set(currFitRes.blockers.map((b: any) => b.code));

          hardBlockersAdded = [...currBlockers].filter(
            (b) => typeof b === "string" && !prevBlockers.has(b),
          ) as string[];
          hardBlockersRemoved = [...prevBlockers].filter(
            (b) => typeof b === "string" && !currBlockers.has(b),
          ) as string[];
        }

        if (prevFitScore !== null && currFitScore !== null) {
          fitDelta = currFitScore - prevFitScore;
        }
        if (prevRank !== null && currRank !== null) {
          rankDelta = Number((currRank - prevRank).toFixed(2));
        }
      } catch (err: any) {
        logger.error(
          `Error calculating personalized fit impact for watch ${watch.id}: ${err?.message}`,
        );
      }
    }

    const evaluationHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          watchId: watch.id,
          changeEventId: changeEvent.id,
          profileRevId: activeProfileRevision?.id || null,
          matched: isMatched,
          fitScore: currFitScore,
        }),
      )
      .digest("hex");

    // 8. Create or update RadarEvaluation
    const radarEval = await prisma.radarEvaluation.upsert({
      where: {
        watchId_changeEventId_evaluationVersion: {
          watchId: watch.id,
          changeEventId: changeEvent.id,
          evaluationVersion: "1.0.0",
        },
      },
      create: {
        watchId: watch.id,
        changeEventId: changeEvent.id,
        founderProfileRevisionId: activeProfileRevision?.id || null,
        previousFounderFit: prevFitScore,
        currentFounderFit: currFitScore,
        founderFitDelta: fitDelta,
        previousPersonalizedRank: prevRank,
        currentPersonalizedRank: currRank,
        personalizedRankDelta: rankDelta,
        hardBlockersAdded,
        hardBlockersRemoved,
        matched: isMatched,
        reasonCodes: matchReasonCodes,
        evaluationVersion: "1.0.0",
        canonicalInputHash: evaluationHash,
      },
      update: {
        matched: isMatched,
        reasonCodes: matchReasonCodes,
        currentFounderFit: currFitScore,
        founderFitDelta: fitDelta,
      },
    });
    evaluationsCount++;

    // 9. Update lastEvaluatedRevisionId on watch
    await prisma.savedOpportunity.update({
      where: { id: watch.id },
      data: { lastEvaluatedRevisionId: toRev.id },
    });

    // 10. Queue Notification Outbox entry if matched
    if (isMatched) {
      const isPro = user.tier === "PRO";
      const cadence: RadarAlertCadence = watch.alertCadence as RadarAlertCadence;

      // Entitlement Policy:
      // FREE: weekly digest eligibility only, no instant alerts
      // PRO: instant critical/high, daily digest, or weekly digest
      let targetNotificationType:
        "RADAR_CHANGE_ALERT" | "RADAR_DAILY_DIGEST" | "RADAR_WEEKLY_DIGEST" = "RADAR_WEEKLY_DIGEST";
      let scheduledFor = new Date();
      const userTimezone = user.notificationPreference?.timezone || "UTC";

      if (isPro) {
        if (
          cadence === "INSTANT" &&
          (diff.overallSeverity === "CRITICAL" || diff.overallSeverity === "HIGH")
        ) {
          targetNotificationType = "RADAR_CHANGE_ALERT";
          scheduledFor = new Date(); // Immediate
        } else if (cadence === "DAILY_DIGEST") {
          targetNotificationType = "RADAR_DAILY_DIGEST";
          scheduledFor = calculateNextDigestSchedule("DAILY_DIGEST", userTimezone);
        } else {
          targetNotificationType = "RADAR_WEEKLY_DIGEST";
          scheduledFor = calculateNextDigestSchedule("WEEKLY_DIGEST", userTimezone);
        }
      } else {
        // Free user forced to weekly digest
        targetNotificationType = "RADAR_WEEKLY_DIGEST";
        scheduledFor = calculateNextDigestSchedule("WEEKLY_DIGEST", userTimezone);
      }

      const deduplicationKey = `outbox_${user.id}_${toRev.opportunityId}_${changeEvent.id}_EMAIL_${targetNotificationType}`;

      const sanitizedPayload = {
        opportunityId: toRev.opportunityId,
        opportunityTitle: toRev.opportunity.title,
        opportunitySlug: toRev.opportunity.slug,
        fromRevisionNumber: fromRev.revisionNumber,
        toRevisionNumber: toRev.revisionNumber,
        overallSeverity: diff.overallSeverity,
        matchedReasons: matchReasonCodes,
        changes: matchingItems.map((item) => ({
          dimension: item.dimension,
          severity: item.severity,
          summary: item.sanitizedSummary,
        })),
        founderFitImpact:
          currFitScore !== null
            ? {
                currentScore: currFitScore,
                delta: fitDelta,
                hardBlockersAdded,
                hardBlockersRemoved,
              }
            : null,
      };

      try {
        await prisma.notificationOutbox.upsert({
          where: { deduplicationKey },
          create: {
            userId: user.id,
            opportunityId: toRev.opportunityId,
            changeEventId: changeEvent.id,
            radarEvaluationId: radarEval.id,
            notificationType: targetNotificationType,
            channel: "EMAIL",
            scheduledFor,
            status: "PENDING",
            deduplicationKey,
            sanitizedPayload,
          },
          update: {
            sanitizedPayload,
          },
        });
        outboxItemsCount++;
      } catch (err: any) {
        logger.error(`Error queueing notification outbox for user ${user.id}: ${err?.message}`);
      }
    }
  }

  await prisma.opportunityRadarJob.updateMany({
    where: { opportunityRevisionId: toRev.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return {
    changeEventId: changeEvent.id,
    evaluationsCount,
    outboxItemsCount,
  };
}

/**
 * Race-Safe Durable Radar Worker that claims PENDING or expired PROCESSING OpportunityRadarJob rows.
 */
export async function processPendingRadarJobs(
  prisma: any,
  options: {
    batchSize?: number;
    workerId?: string;
    leaseDurationSeconds?: number;
    maxAttempts?: number;
  } = {},
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const batchSize = options.batchSize || 10;
  const workerId =
    options.workerId || `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const leaseDurationSeconds = options.leaseDurationSeconds || 60;
  const maxAttempts = options.maxAttempts || 5;

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + leaseDurationSeconds * 1000);
  const claimToken = `claim_${crypto.randomBytes(16).toString("hex")}`;

  let claimedJobs: any[] = [];

  try {
    const rawJobs: any[] = await prisma.$queryRaw`
      SELECT id FROM opportunity_radar_jobs
      WHERE (
        status = 'PENDING'::"RadarJobStatus"
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      ) OR (
        status = 'PROCESSING'::"RadarJobStatus"
        AND "lockedUntil" IS NOT NULL
        AND "lockedUntil" <= ${now}
      )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize};
    `;

    if (rawJobs && rawJobs.length > 0) {
      const jobIds = rawJobs.map((j: any) => j.id);
      await prisma.opportunityRadarJob.updateMany({
        where: { id: { in: jobIds } },
        data: {
          status: "PROCESSING",
          claimToken,
          lockedBy: workerId,
          lockedAt: now,
          lockedUntil,
          attemptCount: { increment: 1 },
        },
      });

      claimedJobs = await prisma.opportunityRadarJob.findMany({
        where: { id: { in: jobIds }, claimToken },
      });
    }
  } catch (err: any) {
    logger.warn(`Fallback querying opportunity_radar_jobs: ${err?.message}`);
    const candidates = await prisma.opportunityRadarJob.findMany({
      where: {
        OR: [
          {
            status: "PENDING",
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          {
            status: "PROCESSING",
            lockedUntil: { lte: now },
          },
        ],
      },
      take: batchSize,
    });

    claimedJobs = [];
    for (const cand of candidates) {
      try {
        const updated = await prisma.opportunityRadarJob.update({
          where: { id: cand.id, status: cand.status },
          data: {
            status: "PROCESSING",
            claimToken,
            lockedBy: workerId,
            lockedAt: now,
            lockedUntil,
            attemptCount: { increment: 1 },
          },
        });
        claimedJobs.push(updated);
      } catch {
        // Claimed concurrently
      }
    }
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of claimedJobs) {
    processed++;
    try {
      await processOpportunityRadarForRevision(prisma, job.opportunityRevisionId);
      await prisma.opportunityRadarJob.updateMany({
        where: { id: job.id, claimToken },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          lockedBy: null,
          claimToken: null,
        },
      });
      succeeded++;
    } catch (err: any) {
      failed++;
      const isTerminal = job.attemptCount >= maxAttempts;
      const backoffSeconds = Math.min(300, Math.pow(2, job.attemptCount) * 5);
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

      await prisma.opportunityRadarJob.updateMany({
        where: { id: job.id, claimToken },
        data: {
          status: isTerminal ? "DEAD_LETTER" : "FAILED",
          lastError: String(err?.message || err),
          nextAttemptAt: isTerminal ? null : nextAttemptAt,
          lockedBy: null,
          claimToken: null,
        },
      });
    }
  }

  return { processed, succeeded, failed };
}
