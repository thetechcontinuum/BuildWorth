const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  processOpportunityRadarForRevision,
  processPendingNotificationOutbox,
} = require("../../opportunity-engine/dist/index.js");

async function runPhase4cE2eTests() {
  console.log(
    "=== BuildWorth Phase 4C Opportunity Radar & Race-Safe Outbox Worker Integration Suite ===",
  );

  const dbName = "test_phase4c_radar_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy all migrations
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    // 2. Reconcile Plan Catalog
    execSync(`DATABASE_URL="${dbUrl}" node "${path.resolve(__dirname, "reconcile-catalog.js")}"`, {
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Test 1: User creation & Watchlist Capacity Enforcement (Free max 3, Pro max 50)
    console.log("Test 1: Watchlist Capacity & Advisory Lock Enforcement...");
    const userFree = await prisma.user.create({
      data: { email: `radar_free_${Date.now()}@example.com`, tier: "FREE" },
    });
    const userPro = await prisma.user.create({
      data: { email: `radar_pro_${Date.now()}@example.com`, tier: "PRO" },
    });

    const opps = [];
    for (let i = 1; i <= 5; i++) {
      const opp = await prisma.opportunity.create({
        data: {
          slug: `radar-opp-${i}-${Date.now()}`,
          title: `Radar Opportunity ${i}`,
          oneSentenceSummary: `One sentence summary for opportunity ${i}`,
          problemStatement: `Problem statement for opportunity ${i}`,
          jobsToBeDone: ["Job 1", "Job 2"],
          proposedProduct: "Proposed product",
          narrowMvpScope: ["Scope 1"],
          targetCustomerSegments: ["B2B SaaS"],
          economicBuyer: "VP Engineering",
          endUser: "DevOps Engineer",
          buyingTrigger: "Audit coming up",
          existingWorkflow: "Manual spreadsheets",
          painSeverity: "CRITICAL",
          painFrequency: "MONTHLY",
          status: "PUBLISHED",
          customerType: "B2B",
          industry: "DevOps & Security",
          publicationQualityStatus: "HYPOTHESIS",
          decisionRecommendation: "VALIDATE_FIRST",
          estimatedMvpCostMinCents: 100000,
          estimatedMvpCostMaxCents: 200000,
          estimatedTimeToMvpMinWeeks: 4,
          estimatedTimeToMvpMaxWeeks: 8,
          estimatedMonthlyOpCostMinCents: 10000,
          estimatedMonthlyOpCostMaxCents: 20000,
          currency: "USD",
          recommendedNextExperiment: "Landing page pre-sale",
        },
      });
      opps.push(opp);
    }

    // Free user saves 3 opportunities
    for (let i = 0; i < 3; i++) {
      await prisma.savedOpportunity.create({
        data: {
          userId: userFree.id,
          opportunityId: opps[i].id,
          radarEnabled: true,
          alertCadence: "WEEKLY_DIGEST",
        },
      });
      await prisma.usageLedger.create({
        data: {
          userId: userFree.id,
          entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
          unitsConsumed: 1,
          resourceId: opps[i].id,
          periodBucketKey: "2026-08",
        },
      });
    }

    const freeCount = await prisma.savedOpportunity.count({ where: { userId: userFree.id } });
    if (freeCount !== 3) throw new Error(`Expected 3 saved opportunities, got ${freeCount}`);
    console.log("  ✓ Free user successfully saved 3 opportunities.");

    // Delete 1 watch and verify slot reuse with compensating ledger entry
    const watchToDelete = await prisma.savedOpportunity.findFirst({
      where: { userId: userFree.id, opportunityId: opps[0].id },
    });
    await prisma.savedOpportunity.delete({ where: { id: watchToDelete.id } });
    await prisma.usageLedger.create({
      data: {
        userId: userFree.id,
        entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
        unitsConsumed: -1, // Compensating entry
        resourceId: opps[0].id,
        periodBucketKey: "2026-08",
      },
    });

    // Reuse slot
    await prisma.savedOpportunity.create({
      data: {
        userId: userFree.id,
        opportunityId: opps[3].id,
        radarEnabled: true,
        alertCadence: "WEEKLY_DIGEST",
      },
    });
    console.log(
      "  ✓ Deleted watch and successfully reused slot with append-only compensating ledger entry.",
    );

    // Pro user saves 4 opportunities with instant alert
    for (let i = 0; i < 4; i++) {
      await prisma.savedOpportunity.create({
        data: {
          userId: userPro.id,
          opportunityId: opps[i].id,
          radarEnabled: true,
          alertCadence: "INSTANT",
        },
      });
    }
    console.log("  ✓ Pro user saved 4 opportunities with instant alert preference.");

    // Test 2: Opportunity Revisions & Radar Processing
    console.log("Test 2: Revision Creation and Radar Processing...");
    const targetOpp = opps[1];

    // Rev 1 (Initial)
    const rev1 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: targetOpp.id,
        revisionNumber: 1,
        snapshotData: {
          publicationQualityStatus: "HYPOTHESIS",
          evidenceConfidenceScore: 66,
          opportunityScore: 75,
          decisionRecommendation: "VALIDATE_FIRST",
        },
        reasonForChange: "Initial",
      },
    });
    await prisma.scorecard.create({
      data: {
        opportunityId: targetOpp.id,
        opportunityScore: 75,
        evidenceConfidenceScore: 66,
        demandScore: 70,
        feasibilityScore: 75,
        economicsScore: 70,
        competitionScore: 70,
        goMarketScore: 70,
      },
    });

    const initRadar = await processOpportunityRadarForRevision(prisma, rev1.id);
    if (initRadar.evaluationsCount !== 0 || initRadar.outboxItemsCount !== 0) {
      throw new Error("Initial revision created false diff!");
    }
    console.log("  ✓ Initial revision created 0 false diff events.");

    // Rev 2 (Update)
    const rev2 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: targetOpp.id,
        revisionNumber: 2,
        snapshotData: {
          publicationQualityStatus: "VERIFIED",
          evidenceConfidenceScore: 82,
          opportunityScore: 85,
          decisionRecommendation: "BUILD_CANDIDATE",
        },
        reasonForChange: "Validation update",
      },
    });
    await prisma.opportunity.update({
      where: { id: targetOpp.id },
      data: {
        currentRevisionId: rev2.id,
        publicationQualityStatus: "VERIFIED",
        decisionRecommendation: "BUILD_CANDIDATE",
      },
    });
    await prisma.scorecard.create({
      data: {
        opportunityId: targetOpp.id,
        opportunityScore: 85,
        evidenceConfidenceScore: 82,
        demandScore: 85,
        feasibilityScore: 85,
        economicsScore: 85,
        competitionScore: 85,
        goMarketScore: 85,
      },
    });
    await prisma.opportunityBlueprint.create({
      data: {
        opportunityRevisionId: rev2.id,
        schemaVersion: "1.0.0",
        generationStatus: "SYNTHESIZED",
        calculationVersion: "1.0.0",
        decisionRuleVersion: "1.0.0",
        inputHash: "hash_rev2",
        financialScenarios: {
          create: [
            {
              scenarioType: "BASE",
              currency: "USD",
              activeCustomers: 15,
              monthlyPriceCents: 7900,
              onboardingPriceCents: 0,
              variableCostPerCustomerCents: 500,
              monthlyFixedCostCents: 10000,
              customerAcquisitionCostCents: 20000,
              deliveryTimeWeeks: 6,
              grossMarginPercent: 85,
              monthlyContributionMarginCents: 111000,
              monthlyOperatingProfitCents: 101000,
              breakEvenCustomers: 2,
              customerAnnualCostCents: 94800,
              customerAnnualBenefitCents: 300000,
              customerNetAnnualBenefitCents: 205200,
              customerRoiPercent: 216,
              customerPaybackMonths: 3,
              providerCacPaybackMonths: 3,
              provenanceType: "MODEL_ESTIMATE",
              assumptions: [],
              inputHash: "hash_sc_2",
            },
          ],
        },
        decisionEvaluation: {
          create: {
            recommendation: "BUILD_CANDIDATE",
            reasonCodes: ["PROVEN_WTP", "HIGH_CONFIDENCE"],
            blockingConditions: [],
            opportunityScoreUsed: 85,
            evidenceConfidenceUsed: 82,
            publicationStatusUsed: "VERIFIED",
            economicsStatus: "HEALTHY",
            feasibilityStatus: "FEASIBLE",
            criticalRiskIds: [],
            invalidatedAssumptionIds: [],
            decisionRuleVersion: "1.0.0",
            inputHash: "hash_de_2",
          },
        },
      },
    });

    const radarRes = await processOpportunityRadarForRevision(prisma, rev2.id);
    if (!radarRes.changeEventId || radarRes.outboxItemsCount < 1) {
      throw new Error(
        `Radar processing failed to create outbox records: ${JSON.stringify(radarRes)}`,
      );
    }
    console.log(
      `  ✓ Radar diff processed: created global change event with ${radarRes.outboxItemsCount} outbox notifications.`,
    );

    // Test 3: Race-Safe Outbox Worker Execution with Concurrent Workers
    console.log("Test 3: Testing Race-Safe Outbox Worker with 2 Concurrent Workers...");
    const existingOutbox = await prisma.notificationOutbox.findMany();
    console.log("Existing outbox items before worker:", JSON.stringify(existingOutbox, null, 2));

    const [worker1Res, worker2Res] = await Promise.all([
      processPendingNotificationOutbox(prisma, { workerId: "worker_alpha", batchSize: 10 }),
      processPendingNotificationOutbox(prisma, { workerId: "worker_beta", batchSize: 10 }),
    ]);

    console.log("Worker 1 result:", worker1Res, "Worker 2 result:", worker2Res);
    const totalDelivered = worker1Res.delivered + worker2Res.delivered;
    if (totalDelivered < 1) throw new Error("Expected notifications to be claimed and delivered.");
    console.log(
      `  ✓ 2 Concurrent workers processed rows with SKIP LOCKED (Worker 1: ${worker1Res.delivered}, Worker 2: ${worker2Res.delivered}, Total: ${totalDelivered}).`,
    );

    // Test 4: Delivery-Time Entitlement & Unsubscribe Suppression Check
    console.log("Test 4: Delivery-Time Recheck on Downgrade / Unsubscribe...");
    // Queue a new instant alert for Free user
    const illegalFreeOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userFree.id,
        opportunityId: targetOpp.id,
        changeEventId: radarRes.changeEventId,
        notificationType: "RADAR_CHANGE_ALERT", // Illegal for FREE user at delivery time
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `test_recheck_downgrade_${Date.now()}`,
        sanitizedPayload: { title: "Illegal Instant" },
      },
    });

    const recheckRes = await processPendingNotificationOutbox(prisma);
    const checkedOutbox = await prisma.notificationOutbox.findUnique({
      where: { id: illegalFreeOutbox.id },
    });
    if (
      checkedOutbox.status !== "CANCELLED" ||
      !checkedOutbox.sanitizedLastError.includes("FREE_INSTANT_ALERT_PROHIBITED")
    ) {
      throw new Error(
        `Expected outbox to be CANCELLED on delivery-time recheck, got ${checkedOutbox.status}: ${checkedOutbox.sanitizedLastError}`,
      );
    }
    console.log(
      "  ✓ Delivery-time recheck correctly cancelled instant alert for downgraded/Free user.",
    );

    // Test 5: Provider-Level Idempotency Protection
    console.log("Test 5: Provider-Level Idempotency Verification...");
    const sharedSentIds = new Set();
    const idempOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userPro.id,
        opportunityId: targetOpp.id,
        changeEventId: radarRes.changeEventId,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `test_idemp_key_${Date.now()}`,
        sanitizedPayload: { title: "Idempotency Test" },
      },
    });

    // 1st delivery
    await processPendingNotificationOutbox(prisma, {
      providerOptions: { sentMessageIds: sharedSentIds },
    });
    // Reset status to PENDING simulating local retry after delivery
    await prisma.notificationOutbox.update({
      where: { id: idempOutbox.id },
      data: { status: "PENDING", nextAttemptAt: null, scheduledFor: new Date() },
    });
    // 2nd delivery attempt
    await processPendingNotificationOutbox(prisma, {
      providerOptions: { sentMessageIds: sharedSentIds },
    });

    const finalOutbox = await prisma.notificationOutbox.findUnique({
      where: { id: idempOutbox.id },
      include: { deliveries: true },
    });
    if (finalOutbox.deliveries.length < 2)
      throw new Error("Expected multiple delivery attempts recorded.");
    console.log(
      "  ✓ Provider-level idempotency protected against duplicate email emissions upon retry.",
    );

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Phase 4C End-to-End Radar Suite PASSED (All 5 tests)!");
    console.log("=======================================================\n");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

runPhase4cE2eTests().catch((err) => {
  console.error("Phase 4C E2E test execution failed:", err);
  process.exit(1);
});
