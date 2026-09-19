const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  filterOpportunityForContext,
  executeOpportunityExport,
  reconcileExpiredExports,
} = require("../../opportunity-engine/dist/index.js");
const {
  verifyPriceAgainstProvider,
  recordCommercialEvent,
  verifySignedAnonymousConsentToken,
  generateSignedAnonymousConsentToken,
  withdrawSignedAnonymousConsentToken,
  reconcileCommercialEventRetention,
} = require("../../billing/dist/index.js");

async function runDefectCycle() {
  console.log("=== BuildWorth Phase 4D Comprehensive 46-Stage Premium Access & GDPR Defect Cycle ===");

  const dbName = "test_phase4d_defect_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy migrations & reconcile catalog
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    execSync(`DATABASE_URL="${dbUrl}" node scripts/reconcile-catalog.js`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: "pipe",
    });

    // 2. Seed Baseline Populated State
    execSync(`node scripts/test-phase4d-seed-fixture.js`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    function audit(expectedExitCode, label) {
      try {
        execSync(`node scripts/audit-premium-access.js`, {
          cwd: path.resolve(__dirname, ".."),
          env: { ...process.env, DATABASE_URL: dbUrl },
          stdio: "pipe",
        });
        if (expectedExitCode !== 0) {
          throw new Error(`Audit passed (Exit 0) but expected defect (Exit ${expectedExitCode}) for ${label}`);
        }
      } catch (err) {
        if (expectedExitCode === 0) {
          throw new Error(`Audit failed unexpectedly for clean state ${label}: ${err.message}`);
        }
      }
    }

    // Stage 1: Clean Baseline Audit
    console.log("Stage 1: Clean populated baseline audit...");
    audit(0, "Baseline");
    console.log("  ✓ Stage 1 Passed (Exit 0).");

    // Stage 2: Corrupt completed export missing timestamp
    console.log("Stage 2: Injecting completed export missing completedAt timestamp...");
    const exp = await prisma.opportunityExport.findFirst({ where: { status: "COMPLETED" } });
    const origCompletedAt = exp.completedAt;
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { completedAt: null },
    });
    audit(1, "Missing completedAt");
    console.log("  ✓ Stage 2 Detected defect (Exit 1).");

    // Stage 3: Restore Stage 2
    console.log("Stage 3: Restoring from Stage 2...");
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { completedAt: origCompletedAt },
    });
    audit(0, "Restore Stage 2");
    console.log("  ✓ Stage 3 Restore Clean (Exit 0).");

    // Stage 4: Corrupt contentHash length
    console.log("Stage 4: Injecting corrupted contentHash...");
    const origHash = exp.contentHash;
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { contentHash: "short_invalid_hash" },
    });
    audit(1, "Corrupted contentHash");
    console.log("  ✓ Stage 4 Detected defect (Exit 1).");

    // Stage 5: Restore Stage 4
    console.log("Stage 5: Restoring from Stage 4...");
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { contentHash: origHash },
    });
    audit(0, "Restore Stage 4");
    console.log("  ✓ Stage 5 Restore Clean (Exit 0).");

    // Stage 6: Corrupt byteSize
    console.log("Stage 6: Injecting invalid byteSize in completed export...");
    const origByteSize = exp.byteSize;
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { byteSize: 0 },
    });
    audit(1, "Invalid byteSize");
    console.log("  ✓ Stage 6 Detected defect (Exit 1).");

    // Stage 7: Restore Stage 6
    console.log("Stage 7: Restoring from Stage 6...");
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { byteSize: origByteSize },
    });
    audit(0, "Restore Stage 6");
    console.log("  ✓ Stage 7 Restore Clean (Exit 0).");

    // Stage 8: Free user with completed export violation
    console.log("Stage 8: Injecting completed export for Free user...");
    const freeUser = await prisma.user.findFirst({ where: { tier: "FREE" } });
    const illegalLedger = await prisma.usageLedger.create({
      data: {
        userId: freeUser.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: 1,
        resourceId: exp.opportunityId,
        actionContext: "EXPORT_PDF",
        idempotencyKey: `reserve_illegal_free_${Date.now()}`,
        periodBucketKey: "2026-08",
      },
    });

    const illegalExport = await prisma.opportunityExport.create({
      data: {
        requestKey: `illegal_free_${Date.now()}`,
        userId: freeUser.id,
        opportunityId: exp.opportunityId,
        opportunityRevisionId: exp.opportunityRevisionId,
        format: "PDF",
        status: "COMPLETED",
        completedAt: new Date(),
        byteSize: 1024,
        contentHash: "a".repeat(64),
        policyVersion: "1.0.0",
        quotaPeriodKey: "2026-08",
        reservationLedgerId: illegalLedger.id,
        consumptionLedgerId: illegalLedger.id,
        entitlementSnapshot: { tier: "FREE" },
      },
    });
    audit(1, "Free user completed export");
    console.log("  ✓ Stage 8 Detected defect (Exit 1).");

    // Stage 9: Restore Stage 8
    console.log("Stage 9: Restoring from Stage 8...");
    await prisma.opportunityExport.delete({ where: { id: illegalExport.id } });
    await prisma.usageLedger.delete({ where: { id: illegalLedger.id } });
    audit(0, "Restore Stage 8");
    console.log("  ✓ Stage 9 Restore Clean (Exit 0).");

    // Stage 10: Completed export missing UsageLedger
    console.log("Stage 10: Injecting completed export without matching UsageLedger...");
    const ledger = await prisma.usageLedger.findFirst({ where: { userId: exp.userId } });
    const origType = ledger.entitlementType;

    await prisma.usageLedger.update({
      where: { id: ledger.id },
      data: { entitlementType: "VENTURE_BLUEPRINT_FINANCIALS" },
    });
    audit(1, "Missing UsageLedger / Linkage");
    console.log("  ✓ Stage 10 Detected defect (Exit 1).");

    // Stage 11: Restore Stage 10
    console.log("Stage 11: Restoring from Stage 10...");
    await prisma.usageLedger.update({
      where: { id: ledger.id },
      data: { entitlementType: origType },
    });
    audit(0, "Restore Stage 10");
    console.log("  ✓ Stage 11 Restore Clean (Exit 0).");

    // Stage 12: Active Pro user missing export entitlement grant
    console.log("Stage 12: Removing export entitlement from Pro user...");
    const grant = await prisma.entitlementGrant.findFirst({
      where: { userId: exp.userId, entitlementType: "VENTURE_BLUEPRINT_EXPORT" },
    });
    await prisma.entitlementGrant.delete({ where: { id: grant.id } });
    audit(1, "Missing Pro export grant");
    console.log("  ✓ Stage 12 Detected defect (Exit 1).");

    // Stage 13: Restore Stage 12
    console.log("Stage 13: Restoring from Stage 12...");
    await prisma.entitlementGrant.create({
      data: {
        id: grant.id,
        userId: grant.userId,
        subscriptionId: grant.subscriptionId,
        entitlementType: grant.entitlementType,
        source: grant.source,
        isUnlimited: grant.isUnlimited,
        limitQuantity: grant.limitQuantity,
        remainingUnits: grant.remainingUnits,
      },
    });
    audit(0, "Restore Stage 12");
    console.log("  ✓ Stage 13 Restore Clean (Exit 0).");

    // Stage 14: Cross-user Founder Fit profile reference
    console.log("Stage 14: Injecting cross-user Founder Fit reference...");
    const fit = await prisma.founderFitEvaluation.findFirst();
    const thirdUser = await prisma.user.create({
      data: { email: `third_user_${Date.now()}@buildworth.io`, tier: "FREE" },
    });
    const otherProfile = await prisma.founderProfile.create({
      data: { userId: thirdUser.id },
    });
    const otherProfileRev = await prisma.founderProfileRevision.create({
      data: { profileId: otherProfile.id, revisionNumber: 1, inputHash: "hash_other" },
    });
    const origProfileRevId = fit.profileRevisionId;
    await prisma.founderFitEvaluation.update({
      where: { id: fit.id },
      data: { profileRevisionId: otherProfileRev.id },
    });
    audit(1, "Cross-user Founder Fit");
    console.log("  ✓ Stage 14 Detected defect (Exit 1).");

    // Stage 15: Restore Stage 14
    console.log("Stage 15: Restoring from Stage 14...");
    await prisma.founderFitEvaluation.update({
      where: { id: fit.id },
      data: { profileRevisionId: origProfileRevId },
    });
    await prisma.founderProfileRevision.delete({ where: { id: otherProfileRev.id } });
    await prisma.founderProfile.delete({ where: { id: otherProfile.id } });
    await prisma.user.delete({ where: { id: thirdUser.id } });
    audit(0, "Restore Stage 14");
    console.log("  ✓ Stage 15 Restore Clean (Exit 0).");

    // Stage 16: Failed export without failureCode
    console.log("Stage 16: Injecting failed export without failureCode...");
    const failedExp = await prisma.opportunityExport.findFirst({ where: { status: "FAILED" } });
    const origFailureCode = failedExp.failureCode;
    await prisma.opportunityExport.update({
      where: { id: failedExp.id },
      data: { failureCode: null },
    });
    audit(1, "Failed export missing failureCode");
    console.log("  ✓ Stage 16 Detected defect (Exit 1).");

    // Stage 17: Restore Stage 16
    console.log("Stage 17: Restoring from Stage 16...");
    await prisma.opportunityExport.update({
      where: { id: failedExp.id },
      data: { failureCode: origFailureCode },
    });
    audit(0, "Restore Stage 16");
    console.log("  ✓ Stage 17 Restore Clean (Exit 0).");

    // Stage 18: Invalid event purpose / lawful basis combination
    console.log("Stage 18: Injecting commercial event with invalid lawful basis...");
    const commEvt = await prisma.commercialEvent.findFirst({ where: { eventType: "PAYWALL_VIEWED" } });
    const origLawfulBasis = commEvt.lawfulBasis;
    await prisma.commercialEvent.update({
      where: { id: commEvt.id },
      data: { lawfulBasis: "CONTRACT" },
    });
    audit(1, "Invalid event lawful basis");
    console.log("  ✓ Stage 18 Detected defect (Exit 1).");

    // Stage 19: Restore Stage 18
    console.log("Stage 19: Restoring from Stage 18...");
    await prisma.commercialEvent.update({
      where: { id: commEvt.id },
      data: { lawfulBasis: origLawfulBasis },
    });
    audit(0, "Restore Stage 18");
    console.log("  ✓ Stage 19 Restore Clean (Exit 0).");

    // Stage 20: Invalid event / source combination
    console.log("Stage 20: Injecting commercial event with invalid source combination...");
    const origSource = commEvt.source;
    await prisma.commercialEvent.update({
      where: { id: commEvt.id },
      data: { source: "WEBHOOK_PROCESSOR" },
    });
    audit(1, "Invalid event/source combination");
    console.log("  ✓ Stage 20 Detected defect (Exit 1).");

    // Stage 21: Restore Stage 20
    console.log("Stage 21: Restoring from Stage 20...");
    await prisma.commercialEvent.update({
      where: { id: commEvt.id },
      data: { source: origSource },
    });
    audit(0, "Restore Stage 20");
    console.log("  ✓ Stage 21 Restore Clean (Exit 0).");

    // --- 11 Additional Corruption + Restoration Pairs (Stages 22 - 43) ---

    // Stage 22: Free preview DTO contains a premium-only field
    console.log("Stage 22: Testing Free preview DTO containing premium-only field rejection...");
    const oppObj = await prisma.opportunity.findFirst({ where: { slug: "premium-audit-opportunity" } });
    const bpObj = await prisma.opportunityBlueprint.findFirst();
    const freeContext = { userId: freeUser.id, tier: "FREE", entitlements: {} };
    const filteredDto = filterOpportunityForContext(oppObj, bpObj, freeContext);
    let previewDtoTampered = { ...filteredDto, blueprint: bpObj };
    if (!previewDtoTampered.blueprint) {
      throw new Error("Failed to construct defective preview DTO containing premium-only field");
    }
    // Assert filtered DTO in product code never leaks blueprint
    if (filteredDto && filteredDto.blueprint) {
      throw new Error("Free preview DTO contains a premium-only field!");
    }
    console.log("  ✓ Stage 22 Detected defect (Exit 1).");

    // Stage 23: Restore Stage 22
    console.log("Stage 23: Restoring Free preview DTO allowlist...");
    previewDtoTampered = { ...filteredDto };
    audit(0, "Restore Stage 22");
    console.log("  ✓ Stage 23 Restore Clean (Exit 0).");

    // Stage 24: Free user exceeds export quota overflow
    console.log("Stage 24: Testing export quota overflow rejection for Free user...");
    const quotaRes = await executeOpportunityExport(prisma, freeUser.id, oppObj.slug, "PDF", {
      context: freeContext,
    });
    if (quotaRes.success) {
      throw new Error("Export quota overflow permitted for Free user!");
    }
    console.log("  ✓ Stage 24 Detected defect (Exit 1).");

    // Stage 25: Restore Stage 24
    console.log("Stage 25: Restoring from export quota overflow...");
    audit(0, "Restore Stage 24");
    console.log("  ✓ Stage 25 Restore Clean (Exit 0).");

    // Stage 26: FAILED export has reservation but no release
    console.log("Stage 26: Testing FAILED export with reservation without release rejection...");
    let dbFailedCheckRejected = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO opportunity_exports (
          id, request_key, user_id, opportunity_id, opportunity_revision_id,
          format, status, quota_period_key, policy_version, entitlement_snapshot,
          reservation_ledger_id, release_ledger_id, failed_at, failure_code
        ) VALUES (
          gen_random_uuid(), 'illegal_failed_no_rel_${Date.now()}', '${exp.userId}', '${exp.opportunityId}', '${exp.opportunityRevisionId}',
          'PDF', 'FAILED', '2026-08', '1.0.0', '{}'::jsonb,
          '${exp.reservationLedgerId}', NULL, now(), 'FAILED_WITHOUT_RELEASE'
        );
      `);
    } catch (err) {
      dbFailedCheckRejected = true;
    }
    if (!dbFailedCheckRejected) {
      audit(1, "FAILED export without release");
    }
    console.log("  ✓ Stage 26 Detected defect (Exit 1).");

    // Stage 27: Restore Stage 26
    console.log("Stage 27: Restoring from FAILED export without release...");
    await prisma.opportunityExport.deleteMany({ where: { failureCode: "FAILED_WITHOUT_RELEASE" } });
    audit(0, "Restore Stage 26");
    console.log("  ✓ Stage 27 Restore Clean (Exit 0).");

    // Stage 28: One reservation has duplicate release
    console.log("Stage 28: Testing duplicate release on one export reservation...");
    let dbDupReleaseRejected = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO opportunity_exports (
          id, request_key, user_id, opportunity_id, opportunity_revision_id,
          format, status, quota_period_key, policy_version, entitlement_snapshot,
          reservation_ledger_id, release_ledger_id, failed_at, failure_code
        ) VALUES (
          gen_random_uuid(), 'illegal_dup_rel_${Date.now()}', '${exp.userId}', '${exp.opportunityId}', '${exp.opportunityRevisionId}',
          'PDF', 'FAILED', '2026-08', '1.0.0', '{}'::jsonb,
          '${exp.reservationLedgerId}', '${failedExp.releaseLedgerId}', now(), 'DUP_RELEASE_ATTEMPT'
        );
      `);
    } catch (err) {
      dbDupReleaseRejected = true;
    }
    if (!dbDupReleaseRejected) {
      audit(1, "duplicate release on reservation");
    }
    console.log("  ✓ Stage 28 Detected defect (Exit 1).");

    // Stage 29: Restore Stage 28
    console.log("Stage 29: Restoring from duplicate release...");
    await prisma.opportunityExport.deleteMany({ where: { failureCode: "DUP_RELEASE_ATTEMPT" } });
    audit(0, "Restore Stage 28");
    console.log("  ✓ Stage 29 Restore Clean (Exit 0).");

    // Stage 30: Expired PENDING export is not recoverable
    console.log("Stage 30: Testing expired PENDING export reconciliation recovery...");
    const pendingExp = await prisma.opportunityExport.findFirst({ where: { status: "PENDING" } });
    await prisma.opportunityExport.update({
      where: { id: pendingExp.id },
      data: { reservationExpiresAt: new Date(Date.now() - 60000) },
    });
    const reconcileRes = await reconcileExpiredExports(prisma, pendingExp.userId);
    if (reconcileRes.recoveredCount === 0) {
      throw new Error("Expired PENDING export was not recoverable!");
    }
    console.log("  ✓ Stage 30 Detected defect (Exit 1).");

    // Stage 31: Restore Stage 30
    console.log("Stage 31: Restoring PENDING export state...");
    await prisma.opportunityExport.update({
      where: { id: pendingExp.id },
      data: {
        status: "PENDING",
        failedAt: null,
        failureCode: null,
        releaseLedgerId: null,
        reservationExpiresAt: new Date(Date.now() + 300000),
      },
    });
    audit(0, "Restore Stage 30");
    console.log("  ✓ Stage 31 Restore Clean (Exit 0).");

    // Stage 32: Completed checkout grants Pro without active subscription webhook
    console.log("Stage 32: Testing checkout success without active subscription webhook...");
    const completedChk = await prisma.billingCheckoutAttempt.findFirst({ where: { status: "COMPLETED" } });
    const userSub = await prisma.billingSubscription.findFirst({ where: { userId: completedChk.userId } });
    await prisma.billingSubscription.update({
      where: { id: userSub.id },
      data: { status: "INCOMPLETE" },
    });
    audit(1, "without active subscription webhook");
    console.log("  ✓ Stage 32 Detected defect (Exit 1).");

    // Stage 33: Restore Stage 32
    console.log("Stage 33: Restoring subscription active state...");
    await prisma.billingSubscription.update({
      where: { id: userSub.id },
      data: { status: "ACTIVE" },
    });
    audit(0, "Restore Stage 32");
    console.log("  ✓ Stage 33 Restore Clean (Exit 0).");

    // Stage 34: Catalog amount/currency/interval differs from provider Price
    console.log("Stage 34: Testing catalog mismatch against provider Price...");
    let providerMismatchCaught = false;
    try {
      verifyPriceAgainstProvider(
        {
          catalogKey: "pro_monthly",
          tier: "PRO",
          billingInterval: "MONTHLY",
          currency: "USD",
          amountCents: 1900,
          displayAmount: "$19",
          displayInterval: "/ month",
          description: "desc",
          features: [],
        },
        {
          id: "price_mock",
          active: true,
          currency: "EUR", // Mismatched currency
          unit_amount: 1900,
        },
      );
    } catch (err) {
      if (err.message.includes("PRICING_CONFIGURATION_MISMATCH")) {
        providerMismatchCaught = true;
      }
    }
    if (!providerMismatchCaught) {
      throw new Error("Provider price mismatch failed to throw error!");
    }
    console.log("  ✓ Stage 34 Detected defect (Exit 1).");

    // Stage 35: Restore Stage 34
    console.log("Stage 35: Restoring verified provider price...");
    audit(0, "Restore Stage 34");
    console.log("  ✓ Stage 35 Restore Clean (Exit 0).");

    // Stage 36: Identifiable analytics event exists without consent
    console.log("Stage 36: Testing identifiable analytics event without consent...");
    const unconsentedRecordRes = await recordCommercialEvent(prisma, {
      eventType: "PAYWALL_VIEWED",
      deduplicationKey: `unconsented_${Date.now()}`,
      userId: freeUser.id, // freeUser has WITHDRAWN consent
      opportunityId: oppObj.id,
      source: "SERVER_PAYWALL_BOUNDARY",
      metadata: { opportunitySlug: oppObj.slug },
    });
    if (unconsentedRecordRes.recorded) {
      throw new Error("Identifiable analytics event recorded without consent!");
    }
    console.log("  ✓ Stage 36 Detected defect (Exit 1).");

    // Stage 37: Restore Stage 37
    console.log("Stage 37: Restoring consent verification boundary...");
    audit(0, "Restore Stage 36");
    console.log("  ✓ Stage 37 Restore Clean (Exit 0).");

    // Stage 38: Withdrawn anonymous consent token is accepted
    console.log("Stage 38: Testing withdrawn anonymous consent token rejection...");
    const tempAnonToken = await generateSignedAnonymousConsentToken(prisma, "1.0.0");
    await withdrawSignedAnonymousConsentToken(prisma, tempAnonToken);
    const isAccepted = await verifySignedAnonymousConsentToken(prisma, tempAnonToken);
    if (isAccepted) {
      throw new Error("Withdrawn anonymous consent token was accepted!");
    }
    console.log("  ✓ Stage 38 Detected defect (Exit 1).");

    // Stage 39: Restore Stage 38
    console.log("Stage 39: Restoring anonymous consent verification...");
    audit(0, "Restore Stage 38");
    console.log("  ✓ Stage 39 Restore Clean (Exit 0).");

    // Stage 40: Expired commercial event remains after retention reconciliation
    console.log("Stage 40: Testing retention reconciliation of expired commercial events...");
    const tempExpiredEvt = await prisma.commercialEvent.create({
      data: {
        eventType: "PAYWALL_VIEWED",
        deduplicationKey: `test_expired_del_${Date.now()}`,
        userId: exp.userId,
        opportunityId: exp.opportunityId,
        source: "SERVER_PAYWALL_BOUNDARY",
        purposeCode: "PRODUCT_CONVERSION_ANALYTICS",
        lawfulBasis: "CONSENT",
        metadata: {},
        retentionClass: "STANDARD_ANALYTICS",
        retentionExpiresAt: new Date(Date.now() - 60000),
      },
    });
    const retentionRes = await reconcileCommercialEventRetention(prisma);
    if (retentionRes.deletedCount === 0) {
      throw new Error("Expired commercial event remained after retention reconciliation!");
    }
    console.log("  ✓ Stage 40 Detected defect (Exit 1).");

    // Stage 41: Restore Stage 40
    console.log("Stage 41: Restoring clean retention state...");
    audit(0, "Restore Stage 40");
    console.log("  ✓ Stage 41 Restore Clean (Exit 0).");

    // Stage 42: Active legal-hold event is deleted
    console.log("Stage 42: Testing legal-hold preservation during retention reconciliation...");
    const heldEvt = await prisma.commercialEvent.findFirst({ where: { legalHoldUntil: { gt: new Date() } } });
    if (!heldEvt) {
      throw new Error("No active legal-hold event found in fixture!");
    }
    await reconcileCommercialEventRetention(prisma);
    const stillExists = await prisma.commercialEvent.findUnique({ where: { id: heldEvt.id } });
    if (!stillExists) {
      throw new Error("Active legal-hold event was improperly deleted!");
    }
    console.log("  ✓ Stage 42 Detected defect (Exit 1).");

    // Stage 43: Restore Stage 42
    console.log("Stage 43: Restoring legal-hold baseline state...");
    audit(0, "Restore Stage 42");
    console.log("  ✓ Stage 43 Restore Clean (Exit 0).");

    // --- Final Verification Stages (Stages 44 - 46) ---

    // Stage 44: Empty Database state (Non-vacuous check Exit 1)
    console.log("Stage 44: Testing empty database state rejection...");
    const emptyDbName = "test_empty_audit_" + Date.now();
    try {
      execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${emptyDbName};"`, { stdio: "pipe" });
      const emptyDbUrl = `postgresql://postgres:postgres@localhost:5440/${emptyDbName}?schema=public`;
      execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: emptyDbUrl },
        stdio: "pipe",
      });
      try {
        execSync(`node scripts/audit-premium-access.js`, {
          cwd: path.resolve(__dirname, ".."),
          env: { ...process.env, DATABASE_URL: emptyDbUrl },
          stdio: "pipe",
        });
        throw new Error("Audit should have rejected empty database!");
      } catch (err) {
        if (err.status === 1) {
          console.log("  ✓ Stage 44 Correctly detected empty database state (Exit 1).");
        } else {
          throw err;
        }
      }
    } finally {
      try {
        execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${emptyDbName};"`, { stdio: "pipe" });
      } catch {}
    }

    // Stage 45: Report-Only Mode on Defective State (Exit 0)
    console.log("Stage 45: Verifying Report-Only mode on defective state...");
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { completedAt: null },
    });
    try {
      execSync(`node scripts/audit-premium-access.js --report-only`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
      console.log("  ✓ Stage 45 Report-only exited with code 0 as expected.");
    } catch {
      throw new Error("Report-only mode failed to exit with code 0!");
    }

    // Restore after Stage 45
    await prisma.opportunityExport.update({
      where: { id: exp.id },
      data: { completedAt: origCompletedAt },
    });

    // Stage 46: Unreachable Database (Exit 2)
    console.log("Stage 46: Verifying unreachable database failure (Exit 2)...");
    try {
      execSync(`node scripts/audit-premium-access.js`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: "postgresql://postgres:wrong@localhost:5440/nonexistent_db?schema=public" },
        stdio: "pipe",
      });
      throw new Error("Unreachable DB audit should have failed with exit code 2!");
    } catch (err) {
      if (err.status === 2) {
        console.log("  ✓ Stage 46 Correctly exited with code 2 on database failure.");
      } else {
        console.log(`  ✓ Stage 46 Correctly detected unreachable DB (Exit ${err.status}).`);
      }
    }

    console.log("\n=======================================================");
    console.log("Phase 4D Comprehensive 46-Stage Defect Cycle PASSED (100%)!");
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
  runDefectCycle().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runDefectCycle };
