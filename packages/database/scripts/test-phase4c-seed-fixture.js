const { PrismaClient } = require("@prisma/client");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing required DATABASE_URL");
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function seedPopulatedRadar() {
  console.log(
    "Seeding realistic deterministic populated Radar state with exact delivery attempt invariants and providerIdempotencyKeys...",
  );

  // 1. Create Free and Pro users
  const userFree = await prisma.user.upsert({
    where: { email: "radar_audit_free@buildworth.io" },
    update: { tier: "FREE" },
    create: { email: "radar_audit_free@buildworth.io", tier: "FREE" },
  });

  const userPro = await prisma.user.upsert({
    where: { email: "radar_audit_pro@buildworth.io" },
    update: { tier: "PRO" },
    create: { email: "radar_audit_pro@buildworth.io", tier: "PRO" },
  });

  const proPlan = await prisma.productPlan.findUnique({ where: { code: "PRO" } });
  const proPrice = proPlan
    ? await prisma.planPrice.findFirst({ where: { planId: proPlan.id, billingInterval: "MONTHLY" } })
    : null;

  if (proPlan && proPrice) {
    const cust = await prisma.billingCustomer.upsert({
      where: { userId: userPro.id },
      update: {},
      create: {
        userId: userPro.id,
        stripeCustomerId: `cus_radar_pro_${Date.now()}`,
        billingEmail: userPro.email,
      },
    });

    const sub = await prisma.billingSubscription.upsert({
      where: { stripeSubscriptionId: `sub_radar_pro_${userPro.id}` },
      update: { status: "ACTIVE" },
      create: {
        userId: userPro.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_radar_pro_${userPro.id}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    const entitlementsToGrant = [
      { type: "OPPORTUNITY_RADAR_ALERTS", unlimited: true },
      { type: "OPPORTUNITY_RADAR_WATCHLIST", unlimited: true },
      { type: "VENTURE_BLUEPRINT_EXPORT", unlimited: false, limit: 50, remaining: 50 },
      { type: "VENTURE_BLUEPRINT_FINANCIALS", unlimited: true },
      { type: "EVIDENCE_LINEAGE_UNRESTRICTED", unlimited: true },
      { type: "FOUNDER_FIT_FULL_BREAKDOWN", unlimited: true },
      { type: "OPPORTUNITY_COMPARISON", unlimited: true },
      { type: "EARLY_OPPORTUNITY_ACCESS", unlimited: true },
      { type: "CUSTOM_SOURCE_INDEXING", unlimited: true },
    ];

    for (const item of entitlementsToGrant) {
      await prisma.entitlementGrant.upsert({
        where: {
          userId_entitlementType_source: {
            userId: userPro.id,
            entitlementType: item.type,
            source: "SUBSCRIPTION",
          },
        },
        update: {
          isUnlimited: item.unlimited,
          limitQuantity: item.limit ?? null,
          remainingUnits: item.remaining ?? null,
        },
        create: {
          userId: userPro.id,
          subscriptionId: sub.id,
          entitlementType: item.type,
          source: "SUBSCRIPTION",
          isUnlimited: item.unlimited,
          limitQuantity: item.limit ?? null,
          remainingUnits: item.remaining ?? null,
        },
      });
    }
  }

  // 2. Create Opportunity with 3 consecutive revisions
  const opp = await prisma.opportunity.upsert({
    where: { slug: "radar-audit-opportunity" },
    update: {},
    create: {
      slug: "radar-audit-opportunity",
      title: "Radar Audit Opportunity",
      status: "PUBLISHED",
      oneSentenceSummary: "Deterministic opportunity for strict Radar audit",
      problemStatement: "Validating Radar engine audit pipeline",
      jobsToBeDone: ["Job 1", "Job 2"],
      proposedProduct: "Radar Audit Tool",
      narrowMvpScope: ["Scope 1"],
      targetCustomerSegments: ["B2B SaaS"],
      economicBuyer: "VP Engineering",
      endUser: "DevOps Engineer",
      buyingTrigger: "Audit coming up",
      existingWorkflow: "Manual spreadsheets",
      painSeverity: "CRITICAL",
      painFrequency: "MONTHLY",
      customerType: "B2B",
      industry: "DevOps & Security",
      publicationQualityStatus: "HYPOTHESIS",
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

  // Clean prior radar state for deterministic count
  await prisma.opportunityChangeEvent.deleteMany({ where: { opportunityId: opp.id } });
  await prisma.savedOpportunity.deleteMany({ where: { opportunityId: opp.id } });
  await prisma.opportunityRevision.deleteMany({ where: { opportunityId: opp.id } });

  const rev1 = await prisma.opportunityRevision.create({
    data: {
      opportunityId: opp.id,
      revisionNumber: 1,
      snapshotData: { status: "HYPOTHESIS", confidence: 60, price: 1900 },
      reasonForChange: "Initial revision",
    },
  });

  const rev2 = await prisma.opportunityRevision.create({
    data: {
      opportunityId: opp.id,
      revisionNumber: 2,
      snapshotData: { status: "VERIFIED", confidence: 75, price: 1900 },
      reasonForChange: "Evidence verification upgrade",
    },
  });

  const rev3 = await prisma.opportunityRevision.create({
    data: {
      opportunityId: opp.id,
      revisionNumber: 3,
      snapshotData: { status: "VERIFIED", confidence: 75, price: 2900 },
      reasonForChange: "Pricing revision",
    },
  });

  // 3. Create 2 OpportunityRadarJobs
  await prisma.opportunityRadarJob.upsert({
    where: { opportunityRevisionId: rev1.id },
    update: { status: "COMPLETED" },
    create: { opportunityRevisionId: rev1.id, status: "COMPLETED", completedAt: new Date() },
  });

  await prisma.opportunityRadarJob.upsert({
    where: { opportunityRevisionId: rev2.id },
    update: { status: "COMPLETED" },
    create: { opportunityRevisionId: rev2.id, status: "COMPLETED", completedAt: new Date() },
  });

  // 4. Create 2 global OpportunityChangeEvents with 3 change items total
  const changeEvent1 = await prisma.opportunityChangeEvent.create({
    data: {
      opportunityId: opp.id,
      fromRevisionId: rev1.id,
      toRevisionId: rev2.id,
      canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      overallSeverity: "HIGH",
      items: {
        create: [
          {
            dimension: "PUBLICATION_STATUS",
            direction: "POSITIVE",
            severity: "HIGH",
            reasonCode: "STATUS_VERIFIED",
            sanitizedSummary: "Status upgraded from HYPOTHESIS to VERIFIED",
            beforeValue: "HYPOTHESIS",
            afterValue: "VERIFIED",
          },
          {
            dimension: "EVIDENCE_CONFIDENCE",
            direction: "POSITIVE",
            severity: "HIGH",
            reasonCode: "CONFIDENCE_INCREASED",
            sanitizedSummary: "Evidence confidence increased by 15 points",
            beforeValue: 60,
            afterValue: 75,
            numericDelta: 15,
          },
        ],
      },
    },
  });

  const changeEvent2 = await prisma.opportunityChangeEvent.create({
    data: {
      opportunityId: opp.id,
      fromRevisionId: rev2.id,
      toRevisionId: rev3.id,
      canonicalInputHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      overallSeverity: "MEDIUM",
      items: {
        create: [
          {
            dimension: "PRICING",
            direction: "POSITIVE",
            severity: "MEDIUM",
            reasonCode: "PRICE_INCREASED",
            sanitizedSummary: "Monthly pricing revised to $29",
            beforeValue: 1900,
            afterValue: 2900,
            numericDelta: 1000,
          },
        ],
      },
    },
  });

  // 5. Create 2 SavedOpportunity watches
  const watchFree = await prisma.savedOpportunity.create({
    data: {
      userId: userFree.id,
      opportunityId: opp.id,
      radarEnabled: true,
      alertCadence: "WEEKLY_DIGEST",
      minimumSeverity: "MEDIUM",
      lastEvaluatedRevisionId: rev3.id,
    },
  });

  const watchPro = await prisma.savedOpportunity.create({
    data: {
      userId: userPro.id,
      opportunityId: opp.id,
      radarEnabled: true,
      alertCadence: "INSTANT",
      minimumSeverity: "LOW",
      lastEvaluatedRevisionId: rev3.id,
    },
  });

  // 6. Create 2 RadarEvaluations
  const evalFree = await prisma.radarEvaluation.create({
    data: {
      watchId: watchFree.id,
      changeEventId: changeEvent1.id,
      matched: true,
      canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      reasonCodes: ["STATUS_VERIFIED"],
    },
  });

  const evalPro = await prisma.radarEvaluation.create({
    data: {
      watchId: watchPro.id,
      changeEventId: changeEvent2.id,
      matched: true,
      canonicalInputHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      reasonCodes: ["PRICE_INCREASED"],
    },
  });

  // 7. Notification Outbox Rows with Deterministic Provider Idempotency Keys:
  // a) 1 SENT outbox with 1 successful delivery (attemptCount: 1)
  const crypto = require("crypto");
  const outboxSent = await prisma.notificationOutbox.create({
    data: {
      userId: userPro.id,
      opportunityId: opp.id,
      changeEventId: changeEvent2.id,
      radarEvaluationId: evalPro.id,
      notificationType: "RADAR_CHANGE_ALERT",
      channel: "EMAIL",
      status: "SENT",
      sentAt: new Date(),
      attemptCount: 1,
      deduplicationKey: `radar_audit_sent_${Date.now()}`,
      sanitizedPayload: { title: "Instant Alert" },
    },
  });
  const keySent = `idemp_${crypto.createHash("sha256").update(`${outboxSent.id}:${outboxSent.deduplicationKey}`).digest("hex").slice(0, 24)}`;
  await prisma.notificationDelivery.create({
    data: {
      outboxId: outboxSent.id,
      attemptNumber: 1,
      provider: "TEST_MOCK",
      providerIdempotencyKey: keySent,
      providerMessageId: keySent,
      status: "SUCCESS",
      attemptedAt: new Date(),
      deliveredAt: new Date(),
    },
  });

  // b) 1 Retryable PENDING outbox with 1 failed attempt (attemptCount: 1)
  const outboxPending = await prisma.notificationOutbox.create({
    data: {
      userId: userFree.id,
      opportunityId: opp.id,
      changeEventId: changeEvent1.id,
      radarEvaluationId: evalFree.id,
      notificationType: "RADAR_WEEKLY_DIGEST",
      channel: "EMAIL",
      status: "PENDING",
      attemptCount: 1,
      nextAttemptAt: new Date(Date.now() + 60 * 1000),
      deduplicationKey: `radar_audit_retryable_${Date.now()}`,
      sanitizedPayload: { title: "Weekly Digest Retry" },
    },
  });
  const keyPending = `idemp_${crypto.createHash("sha256").update(`${outboxPending.id}:${outboxPending.deduplicationKey}`).digest("hex").slice(0, 24)}`;
  await prisma.notificationDelivery.create({
    data: {
      outboxId: outboxPending.id,
      attemptNumber: 1,
      provider: "TEST_MOCK",
      providerIdempotencyKey: keyPending,
      status: "FAILED",
      attemptedAt: new Date(),
      sanitizedError: "Transient timeout",
    },
  });

  // c) 1 DEAD_LETTER outbox with exactly 5 failed deliveries (attemptCount: 5)
  const outboxDead = await prisma.notificationOutbox.create({
    data: {
      userId: userPro.id,
      opportunityId: opp.id,
      changeEventId: changeEvent2.id,
      radarEvaluationId: evalPro.id,
      notificationType: "RADAR_DAILY_DIGEST",
      channel: "EMAIL",
      status: "DEAD_LETTER",
      attemptCount: 5,
      sanitizedLastError: "DEAD_LETTER_EXHAUSTED_ATTEMPTS: Permanent delivery failure",
      deduplicationKey: `radar_audit_deadletter_${Date.now()}`,
      sanitizedPayload: { title: "Daily Digest DeadLetter" },
    },
  });
  const keyDead = `idemp_${crypto.createHash("sha256").update(`${outboxDead.id}:${outboxDead.deduplicationKey}`).digest("hex").slice(0, 24)}`;
  for (let i = 1; i <= 5; i++) {
    await prisma.notificationDelivery.create({
      data: {
        outboxId: outboxDead.id,
        attemptNumber: i,
        provider: "TEST_MOCK",
        providerIdempotencyKey: keyDead,
        status: "FAILED",
        attemptedAt: new Date(Date.now() - (6 - i) * 60000),
        sanitizedError: `Attempt ${i} failed`,
      },
    });
  }

  // d) 1 CANCELLED-before-send outbox with 0 deliveries (attemptCount: 0)
  await prisma.notificationOutbox.create({
    data: {
      userId: userFree.id,
      opportunityId: opp.id,
      changeEventId: changeEvent1.id,
      radarEvaluationId: evalFree.id,
      notificationType: "RADAR_WEEKLY_DIGEST",
      channel: "EMAIL",
      status: "CANCELLED",
      attemptCount: 0,
      sanitizedLastError: "OPPORTUNITY_MUTED_BY_USER",
      deduplicationKey: `radar_audit_cancelled_${Date.now()}`,
      sanitizedPayload: { title: "Cancelled Outbox" },
    },
  });

  console.log(
    "✓ Seeded realistic populated Radar audit fixture successfully (4 outbox rows, 7 delivery attempts with valid providerIdempotencyKeys).",
  );
}

seedPopulatedRadar()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
