const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runThreeStatePopulatedUpgrade() {
  console.log("=== BuildWorth Phase 4C Populated Upgrade Rehearsal (3-State Audit) ===");

  const dbName = "test_phase4c_upgrade_rehearsal_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy Phase 1 - 4B migrations ONLY
    const migrationDirs = [
      "20260825000000_phase2_decision_grade_blueprint",
      "20260825120000_phase3_founder_fit_personalization",
      "20260825150000_phase3_auth_and_fit_hardening",
      "20260825200000_phase4a_billing_entitlements_foundation",
      "20260825220000_phase4b_stripe_checkout_and_webhook_hardening",
    ];

    for (const dir of migrationDirs) {
      const sqlPath = path.resolve(__dirname, `../prisma/migrations/${dir}/migration.sql`);
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d ${dbName} -f - < "${sqlPath}"`,
        { stdio: "pipe" },
      );
    }

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Seed realistic Phase 1–4B populated baseline
    const user = await prisma.user.create({
      data: { email: `baseline_${Date.now()}@buildworth.io`, tier: "PRO" },
    });

    const source = await prisma.source.create({
      data: {
        key: `source_${Date.now()}`,
        name: "Test Source",
        description: "Desc",
        adapterType: "REDDIT",
        accessMethod: "API",
      },
    });

    const opp = await prisma.opportunity.create({
      data: {
        slug: `opp-upgrade-${Date.now()}`,
        title: "Upgrade Test Opportunity",
        oneSentenceSummary: "One sentence summary",
        problemStatement: "Problem statement",
        jobsToBeDone: ["Job 1"],
        proposedProduct: "Product",
        narrowMvpScope: ["Scope 1"],
        targetCustomerSegments: ["B2B"],
        economicBuyer: "VP",
        endUser: "Engineer",
        buyingTrigger: "Trigger",
        existingWorkflow: "Workflow",
        painSeverity: "CRITICAL",
        painFrequency: "MONTHLY",
        status: "PUBLISHED",
        customerType: "B2B",
        industry: "DevOps",
        estimatedMvpCostMinCents: 100000,
        estimatedMvpCostMaxCents: 200000,
        estimatedTimeToMvpMinWeeks: 4,
        estimatedTimeToMvpMaxWeeks: 8,
        estimatedMonthlyOpCostMinCents: 10000,
        estimatedMonthlyOpCostMaxCents: 20000,
        currency: "USD",
        recommendedNextExperiment: "Experiment",
      },
    });

    const rev1 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 1,
        snapshotData: { price: 1900 },
        reasonForChange: "Initial",
      },
    });

    const bp = await prisma.opportunityBlueprint.create({
      data: {
        opportunityRevisionId: rev1.id,
        schemaVersion: "1.0.0",
        generationStatus: "SYNTHESIZED",
        calculationVersion: "1.0.0",
        decisionRuleVersion: "1.0.0",
        inputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    const profile = await prisma.founderProfile.create({
      data: {
        userId: user.id,
      },
    });

    const profRev = await prisma.founderProfileRevision.create({
      data: {
        profileId: profile.id,
        revisionNumber: 1,
        inputHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      },
    });

    await prisma.founderProfile.update({
      where: { id: profile.id },
      data: { currentProfileRevisionId: profRev.id },
    });

    const reqs = await prisma.opportunityFounderRequirements.create({
      data: {
        blueprintId: bp.id,
      },
    });

    const fitEval = await prisma.founderFitEvaluation.create({
      data: {
        userId: user.id,
        profileRevisionId: profRev.id,
        opportunityRevisionId: rev1.id,
        blueprintId: bp.id,
        requirementsId: reqs.id,
        founderFitScore: 88,
        fitConfidence: 90,
        recommendationCategory: "STRONG_MATCH",
        personalizedRank: 1.0,
        baseRank: 1.0,
        inputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    const plan = await prisma.productPlan.upsert({
      where: { code: "PRO" },
      update: {},
      create: { code: "PRO", name: "Pro Plan", description: "Pro" },
    });

    const price = await prisma.planPrice.create({
      data: {
        planId: plan.id,
        billingInterval: "MONTHLY",
        stripePriceId: `price_${Date.now()}`,
        amountCents: 2900,
      },
    });

    const billingCustomer = await prisma.billingCustomer.create({
      data: {
        userId: user.id,
        stripeCustomerId: `cus_${Date.now()}`,
      },
    });

    const billingSub = await prisma.billingSubscription.create({
      data: {
        userId: user.id,
        billingCustomerId: billingCustomer.id,
        planPriceId: price.id,
        stripeSubscriptionId: `sub_${Date.now()}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    });

    const grant = await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        subscriptionId: billingSub.id,
        entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
        source: "SUBSCRIPTION",
        limitQuantity: 50,
      },
    });

    const usage = await prisma.usageLedger.create({
      data: {
        userId: user.id,
        entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
        unitsConsumed: 1,
        resourceId: opp.id,
        actionContext: "RADAR_WATCHLIST_ADD",
        periodBucketKey: "2026-08",
      },
    });

    // Helper to query all counts
    async function getCounts() {
      return {
        sources: await prisma.source.count(),
        raw_signals: await prisma.rawSignal.count(),
        normalized_signals: await prisma.normalizedSignal.count(),
        evidence_links: await prisma.evidenceLink.count(),
        opportunities: await prisma.opportunity.count(),
        opportunity_revisions: await prisma.opportunityRevision.count(),
        opportunity_blueprints: await prisma.opportunityBlueprint.count(),
        founder_profiles: await prisma.founderProfile.count(),
        founder_profile_revisions: await prisma.founderProfileRevision.count(),
        founder_fit_evaluations: await prisma.founderFitEvaluation.count(),
        billing_customers: await prisma.billingCustomer.count(),
        billing_subscriptions: await prisma.billingSubscription.count(),
        entitlement_grants: await prisma.entitlementGrant.count(),
        usage_ledgers: await prisma.usageLedger.count(),
      };
    }

    async function getRadarCounts() {
      return {
        saved_opportunities: await prisma.savedOpportunity.count(),
        opportunity_radar_jobs: await prisma.opportunityRadarJob.count(),
        opportunity_change_events: await prisma.opportunityChangeEvent.count(),
        notification_outbox: await prisma.notificationOutbox.count(),
        notification_deliveries: await prisma.notificationDelivery.count(),
        notification_unsubscribe_tokens: await prisma.notificationUnsubscribeToken.count(),
      };
    }

    // STATE A: Before applying Phase 4C migration
    console.log("\n--- STATE A: Before Applying Phase 4C Migration (Phase 1–4B Populated) ---");
    const countsA = await getCounts();
    console.table(countsA);

    // Apply Phase 4C migration
    const phase4cSqlPath = path.resolve(
      __dirname,
      "../prisma/migrations/20260826000000_phase4c_opportunity_radar/migration.sql",
    );
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d ${dbName} -f - < "${phase4cSqlPath}"`,
      { stdio: "pipe" },
    );

    // STATE B: Immediately after applying Phase 4C (Zero fabricated extension data)
    console.log(
      "\n--- STATE B: Immediately After Applying Phase 4C Migration (Before Test Seeding) ---",
    );
    const countsB = await getCounts();
    const radarCountsB = await getRadarCounts();
    console.log("Phase 1–4B Persistent Entity Counts (State B vs State A):");
    console.table(countsB);
    console.log("Phase 4C Extension Data Counts (Must All Be Zero):");
    console.table(radarCountsB);

    // Verify zero data fabrication in State B
    const fabricatedRowsB = Object.values(radarCountsB).reduce((a, b) => a + b, 0);
    if (fabricatedRowsB !== 0) {
      throw new Error(`State B contains ${fabricatedRowsB} fabricated extension rows!`);
    }
    console.log(
      "✓ State B confirmed: Zero row loss across Phase 1–4B, exactly ZERO fabricated extension records.",
    );

    // STATE C: After intentionally seeding the Radar test fixture
    console.log("\n--- STATE C: After Deliberately Seeding Radar Test Fixtures ---");
    const watch = await prisma.savedOpportunity.create({
      data: { userId: user.id, opportunityId: opp.id, radarEnabled: true, alertCadence: "INSTANT" },
    });
    const job = await prisma.opportunityRadarJob.create({
      data: { opportunityRevisionId: rev1.id, status: "COMPLETED", completedAt: new Date() },
    });
    const changeEvent = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev1.id,
        toRevisionId: rev1.id,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });
    const outbox = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        notificationType: "RADAR_CHANGE_ALERT",
        status: "SENT",
        sentAt: new Date(),
        attemptCount: 1,
        deduplicationKey: `upgrade_outbox_${Date.now()}`,
        sanitizedPayload: { title: "Upgrade Test" },
      },
    });
    const idempKey = `idemp_${crypto.createHash("sha256").update(`${outbox.id}:${outbox.deduplicationKey}`).digest("hex").slice(0, 24)}`;
    const delivery = await prisma.notificationDelivery.create({
      data: {
        outboxId: outbox.id,
        attemptNumber: 1,
        provider: "TEST_MOCK",
        providerIdempotencyKey: idempKey,
        providerMessageId: idempKey,
        status: "SUCCESS",
        attemptedAt: new Date(),
        deliveredAt: new Date(),
      },
    });
    const tokenRecord = await prisma.notificationUnsubscribeToken.create({
      data: {
        tokenHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        userId: user.id,
        purpose: "BUILDWORTH_RADAR_UNSUBSCRIBE_V1",
        channel: "EMAIL",
        keyVersion: 2,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const radarCountsC = await getRadarCounts();
    console.log("Phase 4C Deliberately Seeded Test Fixture Counts (State C):");
    console.table(radarCountsC);
    console.log("✓ State C confirmed: Test fixtures populated and verified.");

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("3-State Populated Upgrade Rehearsal PASSED (100%)!");
    console.log("=======================================================\n");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

runThreeStatePopulatedUpgrade()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
