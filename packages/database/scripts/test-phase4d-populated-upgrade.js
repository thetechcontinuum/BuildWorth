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
  console.log("=== BuildWorth Phase 4D Populated Upgrade Rehearsal (3-State Audit) ===");

  const dbName = "test_phase4d_upgrade_rehearsal_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy Phase 1 - 4C migrations ONLY
    const migrationDirs = [
      "20260825000000_phase2_decision_grade_blueprint",
      "20260825120000_phase3_founder_fit_personalization",
      "20260825150000_phase3_auth_and_fit_hardening",
      "20260825200000_phase4a_billing_entitlements_foundation",
      "20260825220000_phase4b_stripe_checkout_and_webhook_hardening",
      "20260826000000_phase4c_opportunity_radar",
    ];

    for (const dir of migrationDirs) {
      const sqlPath = path.resolve(__dirname, `../prisma/migrations/${dir}/migration.sql`);
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d ${dbName} -f - < "${sqlPath}"`,
        { stdio: "pipe" },
      );
    }

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Seed realistic Phase 1–4C populated baseline across all core models
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

    const rawSignal = await prisma.rawSignal.create({
      data: {
        sourceId: source.id,
        externalId: `ext_${Date.now()}`,
        sourceUrl: "https://example.com/signal",
        rawContent: "Raw signal content",
        contentHash: "hash_raw_signal_1234567890",
      },
    });

    const normSignal = await prisma.normalizedSignal.create({
      data: {
        rawSignal: { connect: { id: rawSignal.id } },
        problemSummary: "Problem summary",
        sanitizedExcerpt: "Sanitized excerpt",
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

    const evLink = await prisma.evidenceLink.create({
      data: {
        opportunityId: opp.id,
        normalizedSignalId: normSignal.id,
        claimSnippet: "Evidence claim snippet",
      },
    });

    const canonicalEvidenceHashA = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
    const rev = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 1,
        reasonForChange: "Baseline revision",
        snapshotData: { title: opp.title, slug: opp.slug },
      },
    });

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { currentRevisionId: rev.id },
    });

    const blueprint = await prisma.opportunityBlueprint.create({
      data: {
        opportunityRevisionId: rev.id,
        first20Plan: { steps: [] },
        inputHash: canonicalEvidenceHashA,
      },
    });

    const profile = await prisma.founderProfile.create({
      data: {
        userId: user.id,
      },
    });

    const profileRev = await prisma.founderProfileRevision.create({
      data: {
        profileId: profile.id,
        revisionNumber: 1,
        inputHash: "input_hash_123",
      },
    });

    await prisma.founderProfile.update({
      where: { id: profile.id },
      data: { currentProfileRevisionId: profileRev.id },
    });

    const reqs = await prisma.opportunityFounderRequirements.create({
      data: {
        blueprintId: blueprint.id,
      },
    });

    const founderFitHashA = "fit_hash_1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const fit = await prisma.founderFitEvaluation.create({
      data: {
        userId: user.id,
        profileRevisionId: profileRev.id,
        opportunityRevisionId: rev.id,
        blueprintId: blueprint.id,
        requirementsId: reqs.id,
        founderFitScore: 88,
        fitConfidence: 85,
        recommendationCategory: "EXCELLENT_MATCH",
        personalizedRank: 86.9,
        baseRank: 86.9,
        calculatedAt: new Date(),
        rubricVersion: "1.0.0",
        rankingVersion: "1.0.0",
        taxonomyVersion: "1.0.0",
        inputHash: founderFitHashA,
      },
    });

    // Phase 4A & 4B billing entities
    const plan = await prisma.productPlan.create({
      data: { code: "PRO", name: "Pro Plan" },
    });
    const price = await prisma.planPrice.create({
      data: { planId: plan.id, billingInterval: "MONTHLY", amountCents: 1900, currency: "USD", stripePriceId: "price_mock" },
    });
    const customer = await prisma.billingCustomer.create({
      data: { userId: user.id, stripeCustomerId: "cus_mock", billingEmail: user.email },
    });
    const subscription = await prisma.billingSubscription.create({
      data: {
        userId: user.id,
        billingCustomerId: customer.id,
        planPriceId: price.id,
        stripeSubscriptionId: "sub_mock",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });
    const checkoutAttempt = await prisma.billingCheckoutAttempt.create({
      data: {
        userId: user.id,
        requestId: "req_mock_1",
        selectedPlanCode: "PRO",
        billingInterval: "MONTHLY",
        planPriceId: price.id,
        stripePriceId: "price_mock",
        idempotencyKey: "idemp_mock_1",
        status: "COMPLETED",
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });
    const webhookEvent = await prisma.billingWebhookEvent.create({
      data: {
        eventId: "evt_stripe_mock",
        eventType: "customer.subscription.created",
        payload: { id: "evt_stripe_mock" },
      },
    });
    const entitlementGrant = await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        source: "SUBSCRIPTION",
        isUnlimited: false,
        limitQuantity: 50,
        remainingUnits: 50,
      },
    });
    const usageLedger = await prisma.usageLedger.create({
      data: {
        userId: user.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: 1,
        resourceId: opp.slug,
        actionContext: "BASELINE_USAGE",
        idempotencyKey: "idemp_ledger_base",
        periodBucketKey: "2026-08",
      },
    });

    // Phase 4C radar & notification entities
    const savedWatch = await prisma.savedOpportunity.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        radarEnabled: true,
        alertCadence: "WEEKLY_DIGEST",
      },
    });

    const radarJob = await prisma.opportunityRadarJob.create({
      data: {
        opportunityRevisionId: rev.id,
        status: "COMPLETED",
      },
    });

    const changeEvent = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev.id,
        toRevisionId: rev.id,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    const outbox = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        notificationType: "RADAR_CHANGE_ALERT",
        deduplicationKey: `dedup_${Date.now()}`,
        status: "SENT",
        sanitizedPayload: { summary: "Baseline notification" },
        sentAt: new Date(),
      },
    });

    const delivery = await prisma.notificationDelivery.create({
      data: {
        outboxId: outbox.id,
        attemptNumber: 1,
        provider: "TEST_MOCK",
        providerIdempotencyKey: `idemp_${outbox.id}`,
        status: "SUCCESS",
        deliveredAt: new Date(),
      },
    });

    const unsubToken = await prisma.notificationUnsubscribeToken.create({
      data: {
        userId: user.id,
        tokenHash: "token_hash_baseline",
        purpose: "BUILDWORTH_RADAR_UNSUBSCRIBE_V1",
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    // --- STATE A: Baseline Snapshot ---
    console.log("\n--- STATE A: Before Applying Phase 4D Migration (Phase 1–4C Populated) ---");
    const countsA = {
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
      saved_opportunities: await prisma.savedOpportunity.count(),
      opportunity_radar_jobs: await prisma.opportunityRadarJob.count(),
      opportunity_change_events: await prisma.opportunityChangeEvent.count(),
      notification_outbox: await prisma.notificationOutbox.count(),
      notification_deliveries: await prisma.notificationDelivery.count(),
      notification_unsubscribe_tokens: await prisma.notificationUnsubscribeToken.count(),
      billing_customers: await prisma.billingCustomer.count(),
      billing_subscriptions: await prisma.billingSubscription.count(),
      billing_checkout_attempts: await prisma.billingCheckoutAttempt.count(),
      billing_webhook_events: await prisma.billingWebhookEvent.count(),
      entitlement_grants: await prisma.entitlementGrant.count(),
      usage_ledgers: await prisma.usageLedger.count(),
    };
    console.table(countsA);

    console.log(`Canonical Evidence Hash (State A) : ${canonicalEvidenceHashA}`);
    console.log(`Founder Fit Hash (State A)        : ${founderFitHashA}`);

    // --- Apply Phase 4D Migration ---
    const phase4dSql = path.resolve(
      __dirname,
      `../prisma/migrations/20260827000000_phase4d_premium_content_and_exports/migration.sql`,
    );
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d ${dbName} -f - < "${phase4dSql}"`,
      { stdio: "pipe" },
    );

    // --- STATE B: Immediately Post-Migration (Zero Data Loss, Zero Fabricated Phase 4D rows) ---
    console.log("\n--- STATE B: Immediately After Applying Phase 4D Migration (Before Any Phase 4D Seed) ---");
    const countsB = {
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
      saved_opportunities: await prisma.savedOpportunity.count(),
      opportunity_radar_jobs: await prisma.opportunityRadarJob.count(),
      opportunity_change_events: await prisma.opportunityChangeEvent.count(),
      notification_outbox: await prisma.notificationOutbox.count(),
      notification_deliveries: await prisma.notificationDelivery.count(),
      notification_unsubscribe_tokens: await prisma.notificationUnsubscribeToken.count(),
      billing_customers: await prisma.billingCustomer.count(),
      billing_subscriptions: await prisma.billingSubscription.count(),
      billing_checkout_attempts: await prisma.billingCheckoutAttempt.count(),
      billing_webhook_events: await prisma.billingWebhookEvent.count(),
      entitlement_grants: await prisma.entitlementGrant.count(),
      usage_ledgers: await prisma.usageLedger.count(),
      opportunity_exports: await prisma.opportunityExport.count(),
      commercial_events: await prisma.commercialEvent.count(),
      analytics_consent_histories: await prisma.analyticsConsentHistory.count(),
    };
    console.table(countsB);

    // Verify Hashes Unchanged
    const bpB = await prisma.opportunityBlueprint.findUnique({ where: { id: blueprint.id } });
    const fitB = await prisma.founderFitEvaluation.findUnique({ where: { id: fit.id } });
    console.log(`Canonical Evidence Hash (State B) : ${bpB.inputHash}`);
    console.log(`Founder Fit Hash (State B)        : ${fitB.inputHash}`);

    if (bpB.inputHash !== canonicalEvidenceHashA || fitB.inputHash !== founderFitHashA) {
      throw new Error("Canonical hashes mutated during Phase 4D migration!");
    }

    // Assert Phase 1–4C unchanged
    for (const [k, v] of Object.entries(countsA)) {
      if (countsB[k] !== v) {
        throw new Error(`Data loss or distortion in table ${k}: expected ${v}, got ${countsB[k]}`);
      }
    }

    // Assert Phase 4D tables have exactly 0 rows
    if (countsB.opportunity_exports !== 0 || countsB.commercial_events !== 0 || countsB.analytics_consent_histories !== 0) {
      throw new Error(`Fabricated records in Phase 4D tables: exports=${countsB.opportunity_exports}, commercial_events=${countsB.commercial_events}, consent_histories=${countsB.analytics_consent_histories}`);
    }

    // --- STATE C: Deliberately Seed Phase 4D Fixture in all 3 Phase 4D Tables ---
    console.log("\n--- STATE C: After Deliberately Seeding Phase 4D Fixtures in All 3 Phase 4D Tables ---");
    const quotaPeriodKey = "2026-08";
    const ledger = await prisma.usageLedger.create({
      data: {
        userId: user.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: 1,
        resourceId: opp.slug,
        actionContext: "EXPORT_PDF",
        idempotencyKey: `reserve_${user.id}_upgrade_state_c`,
        periodBucketKey: quotaPeriodKey,
      },
    });

    const exportC = await prisma.opportunityExport.create({
      data: {
        requestKey: `upgrade_state_c_${user.id}`,
        userId: user.id,
        opportunityId: opp.id,
        opportunityRevisionId: rev.id,
        format: "PDF",
        status: "COMPLETED",
        completedAt: new Date(),
        byteSize: 1024,
        contentHash: "hash_pdf_test",
        policyVersion: "1.0.0",
        quotaPeriodKey,
        reservationLedgerId: ledger.id,
        consumptionLedgerId: ledger.id,
        entitlementSnapshot: { tier: "PRO" },
      },
    });

    const consentC = await prisma.analyticsConsentHistory.create({
      data: {
        userId: user.id,
        purpose: "PRODUCT_CONVERSION_ANALYTICS",
        status: "GRANTED",
        policyVersion: "1.0.0",
        source: "UPGRADE_STATE_C_BANNER",
        grantedAt: new Date(),
      },
    });

    const eventC = await prisma.commercialEvent.create({
      data: {
        eventType: "EXPORT_COMPLETED",
        deduplicationKey: `exp_comp_state_c_${exportC.id}`,
        userId: user.id,
        opportunityId: opp.id,
        exportId: exportC.id,
        source: "EXPORT_SERVICE",
        purposeCode: "SERVICE_DELIVERY_AND_SECURITY",
        lawfulBasis: "CONTRACT",
        metadata: { format: "PDF", byteSize: 1024 },
        retentionClass: "SECURITY_DIAGNOSTIC",
        retentionExpiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    const countsC = {
      opportunity_exports: await prisma.opportunityExport.count(),
      commercial_events: await prisma.commercialEvent.count(),
      analytics_consent_histories: await prisma.analyticsConsentHistory.count(),
    };
    console.table(countsC);

    if (countsC.opportunity_exports !== 1 || countsC.commercial_events !== 1 || countsC.analytics_consent_histories !== 1) {
      throw new Error("Failed to populate all 3 Phase 4D tables in State C!");
    }

    console.log("\n=======================================================");
    console.log("3-State Populated Upgrade Rehearsal PASSED (100%)!");
    console.log("=======================================================\n");
  } finally {
    try {
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
        { stdio: "pipe" },
      );
    } catch {}
  }
}

if (require.main === module) {
  runThreeStatePopulatedUpgrade().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runThreeStatePopulatedUpgrade };
