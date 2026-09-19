const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  recordUserAnalyticsConsent,
  generateSignedAnonymousConsentToken,
  withdrawSignedAnonymousConsentToken,
  recordCommercialEvent,
  reconcileCommercialEventRetention,
} = require("../../billing/dist/index.js");
const {
  buildCanonicalFounderFitPayload,
  computeCanonicalInputHash,
} = require("../../scoring/dist/index.js");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing required DATABASE_URL");
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function seedPhase4dFixture() {
  console.log("Seeding Phase 4D comprehensive, non-vacuous premium access, commercial events & GDPR audit state...");

  process.env.COMMERCIAL_ANALYTICS_RETENTION_DAYS = "90";
  process.env.COMMERCIAL_TRANSACTION_RETENTION_DAYS = "730";
  process.env.COMMERCIAL_SECURITY_RETENTION_DAYS = "30";

  // 1. Create Free and Pro users
  const userFree = await prisma.user.upsert({
    where: { email: "premium_audit_free@buildworth.io" },
    update: { tier: "FREE" },
    create: { email: "premium_audit_free@buildworth.io", tier: "FREE" },
  });

  const userPro = await prisma.user.upsert({
    where: { email: "premium_audit_pro@buildworth.io" },
    update: { tier: "PRO" },
    create: { email: "premium_audit_pro@buildworth.io", tier: "PRO" },
  });

  // 2. Set up Pro Subscription & Entitlement Grants
  const proPlan = await prisma.productPlan.findUnique({ where: { code: "PRO" } });
  const proPrice = proPlan
    ? await prisma.planPrice.findFirst({ where: { planId: proPlan.id, billingInterval: "MONTHLY" } })
    : null;

  let sub = null;
  if (proPlan && proPrice) {
    const cust = await prisma.billingCustomer.upsert({
      where: { userId: userPro.id },
      update: {},
      create: {
        userId: userPro.id,
        stripeCustomerId: `cus_audit_pro_${Date.now()}`,
        billingEmail: userPro.email,
      },
    });

    sub = await prisma.billingSubscription.upsert({
      where: { stripeSubscriptionId: `sub_audit_pro_${userPro.id}` },
      update: { status: "ACTIVE" },
      create: {
        userId: userPro.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_audit_pro_${userPro.id}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    await prisma.entitlementGrant.upsert({
      where: {
        userId_entitlementType_source: {
          userId: userPro.id,
          entitlementType: "VENTURE_BLUEPRINT_EXPORT",
          source: "SUBSCRIPTION",
        },
      },
      update: { isUnlimited: false, limitQuantity: 50, remainingUnits: 47 },
      create: {
        userId: userPro.id,
        subscriptionId: sub.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        source: "SUBSCRIPTION",
        isUnlimited: false,
        limitQuantity: 50,
        remainingUnits: 47,
      },
    });

    await prisma.entitlementGrant.upsert({
      where: {
        userId_entitlementType_source: {
          userId: userPro.id,
          entitlementType: "VENTURE_BLUEPRINT_FINANCIALS",
          source: "SUBSCRIPTION",
        },
      },
      update: { isUnlimited: true },
      create: {
        userId: userPro.id,
        subscriptionId: sub.id,
        entitlementType: "VENTURE_BLUEPRINT_FINANCIALS",
        source: "SUBSCRIPTION",
        isUnlimited: true,
      },
    });
  }

  // 3. Create Opportunity and Revision with Blueprint & Founder Fit
  const opp = await prisma.opportunity.upsert({
    where: { slug: "premium-audit-opportunity" },
    update: {},
    create: {
      slug: "premium-audit-opportunity",
      title: "Premium Audit Opportunity",
      status: "PUBLISHED",
      oneSentenceSummary: "Deterministic opportunity for strict Premium Access audit",
      problemStatement: "Validating Phase 4D access enforcement and exports",
      jobsToBeDone: ["Export PDF", "Export CSV", "Audit Paywalls"],
      proposedProduct: "Premium Audit Tool",
      narrowMvpScope: ["Scope 1"],
      targetCustomerSegments: ["B2B SaaS"],
      economicBuyer: "VP Engineering",
      endUser: "DevOps Engineer",
      buyingTrigger: "Quarterly Audit",
      existingWorkflow: "Manual spreadsheets",
      painSeverity: "CRITICAL",
      painFrequency: "MONTHLY",
      customerType: "B2B",
      industry: "DevOps & Security",
      publicationQualityStatus: "VERIFIED",
      estimatedMvpCostMinCents: 100000,
      estimatedMvpCostMaxCents: 200000,
      estimatedTimeToMvpMinWeeks: 4,
      estimatedTimeToMvpMaxWeeks: 8,
      estimatedMonthlyOpCostMinCents: 10000,
      estimatedMonthlyOpCostMaxCents: 20000,
      currency: "USD",
      recommendedNextExperiment: "Customer Interviews",
    },
  });

  const rev1 = await prisma.opportunityRevision.upsert({
    where: {
      opportunityId_revisionNumber: {
        opportunityId: opp.id,
        revisionNumber: 1,
      },
    },
    update: {},
    create: {
      opportunityId: opp.id,
      revisionNumber: 1,
      reasonForChange: "Initial revision for Phase 4D audit",
      snapshotData: { title: opp.title, slug: opp.slug },
    },
  });

  await prisma.opportunity.update({
    where: { id: opp.id },
    data: { currentRevisionId: rev1.id },
  });

  const blueprint = await prisma.opportunityBlueprint.create({
    data: {
      opportunityRevisionId: rev1.id,
      first20Plan: { steps: ["Step 1", "Step 2"] },
      inputHash: "hash_blueprint_phase4d_audit_1234567890",
    },
  });

  const profile = await prisma.founderProfile.create({
    data: { userId: userPro.id },
  });

  const profileRev = await prisma.founderProfileRevision.create({
    data: {
      profileId: profile.id,
      revisionNumber: 1,
      inputHash: "hash_profile_phase4d_audit_1234567890",
    },
  });

  await prisma.founderProfile.update({
    where: { id: profile.id },
    data: { currentProfileRevisionId: profileRev.id },
  });

  const reqs = await prisma.opportunityFounderRequirements.create({
    data: { blueprintId: blueprint.id },
  });

  // Free User Profile & Evaluation (owner-matched)
  const profileFree = await prisma.founderProfile.create({
    data: { userId: userFree.id },
  });

  const profileRevFree = await prisma.founderProfileRevision.create({
    data: {
      profileId: profileFree.id,
      revisionNumber: 1,
      inputHash: "hash_profile_free_audit_1234567890",
    },
  });

  await prisma.founderProfile.update({
    where: { id: profileFree.id },
    data: { currentProfileRevisionId: profileRevFree.id },
  });

  // Compute canonical input hashes for Free and Pro FounderFitEvaluations
  const canonicalProfileFree = {
    userId: userFree.id,
    skills: [],
    domainExpertise: [],
    distributionAssets: [],
    preferences: {
      preferredIndustries: [],
      excludedIndustries: [],
      preferredBusinessModels: [],
      targetGeographies: [],
      preferredBuyerRoles: [],
    },
    constraints: {
      mvpBudgetBand: "USD_5K_TO_20K",
      budgetCurrency: "USD",
      availableHoursPerWeekBand: "HOURS_21_TO_35",
      teamSizeBand: "SOLO_FOUNDER",
      technicalRiskTolerance: "HIGH",
      regulatoryRiskTolerance: "MEDIUM",
      salesComplexityTolerance: "MEDIUM",
      operationalBurdenTolerance: "MEDIUM",
      fundingPreference: "BOOTSTRAP_ONLY",
    },
  };

  const canonicalReqs = {
    blueprintId: reqs.blueprintId,
    schemaVersion: reqs.schemaVersion || "1.0.0",
    minimumBudgetBand: reqs.minimumBudgetBand || null,
    minimumCapacityBand: reqs.minimumCapacityBand || null,
    minimumTeamSizeBand: reqs.minimumTeamSizeBand || null,
    maxExpectedDeliveryWeeks: reqs.maxExpectedDeliveryWeeks || null,
    requiredTechnicalRiskLevel: reqs.requiredTechnicalRiskLevel || null,
    requiredRegulatoryRiskLevel: reqs.requiredRegulatoryRiskLevel || null,
    requiredSalesComplexityLevel: reqs.requiredSalesComplexityLevel || null,
    targetBuyerRoles: reqs.targetBuyerRoles || [],
    targetIndustries: reqs.targetIndustries || [],
    targetGeographies: reqs.targetGeographies || [],
    requiredSkills: [],
  };

  const freePayload = buildCanonicalFounderFitPayload(
    canonicalProfileFree,
    canonicalReqs,
    {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    },
    {
      rubricVersion: "2.0.0",
      rankingVersion: "2.0.0",
      taxonomyVersion: "1.0.0",
      profileRevisionId: profileRevFree.id,
      profileRevisionInputHash: profileRevFree.inputHash,
      opportunityRevisionId: reqs.blueprintId,
    },
  );
  const freeInputHash = computeCanonicalInputHash(freePayload);

  const freeEval = await prisma.founderFitEvaluation.create({
    data: {
      userId: userFree.id,
      profileRevisionId: profileRevFree.id,
      opportunityRevisionId: rev1.id,
      blueprintId: blueprint.id,
      requirementsId: reqs.id,
      founderFitScore: 78,
      fitConfidence: 75,
      recommendationCategory: "POSSIBLE_MATCH",
      personalizedRank: 72.0,
      baseRank: 72.0,
      rubricVersion: "2.0.0",
      rankingVersion: "2.0.0",
      taxonomyVersion: "1.0.0",
      inputHash: freeInputHash,
    },
  });

  await prisma.founderFitDimension.create({
    data: {
      evaluationId: freeEval.id,
      dimensionName: "Capability Match",
      score: 16,
      maxScore: 20,
      status: "CALCULATED",
      explanation: "Free tier profile covers basic developer stack.",
      matchedRequirements: ["TypeScript"],
      missingRequirements: ["PostgreSQL Advanced Tuning"],
    },
  });

  await prisma.founderFitBlocker.create({
    data: {
      evaluationId: freeEval.id,
      blockerCode: "CAPACITY_INSUFFICIENT",
      severity: "MODERATE",
      explanation: "Part-time capacity requires phased Milestone 1 launch.",
      sourceRequirement: "Weekly Runway",
      profileConstraint: "10-15 hrs/week",
      isRemovable: true,
      suggestedMitigation: "Focus on automated smoke tests first.",
    },
  });

  const canonicalProfilePro = {
    userId: userPro.id,
    skills: [],
    domainExpertise: [],
    distributionAssets: [],
    preferences: {
      preferredIndustries: [],
      excludedIndustries: [],
      preferredBusinessModels: [],
      targetGeographies: [],
      preferredBuyerRoles: [],
    },
    constraints: {
      mvpBudgetBand: "USD_5K_TO_20K",
      budgetCurrency: "USD",
      availableHoursPerWeekBand: "HOURS_21_TO_35",
      teamSizeBand: "SOLO_FOUNDER",
      technicalRiskTolerance: "HIGH",
      regulatoryRiskTolerance: "MEDIUM",
      salesComplexityTolerance: "MEDIUM",
      operationalBurdenTolerance: "MEDIUM",
      fundingPreference: "BOOTSTRAP_ONLY",
    },
  };

  const proPayload = buildCanonicalFounderFitPayload(
    canonicalProfilePro,
    canonicalReqs,
    {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    },
    {
      rubricVersion: "2.0.0",
      rankingVersion: "2.0.0",
      taxonomyVersion: "1.0.0",
      profileRevisionId: profileRev.id,
      profileRevisionInputHash: profileRev.inputHash,
      opportunityRevisionId: reqs.blueprintId,
    },
  );
  const proInputHash = computeCanonicalInputHash(proPayload);

  await prisma.founderFitEvaluation.create({
    data: {
      userId: userPro.id,
      profileRevisionId: profileRev.id,
      opportunityRevisionId: rev1.id,
      blueprintId: blueprint.id,
      requirementsId: reqs.id,
      founderFitScore: 92,
      fitConfidence: 90,
      recommendationCategory: "EXCELLENT_MATCH",
      personalizedRank: 91.5,
      baseRank: 91.5,
      rubricVersion: "2.0.0",
      rankingVersion: "2.0.0",
      taxonomyVersion: "1.0.0",
      inputHash: proInputHash,
    },
  });

  // 4. Seed Completed Pro Exports & Usage Ledgers
  const pdfHash = crypto.createHash("sha256").update("MOCK_PDF_CONTENT").digest("hex");
  const csvHash = crypto.createHash("sha256").update("MOCK_CSV_CONTENT").digest("hex");
  const periodBucket = new Date().toISOString().slice(0, 7);

  const pdfLedger = await prisma.usageLedger.create({
    data: {
      userId: userPro.id,
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      unitsConsumed: 1,
      resourceId: opp.slug,
      actionContext: "EXPORT_PDF",
      idempotencyKey: `audit_ledger_pro_pdf_${userPro.id}`,
      periodBucketKey: periodBucket,
    },
  });

  const pdfExport = await prisma.opportunityExport.create({
    data: {
      requestKey: `audit_seed_pdf_${userPro.id}`,
      userId: userPro.id,
      opportunityId: opp.id,
      opportunityRevisionId: rev1.id,
      format: "PDF",
      status: "COMPLETED",
      completedAt: new Date(),
      byteSize: 1024,
      contentHash: pdfHash,
      policyVersion: "1.0.0",
      quotaPeriodKey: periodBucket,
      reservationLedgerId: pdfLedger.id,
      consumptionLedgerId: pdfLedger.id,
      entitlementSnapshot: { tier: "PRO", exportQuota: 50 },
    },
  });

  const csvLedger = await prisma.usageLedger.create({
    data: {
      userId: userPro.id,
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      unitsConsumed: 1,
      resourceId: opp.slug,
      actionContext: "EXPORT_CSV",
      idempotencyKey: `audit_ledger_pro_csv_${userPro.id}`,
      periodBucketKey: periodBucket,
    },
  });

  const csvExport = await prisma.opportunityExport.create({
    data: {
      requestKey: `audit_seed_csv_${userPro.id}`,
      userId: userPro.id,
      opportunityId: opp.id,
      opportunityRevisionId: rev1.id,
      format: "CSV",
      status: "COMPLETED",
      completedAt: new Date(),
      byteSize: 512,
      contentHash: csvHash,
      policyVersion: "1.0.0",
      quotaPeriodKey: periodBucket,
      reservationLedgerId: csvLedger.id,
      consumptionLedgerId: csvLedger.id,
      entitlementSnapshot: { tier: "PRO", exportQuota: 50 },
    },
  });

  // 5. Seed Rejected Free Export Attempt (Quota/Capability Rejection)
  const rejectedExport = await prisma.opportunityExport.create({
    data: {
      requestKey: `audit_seed_free_${userFree.id}`,
      userId: userFree.id,
      opportunityId: opp.id,
      opportunityRevisionId: rev1.id,
      format: "PDF",
      status: "REJECTED",
      rejectedAt: new Date(),
      failureCode: "PRO_REQUIRED: Upgrading to Pro is required to export blueprints.",
      policyVersion: "1.0.0",
      quotaPeriodKey: periodBucket,
      entitlementSnapshot: { tier: "FREE", exportQuota: 0 },
    },
  });

  // 6. Seed Pending Export with Reservation
  const pendingLedger = await prisma.usageLedger.create({
    data: {
      userId: userPro.id,
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      unitsConsumed: 1,
      resourceId: opp.slug,
      actionContext: "EXPORT_PENDING_RESERVE",
      idempotencyKey: `audit_ledger_pending_${userPro.id}`,
      periodBucketKey: periodBucket,
    },
  });

  await prisma.opportunityExport.create({
    data: {
      requestKey: `audit_seed_pending_${userPro.id}`,
      userId: userPro.id,
      opportunityId: opp.id,
      opportunityRevisionId: rev1.id,
      format: "PDF",
      status: "PENDING",
      reservationExpiresAt: new Date(Date.now() + 300000),
      policyVersion: "1.0.0",
      quotaPeriodKey: periodBucket,
      reservationLedgerId: pendingLedger.id,
      entitlementSnapshot: { tier: "PRO", exportQuota: 50 },
    },
  });

  // 7. Seed Recovered Abandoned Pending Export (Failed with Compensating Release)
  const expiredReserveLedger = await prisma.usageLedger.create({
    data: {
      userId: userPro.id,
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      unitsConsumed: 1,
      resourceId: opp.slug,
      actionContext: "EXPORT_EXPIRED_RESERVE",
      idempotencyKey: `audit_ledger_exp_reserve_${userPro.id}`,
      periodBucketKey: periodBucket,
    },
  });

  const compensatingReleaseLedger = await prisma.usageLedger.create({
    data: {
      userId: userPro.id,
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      unitsConsumed: -1,
      resourceId: opp.slug,
      actionContext: "EXPORT_RESERVATION_RELEASE",
      idempotencyKey: `audit_ledger_release_${userPro.id}`,
      periodBucketKey: periodBucket,
    },
  });

  await prisma.opportunityExport.create({
    data: {
      requestKey: `audit_seed_failed_released_${userPro.id}`,
      userId: userPro.id,
      opportunityId: opp.id,
      opportunityRevisionId: rev1.id,
      format: "PDF",
      status: "FAILED",
      failedAt: new Date(),
      failureCode: "EXPORT_RESERVATION_EXPIRED",
      policyVersion: "1.0.0",
      quotaPeriodKey: periodBucket,
      reservationLedgerId: expiredReserveLedger.id,
      releaseLedgerId: compensatingReleaseLedger.id,
      entitlementSnapshot: { tier: "PRO", exportQuota: 50 },
    },
  });

  // 8. Seed Checkout Attempts (Completed & Cancelled)
  const chkAttemptCompleted = await prisma.billingCheckoutAttempt.create({
    data: {
      userId: userPro.id,
      requestId: `audit_chk_comp_${Date.now()}`,
      selectedPlanCode: "PRO",
      billingInterval: "MONTHLY",
      planPriceId: proPrice ? proPrice.id : "price_pro_monthly",
      stripePriceId: "price_stripe_mock_monthly",
      idempotencyKey: `idemp_chk_comp_${Date.now()}`,
      status: "COMPLETED",
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
    },
  });

  const chkAttemptCancelled = await prisma.billingCheckoutAttempt.create({
    data: {
      userId: userPro.id,
      requestId: `audit_chk_canc_${Date.now()}`,
      selectedPlanCode: "PRO",
      billingInterval: "ANNUAL",
      planPriceId: proPrice ? proPrice.id : "price_pro_monthly",
      stripePriceId: "price_stripe_mock_annual",
      idempotencyKey: `idemp_chk_canc_${Date.now()}`,
      status: "CANCELLED",
      expiresAt: new Date(Date.now() + 86400 * 1000),
    },
  });

  // 9. Seed Authenticated and Anonymous Consents (Active, Withdrawn, Expired)
  await recordUserAnalyticsConsent(prisma, userPro.id, "GRANTED", "CONSENT_BANNER", "1.0.0");
  await recordUserAnalyticsConsent(prisma, userFree.id, "WITHDRAWN", "SETTINGS_PAGE", "1.0.0");

  const anonTokenActive = await generateSignedAnonymousConsentToken(prisma, "1.0.0");
  const anonTokenWithdrawn = await generateSignedAnonymousConsentToken(prisma, "1.0.0");
  await withdrawSignedAnonymousConsentToken(prisma, anonTokenWithdrawn);

  const anonTokenExpired = await generateSignedAnonymousConsentToken(prisma, "1.0.0", -100); // Expired 100s ago

  // 10. Seed ALL NINE Commercial Event Types
  // 1. PAYWALL_VIEWED
  await recordCommercialEvent(prisma, {
    eventType: "PAYWALL_VIEWED",
    deduplicationKey: `pub_evt_pw_${Date.now()}`,
    userId: userPro.id,
    opportunityId: opp.id,
    source: "SERVER_PAYWALL_BOUNDARY",
    metadata: { opportunitySlug: opp.slug, userTier: "PRO" },
  });

  // 2. UPGRADE_CTA_CLICKED
  await recordCommercialEvent(prisma, {
    eventType: "UPGRADE_CTA_CLICKED",
    deduplicationKey: `pub_evt_cta_${Date.now()}`,
    userId: userPro.id,
    opportunityId: opp.id,
    source: "PRICING_PAGE",
    metadata: { opportunitySlug: opp.slug, userTier: "PRO" },
  });

  // 3. CHECKOUT_CREATED
  await recordCommercialEvent(prisma, {
    eventType: "CHECKOUT_CREATED",
    deduplicationKey: `chk_created_${chkAttemptCompleted.id}`,
    userId: userPro.id,
    checkoutAttemptId: chkAttemptCompleted.id,
    source: "CHECKOUT_SERVICE",
    metadata: { planCode: "PRO", billingInterval: "MONTHLY" },
  });

  // 4. CHECKOUT_CANCELLED
  await recordCommercialEvent(prisma, {
    eventType: "CHECKOUT_CANCELLED",
    deduplicationKey: `chk_canc_${chkAttemptCancelled.id}`,
    userId: userPro.id,
    checkoutAttemptId: chkAttemptCancelled.id,
    source: "CHECKOUT_SERVICE",
    metadata: { planCode: "PRO", billingInterval: "ANNUAL" },
  });

  // 5. CHECKOUT_COMPLETED
  await recordCommercialEvent(prisma, {
    eventType: "CHECKOUT_COMPLETED",
    deduplicationKey: `chk_comp_${chkAttemptCompleted.id}`,
    userId: userPro.id,
    checkoutAttemptId: chkAttemptCompleted.id,
    source: "WEBHOOK_PROCESSOR",
    metadata: { planCode: "PRO", billingInterval: "MONTHLY" },
  });

  // 6. ENTITLEMENT_ACTIVATED
  await recordCommercialEvent(prisma, {
    eventType: "ENTITLEMENT_ACTIVATED",
    deduplicationKey: `ent_act_${userPro.id}_${Date.now()}`,
    userId: userPro.id,
    source: "WEBHOOK_PROCESSOR",
    metadata: { tier: "PRO" },
  });

  // 7. EXPORT_REQUESTED
  await recordCommercialEvent(prisma, {
    eventType: "EXPORT_REQUESTED",
    deduplicationKey: `exp_req_${pdfExport.id}`,
    userId: userPro.id,
    opportunityId: opp.id,
    exportId: pdfExport.id,
    source: "EXPORT_SERVICE",
    metadata: { format: "PDF" },
  });

  // 8. EXPORT_COMPLETED
  await recordCommercialEvent(prisma, {
    eventType: "EXPORT_COMPLETED",
    deduplicationKey: `exp_comp_${pdfExport.id}`,
    userId: userPro.id,
    opportunityId: opp.id,
    exportId: pdfExport.id,
    source: "EXPORT_SERVICE",
    metadata: { format: "PDF", byteSize: 1024 },
  });

  // 9. EXPORT_REJECTED
  await recordCommercialEvent(prisma, {
    eventType: "EXPORT_REJECTED",
    deduplicationKey: `exp_rej_${rejectedExport.id}`,
    userId: userFree.id,
    opportunityId: opp.id,
    exportId: rejectedExport.id,
    source: "EXPORT_SERVICE",
    metadata: { format: "PDF", reason: "PRO_REQUIRED" },
  });

  // 11. Seed Active Legal Hold & Expired Commercial Events with Non-Vacuous Retention Execution
  // Event A: Expired and deleted by retention worker
  const expiredEvtToDelete = await recordCommercialEvent(prisma, {
    eventType: "PAYWALL_VIEWED",
    deduplicationKey: `evt_expired_del_${Date.now()}`,
    userId: userPro.id,
    opportunityId: opp.id,
    source: "SERVER_PAYWALL_BOUNDARY",
    metadata: { opportunitySlug: opp.slug, userTier: "PRO" },
  });

  await prisma.commercialEvent.update({
    where: { id: expiredEvtToDelete.eventId },
    data: { retentionExpiresAt: new Date(Date.now() - 60000) },
  });

  // Execute retention reconciliation -> deletes expiredEvtToDelete
  const retentionCleanup = await reconcileCommercialEventRetention(prisma);
  console.log(`Retention cleanup deleted ${retentionCleanup.deletedCount} expired row(s).`);

  // Event B: Expired but protected by active legal hold
  const heldEvt = await recordCommercialEvent(prisma, {
    eventType: "EXPORT_COMPLETED",
    deduplicationKey: `exp_held_${csvExport.id}`,
    userId: userPro.id,
    opportunityId: opp.id,
    exportId: csvExport.id,
    source: "EXPORT_SERVICE",
    metadata: { format: "CSV", byteSize: 512 },
  });

  await prisma.commercialEvent.update({
    where: { id: heldEvt.eventId },
    data: {
      retentionExpiresAt: new Date(Date.now() - 60000),
      legalHoldUntil: new Date(Date.now() + 365 * 86400 * 1000),
      legalHoldReasonCode: "LITIGATION_HOLD",
    },
  });

  console.log("Phase 4D deterministic fixtures seeded successfully.");
}

if (require.main === module) {
  seedPhase4dFixture()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedPhase4dFixture };
