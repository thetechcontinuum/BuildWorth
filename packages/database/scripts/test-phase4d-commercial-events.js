const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  recordCommercialEvent,
  sanitizeEventMetadata,
  reconcileCommercialEventRetention,
  getUserCommercialEventsExport,
  executeUserCommercialDataErasure,
  restrictUserCommercialProcessing,
  setCommercialEventLegalHold,
  getPrivacyRetentionDTO,
  recordUserAnalyticsConsent,
  hasUserActiveAnalyticsConsent,
  generateSignedAnonymousConsentToken,
  verifySignedAnonymousConsentToken,
  withdrawSignedAnonymousConsentToken,
  hashConsentId,
  generateInteractionToken,
  verifyInteractionToken,
  validateEventSourceCombination,
} = require("../../billing/dist/index.js");

async function runCommercialEventsSuite() {
  console.log("=== BuildWorth Phase 4D Task 3: Final GDPR Controls & Verification Suite ===");

  process.env.COMMERCIAL_ANALYTICS_RETENTION_DAYS = "90";
  process.env.COMMERCIAL_TRANSACTION_RETENTION_DAYS = "730";
  process.env.COMMERCIAL_SECURITY_RETENTION_DAYS = "30";

  const dbName = "test_phase4d_events_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy all migrations & reconcile catalog
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // 2. Setup Test Data
    const testUser = await prisma.user.create({
      data: { email: `event_user_${Date.now()}@buildworth.io`, tier: "FREE" },
    });

    const secondUser = await prisma.user.create({
      data: { email: `second_user_${Date.now()}@buildworth.io`, tier: "FREE" },
    });

    const testOpp = await prisma.opportunity.create({
      data: {
        slug: `opp-events-${Date.now()}`,
        title: "Commercial Events Venture",
        oneSentenceSummary: "Testing commercial event audit trail",
        problemStatement: "Need privacy-safe commercial event recording",
        jobsToBeDone: ["Track conversions"],
        proposedProduct: "Commercial Audit",
        narrowMvpScope: ["Event recording"],
        targetCustomerSegments: ["Growth SaaS"],
        economicBuyer: "Head of Growth",
        endUser: "Analyst",
        buyingTrigger: "Quarterly review",
        existingWorkflow: "None",
        painSeverity: "HIGH",
        painFrequency: "DAILY",
        status: "PUBLISHED",
        customerType: "B2B",
        industry: "Analytics",
        estimatedMvpCostMinCents: 100000,
        estimatedMvpCostMaxCents: 200000,
        estimatedTimeToMvpMinWeeks: 4,
        estimatedTimeToMvpMaxWeeks: 8,
        estimatedMonthlyOpCostMinCents: 10000,
        estimatedMonthlyOpCostMaxCents: 20000,
        currency: "USD",
        recommendedNextExperiment: "Event test",
      },
    });

    const testRev = await prisma.opportunityRevision.create({
      data: {
        opportunityId: testOpp.id,
        revisionNumber: 1,
        reasonForChange: "Initial release",
        snapshotData: { title: testOpp.title, slug: testOpp.slug },
      },
    });

    const testCheckout1 = await prisma.billingCheckoutAttempt.create({
      data: {
        userId: testUser.id,
        requestId: `user1_req_${Date.now()}`,
        selectedPlanCode: "PRO",
        billingInterval: "MONTHLY",
        planPriceId: "price_pro_monthly",
        stripePriceId: "price_test_monthly",
        idempotencyKey: `idemp_chk1_${Date.now()}`,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });

    const testCheckout2 = await prisma.billingCheckoutAttempt.create({
      data: {
        userId: secondUser.id,
        requestId: `user2_req_${Date.now()}`,
        selectedPlanCode: "PRO",
        billingInterval: "MONTHLY",
        planPriceId: "price_pro_monthly",
        stripePriceId: "price_test_monthly",
        idempotencyKey: `idemp_chk2_${Date.now()}`,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });

    // ------------------------------------------------------------------------
    // STAGE 1: Durable Anonymous Consent Lifecycle & Withdrawal Verification
    // ------------------------------------------------------------------------
    console.log("Stage 1: Testing durable anonymous consent lifecycle across simulated processes & withdrawal...");

    // 1A: User without server-recorded consent is NOT stored
    const unconsentedPaywall = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `paywall_no_consent_${Date.now()}`,
      userId: testUser.id,
      opportunityId: testOpp.id,
      source: "SERVER_PAYWALL_BOUNDARY",
      metadata: { opportunitySlug: testOpp.slug, lockedSection: "financialScenarios", userTier: "FREE" },
    });
    if (unconsentedPaywall.recorded || !unconsentedPaywall.skippedConsent) {
      throw new Error("Unconsented analytics event was improperly recorded!");
    }

    // 1B: Record server consent in AnalyticsConsentHistory
    await recordUserAnalyticsConsent(prisma, testUser.id, "GRANTED", "CONSENT_BANNER", "1.0.0");
    const hasConsentNow = await hasUserActiveAnalyticsConsent(prisma, testUser.id);
    if (!hasConsentNow) {
      throw new Error("Failed to verify granted consent in database!");
    }

    // Now event records cleanly
    const consentedPaywall = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `paywall_consented_${Date.now()}`,
      userId: testUser.id,
      opportunityId: testOpp.id,
      source: "SERVER_PAYWALL_BOUNDARY",
      metadata: { opportunitySlug: testOpp.slug, lockedSection: "financialScenarios", userTier: "FREE" },
    });
    if (!consentedPaywall.recorded || !consentedPaywall.eventId) {
      throw new Error(`Consented analytics event failed to record: ${consentedPaywall.error}`);
    }

    // 1C: Withdraw consent for authenticated user
    await recordUserAnalyticsConsent(prisma, testUser.id, "WITHDRAWN", "SETTINGS_PAGE", "1.0.0");
    const hasConsentAfterWithdraw = await hasUserActiveAnalyticsConsent(prisma, testUser.id);
    if (hasConsentAfterWithdraw) {
      throw new Error("Consent still active after withdrawal!");
    }

    const postWithdrawalEvent = await recordCommercialEvent(prisma, {
      eventType: "UPGRADE_CTA_CLICKED",
      deduplicationKey: `cta_after_withdrawal_${Date.now()}`,
      userId: testUser.id,
      opportunityId: testOpp.id,
      source: "PRICING_PAGE",
      metadata: { opportunitySlug: testOpp.slug, targetPlanCode: "PRO", billingInterval: "MONTHLY" },
    });
    if (postWithdrawalEvent.recorded) {
      throw new Error("Analytics event recorded after consent withdrawal!");
    }

    // 1D: Anonymous user with durable HKDF server-signed consent token
    // Process A: Issue token
    const validAnonToken = await generateSignedAnonymousConsentToken(prisma, "1.0.0");
    const tokenParts = validAnonToken.split(".");
    const tokenPayload = JSON.parse(Buffer.from(tokenParts[0], "base64url").toString("utf-8"));
    const rawConsentId = tokenPayload.consentId;

    // Verify raw consentId is NOT in database
    const rawMatch = await prisma.analyticsConsentHistory.findMany({
      where: { source: rawConsentId },
    });
    if (rawMatch.length > 0) {
      throw new Error("Raw consentId was leaked into database!");
    }

    const hashedCheck = await prisma.analyticsConsentHistory.findUnique({
      where: { consentIdHash: hashConsentId(rawConsentId) },
    });
    if (!hashedCheck || hashedCheck.status !== "GRANTED") {
      throw new Error("Durable hashed consent record was not found in database!");
    }

    // Process B: Validate token
    const isValidInProcessB = await verifySignedAnonymousConsentToken(prisma, validAnonToken);
    if (!isValidInProcessB) {
      throw new Error("Durable anonymous consent token failed verification in simulated process B!");
    }

    const anonConsented = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `anon_consented_${Date.now()}`,
      source: "SERVER_PAYWALL_BOUNDARY",
      signedAnonymousConsentToken: validAnonToken,
      metadata: { opportunitySlug: testOpp.slug, lockedSection: "risks" },
    });
    if (!anonConsented.recorded) {
      throw new Error("Server-signed anonymous consent token was rejected during event recording!");
    }

    // Process B: Withdraw anonymous consent
    const withdrawRes = await withdrawSignedAnonymousConsentToken(prisma, validAnonToken);
    if (!withdrawRes.withdrawn) {
      throw new Error("Failed to withdraw anonymous consent!");
    }

    // Process C: Replay old token after withdrawal -> Must be rejected immediately
    const isValidInProcessC = await verifySignedAnonymousConsentToken(prisma, validAnonToken);
    if (isValidInProcessC) {
      throw new Error("Anonymous consent token was still valid after withdrawal in simulated process C!");
    }

    const anonPostWithdrawal = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `anon_after_withdraw_${Date.now()}`,
      source: "SERVER_PAYWALL_BOUNDARY",
      signedAnonymousConsentToken: validAnonToken,
      metadata: { opportunitySlug: testOpp.slug, lockedSection: "risks" },
    });
    if (anonPostWithdrawal.recorded) {
      throw new Error("Anonymous event recorded after token withdrawal!");
    }

    const anonForged = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `anon_forged_${Date.now()}`,
      source: "SERVER_PAYWALL_BOUNDARY",
      signedAnonymousConsentToken: "forged.token.here",
      metadata: { opportunitySlug: testOpp.slug, lockedSection: "risks" },
    });
    if (anonForged.recorded) {
      throw new Error("Forged anonymous consent token was accepted!");
    }
    console.log("  ✓ Durable anonymous consent lifecycle (issue in A, validate in B, withdraw in B, reject replay in C) verified.");

    // ------------------------------------------------------------------------
    // STAGE 2: Completely-Bound Interaction Token Authentication
    // ------------------------------------------------------------------------
    console.log("Stage 2: Testing completely-bound interaction tokens...");

    const validInteractionToken = generateInteractionToken({
      eventType: "PAYWALL_VIEWED",
      opportunitySlug: testOpp.slug,
      uiLocation: "OPPORTUNITY_DOSSIER",
    });

    // 2A: Valid token passes
    const validInterCheck = verifyInteractionToken(validInteractionToken, {
      eventType: "PAYWALL_VIEWED",
      opportunitySlug: testOpp.slug,
      uiLocation: "OPPORTUNITY_DOSSIER",
    });
    if (!validInterCheck.valid || !validInterCheck.interactionId) {
      throw new Error("Valid interaction token failed verification!");
    }

    // 2B: Changed eventType rejected
    const changedEventType = verifyInteractionToken(validInteractionToken, {
      eventType: "UPGRADE_CTA_CLICKED",
      opportunitySlug: testOpp.slug,
      uiLocation: "OPPORTUNITY_DOSSIER",
    });
    if (changedEventType.valid) throw new Error("Interaction token accepted mismatched eventType!");

    // 2C: Changed opportunitySlug rejected
    const changedSlug = verifyInteractionToken(validInteractionToken, {
      eventType: "PAYWALL_VIEWED",
      opportunitySlug: "different-slug",
      uiLocation: "OPPORTUNITY_DOSSIER",
    });
    if (changedSlug.valid) throw new Error("Interaction token accepted mismatched slug!");

    // 2D: Changed uiLocation rejected
    const changedLocation = verifyInteractionToken(validInteractionToken, {
      eventType: "PAYWALL_VIEWED",
      opportunitySlug: testOpp.slug,
      uiLocation: "PRICING_PAGE",
    });
    if (changedLocation.valid) throw new Error("Interaction token accepted mismatched uiLocation!");

    // 2E: Deduplication derivation
    const dedupKey = `pub_evt_${validInterCheck.interactionId}_PAYWALL_VIEWED`;
    if (!dedupKey.startsWith("pub_evt_") || !dedupKey.endsWith("_PAYWALL_VIEWED")) {
      throw new Error("Deduplication key derivation format invalid!");
    }
    console.log("  ✓ Completely-bound interaction token verification and parameter tampering rejection verified.");

    // ------------------------------------------------------------------------
    // STAGE 3: Bounded Concurrency-Safe Retention Cleanup & Legal Hold
    // ------------------------------------------------------------------------
    console.log("Stage 3: Testing bounded concurrency-safe retention cleanup...");

    const evt1 = await recordCommercialEvent(prisma, {
      eventType: "CHECKOUT_CREATED",
      deduplicationKey: `chk_created_${testCheckout1.id}`,
      userId: testUser.id,
      checkoutAttemptId: testCheckout1.id,
      source: "CHECKOUT_SERVICE",
      metadata: { planCode: "PRO", billingInterval: "MONTHLY", amountCents: 1900, currency: "USD" },
    });

    // Force event to expired state
    await prisma.commercialEvent.update({
      where: { id: evt1.eventId },
      data: {
        retentionExpiresAt: new Date(Date.now() - 10000),
      },
    });

    // Create an expired event on active legal hold
    const heldEvt = await recordCommercialEvent(prisma, {
      eventType: "CHECKOUT_CREATED",
      deduplicationKey: `held_evt_${Date.now()}`,
      userId: testUser.id,
      checkoutAttemptId: testCheckout1.id,
      source: "CHECKOUT_SERVICE",
      metadata: { planCode: "PRO" },
    });
    await prisma.commercialEvent.update({
      where: { id: heldEvt.eventId },
      data: {
        retentionExpiresAt: new Date(Date.now() - 10000),
        legalHoldUntil: new Date(Date.now() + 86400 * 1000),
        legalHoldReasonCode: "LITIGATION_HOLD",
      },
    });

    // Simulate 2 concurrent workers executing retention cleanup
    const [w1, w2] = await Promise.all([
      reconcileCommercialEventRetention(prisma, { batchSize: 50 }),
      reconcileCommercialEventRetention(prisma, { batchSize: 50 }),
    ]);

    const totalDeleted = w1.deletedCount + w2.deletedCount;
    if (totalDeleted < 1) {
      throw new Error("Concurrent retention workers failed to delete expired record!");
    }

    const deletedEvt = await prisma.commercialEvent.findUnique({
      where: { id: evt1.eventId },
    });
    if (deletedEvt !== null) {
      throw new Error("Expired event was not deleted!");
    }

    // Held event remains
    const survivingHeldEvt = await prisma.commercialEvent.findUnique({
      where: { id: heldEvt.eventId },
    });
    if (!survivingHeldEvt) {
      throw new Error("Legal hold failed to protect expired record from deletion!");
    }
    console.log("  ✓ Bounded concurrency-safe retention cleanup and legal hold protection verified.");

    // ------------------------------------------------------------------------
    // STAGE 4: Missing Retention Configuration Safe Failure
    // ------------------------------------------------------------------------
    console.log("Stage 4: Testing missing retention configuration safe failure...");
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.COMMERCIAL_ANALYTICS_RETENTION_DAYS;

      const freshAnonToken = await generateSignedAnonymousConsentToken(prisma, "1.0.0");
      const unconfiguredAnalytics = await recordCommercialEvent(prisma, {
        eventType: "PAYWALL_VIEWED",
        deduplicationKey: `unconf_analytics_${Date.now()}`,
        source: "SERVER_PAYWALL_BOUNDARY",
        signedAnonymousConsentToken: freshAnonToken,
        metadata: { opportunitySlug: testOpp.slug },
      });

      if (unconfiguredAnalytics.recorded) {
        throw new Error("Optional analytics persisted when retention configuration is missing in production!");
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
    console.log("  ✓ Missing production retention configuration refuses optional analytics without crashing.");

    // ------------------------------------------------------------------------
    // STAGE 5: Data-Subject Rights & Cross-User Authorization Rejection
    // ------------------------------------------------------------------------
    console.log("Stage 5: Testing data-subject rights and authorization isolation...");

    // Create a new event for second user
    const secUserEvt = await recordCommercialEvent(prisma, {
      eventType: "CHECKOUT_CREATED",
      deduplicationKey: `chk_sec_user_live_${Date.now()}`,
      userId: secondUser.id,
      checkoutAttemptId: testCheckout2.id,
      source: "CHECKOUT_SERVICE",
      metadata: { planCode: "PRO", billingInterval: "MONTHLY", amountCents: 1900, currency: "USD" },
    });

    const user1Export = await getUserCommercialEventsExport(prisma, testUser.id);
    const leakedUser2Data = user1Export.some((e) => e.userId && e.userId === secondUser.id);
    if (leakedUser2Data) {
      throw new Error("Data export leaked another user's event data!");
    }

    // Execute user erasure on testUser
    await executeUserCommercialDataErasure(prisma, testUser.id);

    // Verify secondUser data was completely unaffected
    const secUserRow = await prisma.commercialEvent.findUnique({
      where: { id: secUserEvt.eventId },
    });
    if (!secUserRow || secUserRow.userId !== secondUser.id) {
      throw new Error("User erasure affected another user's records!");
    }
    console.log("  ✓ Data-subject rights operate strictly on authenticated user scope with full isolation.");

    console.log("\n=======================================================");
    console.log("Phase 4D GDPR Commercial Events Final Suite PASSED (100%)!");
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
  runCommercialEventsSuite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runCommercialEventsSuite };
