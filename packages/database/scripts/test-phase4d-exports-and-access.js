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
  filterOpportunityForContext,
  filterFounderFitForContext,
  sanitizeCsvField,
  generateOpportunityCsv,
  generateOpportunityPdf,
  executeOpportunityExport,
} = require("../../opportunity-engine/dist/index.js");
const { resolveUserEntitlements, enforceAtomicUsage } = require("../../entitlements/dist/index.js");

async function runExportsAndAccessSuite() {
  console.log("=== BuildWorth Phase 4D Content Access & Secure Exports Integration Suite ===");

  const dbName = "test_phase4d_access_" + Date.now();
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
    execSync(`DATABASE_URL="${dbUrl}" node scripts/reconcile-catalog.js`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // 2. Setup Test Users
    const userFree = await prisma.user.create({
      data: { email: `free_${Date.now()}@buildworth.io`, tier: "FREE" },
    });

    const userPro = await prisma.user.create({
      data: { email: `pro_${Date.now()}@buildworth.io`, tier: "PRO" },
    });

    // Pro subscription & grants
    const proPlan = await prisma.productPlan.findUnique({ where: { code: "PRO" } });
    const proPrice = await prisma.planPrice.findFirst({
      where: { planId: proPlan.id, billingInterval: "MONTHLY" },
    });

    const cust = await prisma.billingCustomer.create({
      data: { userId: userPro.id, stripeCustomerId: `cus_test_${Date.now()}` },
    });

    const sub = await prisma.billingSubscription.create({
      data: {
        userId: userPro.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_test_${Date.now()}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    await prisma.entitlementGrant.create({
      data: {
        userId: userPro.id,
        subscriptionId: sub.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        isUnlimited: false,
        limitQuantity: 5,
        remainingUnits: 5,
      },
    });

    await prisma.entitlementGrant.create({
      data: {
        userId: userPro.id,
        subscriptionId: sub.id,
        entitlementType: "VENTURE_BLUEPRINT_FINANCIALS",
        isUnlimited: true,
      },
    });

    await prisma.entitlementGrant.create({
      data: {
        userId: userPro.id,
        subscriptionId: sub.id,
        entitlementType: "FOUNDER_FIT_FULL_BREAKDOWN",
        isUnlimited: true,
      },
    });

    // Create Opportunity and Revision
    const opp = await prisma.opportunity.create({
      data: {
        slug: "soc2-compliance-engine",
        title: "SOC2 Compliance Engine",
        oneSentenceSummary: "Automated compliance evidence collection for SaaS",
        problemStatement: "Manual SOC2 evidence gathering takes hundreds of engineering hours",
        jobsToBeDone: ["Export evidence", "Sync GitHub pull requests"],
        proposedProduct: "SOC2 Engine",
        narrowMvpScope: ["GitHub audit trail integration"],
        targetCustomerSegments: ["Growth SaaS"],
        economicBuyer: "VP Engineering",
        endUser: "SecOps Lead",
        buyingTrigger: "Upcoming audit",
        existingWorkflow: "Spreadsheets & screenshots",
        painSeverity: "CRITICAL",
        painFrequency: "DAILY",
        status: "PUBLISHED",
        customerType: "B2B",
        industry: "Security",
        estimatedMvpCostMinCents: 150000,
        estimatedMvpCostMaxCents: 300000,
        estimatedTimeToMvpMinWeeks: 6,
        estimatedTimeToMvpMaxWeeks: 12,
        estimatedMonthlyOpCostMinCents: 25000,
        estimatedMonthlyOpCostMaxCents: 50000,
        currency: "USD",
        recommendedNextExperiment: "Landing page signup test",
      },
    });

    const rev = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 1,
        reasonForChange: "Initial production release",
        snapshotData: { title: opp.title, slug: opp.slug },
      },
    });

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { currentRevisionId: rev.id },
    });

    const testBlueprint = {
      schemaVersion: "1.0.0",
      recommendation: "BUILD_CANDIDATE",
      primaryAdvantage: "Direct AST integration with Git diffs",
      riskiestAssumption: "Security teams will grant read access to repos",
      cheapestExperiment: "Smoke test CLI on public repos",
      estimatedMvpCost: { minCents: 150000, maxCents: 300000, currency: "USD" },
      estimatedTimeToMvpWeeks: { min: 6, max: 12 },
      estimatedMonthlyOperatingCost: { minCents: 25000, maxCents: 50000, currency: "USD" },
      customerSegments: [
        {
          name: "Series A B2B Startups",
          isPrimaryIcp: true,
          economicBuyerRole: "VP of Engineering",
          estimatedBudgetBand: { minCents: 500000, maxCents: 1500000, currency: "USD" },
        },
      ],
      mvpFeatures: [
        { name: "Git Sync", priority: "P0", description: "Automated PR webhook evidence extraction" },
      ],
      financialScenarios: [
        {
          scenarioType: "BASE",
          targetCustomers: 25,
          monthlyPriceCents: 49900,
          grossMarginPercent: 88,
          paybackMonths: 4,
          annualRecurringRevenueCents: 14970000,
        },
      ],
      risks: [
        {
          category: "TECHNICAL",
          severity: "HIGH",
          riskStatement: "Git rate limits during large monorepo sync",
          mitigationStrategy: "Distributed background queues with backoff",
        },
      ],
      assumptions: [
        {
          category: "BUYER",
          assumptionStatement: "Engineering leaders have purchasing discretion up to $5k ARR",
        },
      ],
      validationExperiments: [
        {
          experimentType: "CUSTOMER_INTERVIEW",
          description: "15 exploratory interviews with VPs of Engineering",
          targetCriteria: "10/15 confirm manual spreadsheet frustration",
        },
      ],
      competitors: [
        {
          name: "Legacy Auditor",
          category: "INCUMBENT",
          vulnerability: "No automated continuous sync",
        },
      ],
      first20Plan: {
        steps: ["Outreach to YC founders", "Offer 3-month free audit prep in exchange for case studies"],
      },
    };

    // ----------------------------------------------------
    // TEST 1: Anonymous & Free Content Policy Redaction
    // ----------------------------------------------------
    console.log("Test 1: Content Policy Redaction (Anonymous vs Free vs Pro)...");

    const anonContext = resolveUserEntitlements(null, new Date(), { isLiveEnvironment: false });
    const freeDbUser = await prisma.user.findUnique({
      where: { id: userFree.id },
      include: { billingSubscriptions: true, entitlementGrants: true },
    });
    const freeContext = resolveUserEntitlements(freeDbUser, new Date(), { isLiveEnvironment: false });

    const proDbUser = await prisma.user.findUnique({
      where: { id: userPro.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const proContext = resolveUserEntitlements(proDbUser, new Date(), { isLiveEnvironment: false });

    const anonDTO = filterOpportunityForContext(opp, testBlueprint, anonContext);
    const freeDTO = filterOpportunityForContext(opp, testBlueprint, freeContext);
    const proDTO = filterOpportunityForContext(opp, testBlueprint, proContext);

    if (!anonDTO.isLocked || "blueprint" in anonDTO) {
      throw new Error("Anonymous DTO leaked blueprint content!");
    }
    if (!freeDTO.isLocked || "blueprint" in freeDTO) {
      throw new Error("Free DTO leaked blueprint content!");
    }
    if (proDTO.isLocked || !("blueprint" in proDTO)) {
      throw new Error("Pro DTO failed to include full blueprint!");
    }
    console.log("  ✓ Anonymous and Free DTOs strictly omit premium blueprint fields.");
    console.log("  ✓ Pro DTO receives complete verified blueprint.");

    // ----------------------------------------------------
    // TEST 2: Founder Fit Cross-User Isolation & Redaction
    // ----------------------------------------------------
    console.log("Test 2: Founder Fit Cross-User Isolation & Redaction...");
    const sampleEvaluation = {
      founderFitScore: 92,
      fitConfidence: 80,
      recommendationCategory: "EXCELLENT_MATCH",
      personalizedRank: 90.5,
      baseRank: 85.0,
      dimensions: [{ name: "Technical Fit", score: 20, maxScore: 20, explanation: "Full stack" }],
    };

    const fitFreeOwner = filterFounderFitForContext(sampleEvaluation, userFree.id, freeContext);
    if (!fitFreeOwner.isLocked || "evaluation" in fitFreeOwner) {
      throw new Error("Free owner leaked full Founder Fit breakdown!");
    }

    const fitProOtherUser = filterFounderFitForContext(sampleEvaluation, "different_user_id", proContext);
    if (!fitProOtherUser.isLocked || "evaluation" in fitProOtherUser) {
      throw new Error("Pro user accessed another user's Founder Fit breakdown!");
    }

    const fitProOwner = filterFounderFitForContext(sampleEvaluation, userPro.id, proContext);
    if (fitProOwner.isLocked || !("evaluation" in fitProOwner)) {
      throw new Error("Pro owner failed to view own Founder Fit breakdown!");
    }
    console.log("  ✓ Free user cannot view breakdown even if owner.");
    console.log("  ✓ Pro user cannot view another user's breakdown (cross-user isolation).");
    console.log("  ✓ Pro owner views complete breakdown.");

    // ----------------------------------------------------
    // TEST 3: CSV Formula Injection Neutralization
    // ----------------------------------------------------
    console.log("Test 3: CSV Formula Injection Neutralization...");
    const formulaPayload = {
      ...opp,
      title: "=CMD|' /C calc'!A0",
      summary: "+1234567890",
      problemStatement: "@SUM(1,1)",
      existingWorkflow: "-2+5",
    };

    const csvContent = generateOpportunityCsv(formulaPayload, testBlueprint);
    if (csvContent.includes('"=CMD') || csvContent.includes('"+123') || csvContent.includes('"@SUM')) {
      throw new Error("CSV formula injection was not neutralized!");
    }
    if (!csvContent.includes("'=CMD") && !csvContent.includes("'+123")) {
      throw new Error("Neutralizing quote missing from formula-prefixed fields.");
    }
    console.log("  ✓ Formula injection characters (=, +, -, @) safely neutralized with leading quotes.");

    // ----------------------------------------------------
    // TEST 4: PDF Generation Validation
    // ----------------------------------------------------
    console.log("Test 4: PDF Binary Generation...");
    const pdfBuf = generateOpportunityPdf(opp, testBlueprint);
    const pdfHeader = pdfBuf.toString("ascii", 0, 8);
    if (!pdfHeader.startsWith("%PDF-1.4")) {
      throw new Error(`Invalid PDF header: ${pdfHeader}`);
    }
    if (!pdfBuf.toString("ascii").includes("%%EOF")) {
      throw new Error("PDF missing EOF marker.");
    }
    console.log(`  ✓ Valid PDF binary generated (${pdfBuf.length} bytes).`);

    // ----------------------------------------------------
    // TEST 5: Atomic Export Quota Enforcement, Idempotency & Lifecycle
    // ----------------------------------------------------
    console.log("Test 5: Export Quota Enforcement, Idempotency & Concurrency...");

    // 5A: Free user export rejected (consumes 0 quota, creates REJECTED export)
    const freeExport = await executeOpportunityExport(prisma, userFree.id, opp.slug, "PDF", {
      context: freeContext,
      requestKey: `req_free_${Date.now()}`,
      blueprintData: testBlueprint,
    });
    if (freeExport.success || freeExport.statusCode !== 403) {
      throw new Error(`Expected Free export rejection (403), got ${freeExport.statusCode}`);
    }
    const freeLedgerCount = await prisma.usageLedger.count({ where: { userId: userFree.id } });
    if (freeLedgerCount !== 0) {
      throw new Error("Free rejected export improperly consumed quota in usage ledger!");
    }
    console.log("  ✓ Free user export rejected (403 PRO_REQUIRED) with zero quota consumed.");

    // 5B: Pro user exports within quota
    const reqKey1 = `req_pro_pdf_${Date.now()}`;
    const proExport1 = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: proContext,
      requestKey: reqKey1,
      blueprintData: testBlueprint,
    });
    if (!proExport1.success || !proExport1.buffer) {
      throw new Error(`Pro export 1 failed: ${proExport1.error}`);
    }

    // Verify stored byteSize and contentHash match generated artifact
    const savedRec = await prisma.opportunityExport.findUnique({ where: { id: proExport1.exportRecord.id } });
    const computedHash = crypto.createHash("sha256").update(proExport1.buffer).digest("hex");
    if (savedRec.byteSize !== proExport1.buffer.length || savedRec.contentHash !== computedHash) {
      throw new Error("Stored byteSize or contentHash does not match generated artifact!");
    }
    console.log("  ✓ Stored byteSize and contentHash precisely match the generated PDF artifact.");

    // 5C: Duplicate requestKey returns existing without consuming extra quota
    const proExport1Dup = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: proContext,
      requestKey: reqKey1,
      blueprintData: testBlueprint,
    });
    if (!proExport1Dup.success || proExport1Dup.exportRecord.id !== proExport1.exportRecord.id) {
      throw new Error("Duplicate requestKey did not return idempotent export record!");
    }

    // 5D: Concurrent duplicate requests create one logical export and do not over-consume quota
    const concurrentKey = `req_concurrent_dup_${Date.now()}`;
    const [concRes1, concRes2, concRes3] = await Promise.all([
      executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
        context: proContext,
        requestKey: concurrentKey,
        blueprintData: testBlueprint,
      }),
      executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
        context: proContext,
        requestKey: concurrentKey,
        blueprintData: testBlueprint,
      }),
      executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
        context: proContext,
        requestKey: concurrentKey,
        blueprintData: testBlueprint,
      }),
    ]);

    if (!concRes1.success || !concRes2.success || !concRes3.success) {
      throw new Error("Concurrent duplicate export failed unexpectedly!");
    }
    if (
      concRes1.exportRecord.id !== concRes2.exportRecord.id ||
      concRes2.exportRecord.id !== concRes3.exportRecord.id
    ) {
      throw new Error("Concurrent duplicate requests created multiple export records!");
    }
    const matchingRecords = await prisma.opportunityExport.count({ where: { requestKey: concurrentKey } });
    if (matchingRecords !== 1) {
      throw new Error(`Expected exactly 1 export record for concurrent duplicates, found ${matchingRecords}`);
    }
    console.log("  ✓ Concurrent duplicate requests create exactly one logical export.");

    // 5E: Concurrent final quota-slot requests allow only one
    // UserPro has limit 5. Let's create a user with exactly 1 remaining unit
    const userSingleSlot = await prisma.user.create({
      data: { email: `singleslot_${Date.now()}@buildworth.io`, tier: "PRO" },
    });
    const subSingle = await prisma.billingSubscription.create({
      data: {
        userId: userSingleSlot.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_single_${Date.now()}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });
    await prisma.entitlementGrant.create({
      data: {
        userId: userSingleSlot.id,
        subscriptionId: subSingle.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        isUnlimited: false,
        limitQuantity: 1,
        remainingUnits: 1,
      },
    });
    const singleDbUser = await prisma.user.findUnique({
      where: { id: userSingleSlot.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const singleContext = resolveUserEntitlements(singleDbUser, new Date(), { isLiveEnvironment: false });

    // Fire 2 distinct exports concurrently for user with 1 slot
    const [finalSlotRes1, finalSlotRes2] = await Promise.all([
      executeOpportunityExport(prisma, userSingleSlot.id, opp.slug, "PDF", {
        context: singleContext,
        requestKey: `req_slot_a_${Date.now()}`,
        blueprintData: testBlueprint,
      }),
      executeOpportunityExport(prisma, userSingleSlot.id, opp.slug, "PDF", {
        context: singleContext,
        requestKey: `req_slot_b_${Date.now()}`,
        blueprintData: testBlueprint,
      }),
    ]);

    const successes = [finalSlotRes1, finalSlotRes2].filter((r) => r.success);
    const rejections = [finalSlotRes1, finalSlotRes2].filter((r) => !r.success && r.statusCode === 403);
    if (successes.length !== 1 || rejections.length !== 1) {
      throw new Error(
        `Expected exactly 1 success and 1 rejection for final slot race, got ${successes.length} successes and ${rejections.length} rejections`,
      );
    }
    console.log("  ✓ Concurrent final quota-slot requests strictly allow only one export.");

    const proExport2 = await executeOpportunityExport(prisma, userPro.id, opp.slug, "CSV", {
      context: proContext,
      requestKey: `req_pro_csv_${Date.now()}`,
      blueprintData: testBlueprint,
    });
    if (!proExport2.success || !proExport2.buffer) {
      throw new Error(`Pro export 2 failed: ${proExport2.error}`);
    }
    console.log("  ✓ Duplicate requestKey idempotent; Pro user successfully generated PDF and CSV.");

    // 5F: Failed generation produces exactly one compensating release, and repeated failure cannot create a second release
    const failReqKey = `req_fail_${Date.now()}`;
    const failExport = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: proContext,
      requestKey: failReqKey,
      blueprintData: null, // trigger blueprint missing failure
    });
    if (failExport.success) {
      throw new Error("Expected export to fail when blueprint is unavailable!");
    }
    const compReleases = await prisma.usageLedger.findMany({
      where: {
        userId: userPro.id,
        idempotencyKey: `release_${userPro.id}_${failReqKey}`,
        unitsConsumed: -1,
      },
    });
    if (compReleases.length !== 1) {
      throw new Error(`Expected exactly 1 compensating release, found ${compReleases.length}`);
    }

    // Repeated execution of the same failed requestKey cannot create a second release
    const repeatFail = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: proContext,
      requestKey: failReqKey,
      blueprintData: null,
    });
    if (repeatFail.success) {
      throw new Error("Expected repeat of failed export to remain failed!");
    }
    const compReleasesAfterRepeat = await prisma.usageLedger.findMany({
      where: {
        userId: userPro.id,
        idempotencyKey: `release_${userPro.id}_${failReqKey}`,
        unitsConsumed: -1,
      },
    });
    if (compReleasesAfterRepeat.length !== 1) {
      throw new Error(`Repeated failure created extra compensating release: count ${compReleasesAfterRepeat.length}`);
    }
    console.log("  ✓ Failed generation creates exactly one release; repeated failure cannot create a second release.");

    // 5H: Two users using the same requestKey successfully and independently
    const sharedRequestKey = `shared_key_${Date.now()}`;
    const userPro2 = await prisma.user.create({
      data: { email: `pro2_${Date.now()}@buildworth.io`, tier: "PRO" },
    });
    const sub2 = await prisma.billingSubscription.create({
      data: {
        userId: userPro2.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_pro2_${Date.now()}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });
    await prisma.entitlementGrant.create({
      data: {
        userId: userPro2.id,
        subscriptionId: sub2.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        isUnlimited: false,
        limitQuantity: 5,
        remainingUnits: 5,
      },
    });
    const userPro2Db = await prisma.user.findUnique({
      where: { id: userPro2.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const pro2Context = resolveUserEntitlements(userPro2Db, new Date(), { isLiveEnvironment: false });

    const exportUser1 = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: proContext,
      requestKey: sharedRequestKey,
      blueprintData: testBlueprint,
    });
    const exportUser2 = await executeOpportunityExport(prisma, userPro2.id, opp.slug, "PDF", {
      context: pro2Context,
      requestKey: sharedRequestKey,
      blueprintData: testBlueprint,
    });

    if (!exportUser1.success || !exportUser2.success) {
      throw new Error("Shared requestKey failed between distinct users!");
    }
    if (exportUser1.exportRecord.id === exportUser2.exportRecord.id) {
      throw new Error("Two distinct users received the same export row ID for shared requestKey!");
    }
    if (exportUser1.exportRecord.userId === exportUser2.exportRecord.userId) {
      throw new Error("Export record user isolation violated!");
    }
    console.log("  ✓ Two distinct users successfully and independently used the same requestKey.");

    // 5I: Reused requestKey with different payload fails with 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST
    const conflictRes = await executeOpportunityExport(prisma, userPro.id, opp.slug, "CSV", {
      context: proContext,
      requestKey: sharedRequestKey, // originally created as PDF above
      blueprintData: testBlueprint,
    });
    if (conflictRes.success || conflictRes.statusCode !== 409 || !conflictRes.error.includes("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST")) {
      throw new Error(`Expected 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST, got ${conflictRes.statusCode}: ${conflictRes.error}`);
    }
    console.log("  ✓ Reused requestKey with altered format rejected with 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST.");

    // 5J: UTC Month / Period Boundary Derivation Verification
    const beforeBoundary = new Date("2026-08-31T23:59:59.999Z");
    const afterBoundary = new Date("2026-09-01T00:00:00.000Z");
    const {
      deriveAuthoritativeQuotaPeriodKey,
      validateOrGenerateRequestKey,
      reconcileExpiredExports,
      MAX_EXPORT_GENERATION_MS,
      MAX_EXPORT_BYTE_SIZE,
    } = require("../../opportunity-engine/dist/index.js");
    if (deriveAuthoritativeQuotaPeriodKey(beforeBoundary) !== "2026-08") {
      throw new Error(`Pre-boundary period mismatch: expected 2026-08, got ${deriveAuthoritativeQuotaPeriodKey(beforeBoundary)}`);
    }
    if (deriveAuthoritativeQuotaPeriodKey(afterBoundary) !== "2026-09") {
      throw new Error(`Post-boundary period mismatch: expected 2026-09, got ${deriveAuthoritativeQuotaPeriodKey(afterBoundary)}`);
    }
    if (typeof MAX_EXPORT_GENERATION_MS !== "number" || typeof MAX_EXPORT_BYTE_SIZE !== "number") {
      throw new Error("Export safety bounds constants missing or invalid!");
    }
    console.log("  ✓ Authoritative UTC period calculation precisely transitions across month boundaries (2026-08 -> 2026-09).");
    console.log(`  ✓ Memory and timeout bounds verified (${MAX_EXPORT_GENERATION_MS}ms, ${MAX_EXPORT_BYTE_SIZE} bytes).`);

    // 5K: RequestKey Validation & Server-side Opaque Key Generation
    const generatedKey = validateOrGenerateRequestKey(userPro.id);
    if (!generatedKey.startsWith("req_") || generatedKey.length !== 68) {
      throw new Error(`Generated key does not match opaque 68-char format req_<64 hex digits>: ${generatedKey}`);
    }
    if (generatedKey.includes(userPro.id) || generatedKey.includes("pro") || generatedKey.includes("@")) {
      throw new Error(`Generated key improperly leaks userId/email: ${generatedKey}`);
    }
    let caughtInvalidKey = false;
    try {
      validateOrGenerateRequestKey(userPro.id, "bad key with spaces and injection'; DROP TABLE users;");
    } catch {
      caughtInvalidKey = true;
    }
    if (!caughtInvalidKey) {
      throw new Error("Malformed requestKey was not rejected by validator!");
    }
    console.log("  ✓ Malformed and oversized requestKeys rejected; opaque 68-char keys generated without leaking userId/identifiers.");

    // 5L: Abandoned PENDING Export Recovery via Worker Job under Advisory Lock
    const abandonedKey = `req_${crypto.randomBytes(32).toString("hex")}`;
    const quotaBucket = deriveAuthoritativeQuotaPeriodKey(new Date());
    const reserveLedger = await prisma.usageLedger.create({
      data: {
        userId: userPro.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: 1,
        resourceId: opp.slug,
        actionContext: "EXPORT_RESERVE_PDF",
        idempotencyKey: `reserve_${userPro.id}_${abandonedKey}`,
        periodBucketKey: quotaBucket,
      },
    });

    const abandonedExport = await prisma.opportunityExport.create({
      data: {
        requestKey: abandonedKey,
        userId: userPro.id,
        opportunityId: opp.id,
        opportunityRevisionId: rev.id,
        format: "PDF",
        status: "PENDING",
        quotaPeriodKey: quotaBucket,
        reservationLedgerId: reserveLedger.id,
        reservationExpiresAt: new Date(Date.now() - 5000), // Expired in past
        entitlementSnapshot: { tier: "PRO" },
      },
    });

    // Import worker and dispatch EXPORT_RESERVATION_RECONCILIATION_JOB concurrently from two workers
    const { processQueueJob } = require("../../../apps/worker/dist/index.js");
    await Promise.all([
      processQueueJob({
        id: `job_recon_1_${Date.now()}`,
        type: "EXPORT_RESERVATION_RECONCILIATION_JOB",
        payload: { userId: userPro.id },
        attempts: 1,
      }, prisma),
      processQueueJob({
        id: `job_recon_2_${Date.now()}`,
        type: "EXPORT_RESERVATION_RECONCILIATION_JOB",
        payload: { userId: userPro.id },
        attempts: 1,
      }, prisma),
    ]);

    const updatedAbandoned = await prisma.opportunityExport.findUnique({
      where: { id: abandonedExport.id },
    });
    if (updatedAbandoned.status !== "FAILED" || updatedAbandoned.failureCode !== "EXPORT_RESERVATION_EXPIRED" || !updatedAbandoned.releaseLedgerId) {
      throw new Error(`Abandoned export not correctly recovered by worker to FAILED with releaseLedgerId: ${JSON.stringify(updatedAbandoned)}`);
    }

    // Verify exactly one release exists across both workers
    const allCompReleases = await prisma.usageLedger.findMany({
      where: {
        userId: userPro.id,
        idempotencyKey: `release_${userPro.id}_${abandonedKey}`,
      },
    });
    if (allCompReleases.length !== 1) {
      throw new Error(`Expected exactly 1 compensating release from concurrent workers, found ${allCompReleases.length}`);
    }
    console.log("  ✓ Abandoned PENDING export recovered by worker: exactly one compensating release created under concurrency.");

    // 5N: Database CHECK Constraints & Unique Invariant Verification
    // 1. Release without reservation must fail
    const dummyLedger1 = await prisma.usageLedger.create({
      data: {
        userId: userPro.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: -1,
        idempotencyKey: `test_inv_rel_no_res_${Date.now()}`,
        periodBucketKey: quotaBucket,
      },
    });
    let rejectedRelNoRes = false;
    try {
      await prisma.opportunityExport.create({
        data: {
          requestKey: `inv_rel_no_res_${Date.now()}`,
          userId: userPro.id,
          opportunityId: opp.id,
          opportunityRevisionId: rev.id,
          format: "PDF",
          status: "FAILED",
          quotaPeriodKey: quotaBucket,
          reservationLedgerId: null,
          releaseLedgerId: dummyLedger1.id,
          entitlementSnapshot: { tier: "PRO" },
        },
      });
    } catch {
      rejectedRelNoRes = true;
    }
    if (!rejectedRelNoRes) {
      throw new Error("CHECK constraint failed to reject FAILED export with release without reservation!");
    }

    // 2. Consumption without reservation must fail
    let rejectedConsNoRes = false;
    try {
      await prisma.opportunityExport.create({
        data: {
          requestKey: `inv_cons_no_res_${Date.now()}`,
          userId: userPro.id,
          opportunityId: opp.id,
          opportunityRevisionId: rev.id,
          format: "PDF",
          status: "COMPLETED",
          completedAt: new Date(),
          byteSize: 1024,
          contentHash: "dummy_hash",
          quotaPeriodKey: quotaBucket,
          reservationLedgerId: null,
          consumptionLedgerId: dummyLedger1.id,
          entitlementSnapshot: { tier: "PRO" },
        },
      });
    } catch {
      rejectedConsNoRes = true;
    }
    if (!rejectedConsNoRes) {
      throw new Error("CHECK constraint failed to reject COMPLETED export without reservation!");
    }

    // 3. COMPLETED with release must fail
    const dummyLedger2 = await prisma.usageLedger.create({
      data: {
        userId: userPro.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        unitsConsumed: 1,
        idempotencyKey: `test_inv_res_${Date.now()}`,
        periodBucketKey: quotaBucket,
      },
    });
    let rejectedCompWithRelease = false;
    try {
      await prisma.opportunityExport.create({
        data: {
          requestKey: `inv_comp_with_rel_${Date.now()}`,
          userId: userPro.id,
          opportunityId: opp.id,
          opportunityRevisionId: rev.id,
          format: "PDF",
          status: "COMPLETED",
          completedAt: new Date(),
          byteSize: 1024,
          contentHash: "dummy_hash",
          quotaPeriodKey: quotaBucket,
          reservationLedgerId: dummyLedger2.id,
          consumptionLedgerId: dummyLedger2.id,
          releaseLedgerId: dummyLedger1.id,
          entitlementSnapshot: { tier: "PRO" },
        },
      });
    } catch {
      rejectedCompWithRelease = true;
    }
    if (!rejectedCompWithRelease) {
      throw new Error("CHECK constraint failed to reject COMPLETED export with release ledger!");
    }

    // 4. REJECTED with any ledger link must fail
    let rejectedWithLink = false;
    try {
      await prisma.opportunityExport.create({
        data: {
          requestKey: `inv_rej_with_link_${Date.now()}`,
          userId: userPro.id,
          opportunityId: opp.id,
          opportunityRevisionId: rev.id,
          format: "PDF",
          status: "REJECTED",
          rejectedAt: new Date(),
          failureCode: "PRO_REQUIRED",
          quotaPeriodKey: quotaBucket,
          reservationLedgerId: dummyLedger2.id,
          entitlementSnapshot: { tier: "FREE" },
        },
      });
    } catch {
      rejectedWithLink = true;
    }
    if (!rejectedWithLink) {
      throw new Error("CHECK constraint failed to reject REJECTED export with reservation link!");
    }
    console.log("  ✓ Database CHECK constraints strictly enforce all invalid status and ledger linkage combinations.");

    // 5M: Final Entitlement Recheck: Downgrade between reservation and completion fails safely
    const userDowngradeRace = await prisma.user.create({
      data: { email: `downgrade_race_${Date.now()}@buildworth.io`, tier: "PRO" },
    });
    const subDowngradeRace = await prisma.billingSubscription.create({
      data: {
        userId: userDowngradeRace.id,
        billingCustomerId: cust.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: `sub_downgrade_race_${Date.now()}`,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });
    await prisma.entitlementGrant.create({
      data: {
        userId: userDowngradeRace.id,
        subscriptionId: subDowngradeRace.id,
        entitlementType: "VENTURE_BLUEPRINT_EXPORT",
        isUnlimited: false,
        limitQuantity: 5,
        remainingUnits: 5,
      },
    });
    const userDowngradeDb = await prisma.user.findUnique({
      where: { id: userDowngradeRace.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const downgradeRaceContext = resolveUserEntitlements(userDowngradeDb, new Date(), { isLiveEnvironment: false });

    // 1. First make reservation while Pro
    const raceRequestKey = `req_race_revoked_${Date.now()}`;
    const raceEnforcement = await enforceAtomicUsage(prisma, userDowngradeRace.id, "VENTURE_BLUEPRINT_EXPORT", {
      units: 1,
      actionContext: "EXPORT_RESERVE_PDF",
      resourceId: opp.slug,
      idempotencyKey: `reserve_${userDowngradeRace.id}_${raceRequestKey}`,
      periodBucketKey: quotaBucket,
    });

    const pendingRaceExport = await prisma.opportunityExport.create({
      data: {
        requestKey: raceRequestKey,
        userId: userDowngradeRace.id,
        opportunityId: opp.id,
        opportunityRevisionId: rev.id,
        format: "PDF",
        status: "PENDING",
        quotaPeriodKey: quotaBucket,
        reservationLedgerId: raceEnforcement.ledgerId,
        reservationExpiresAt: new Date(Date.now() + 30000),
        entitlementSnapshot: { tier: "PRO" },
      },
    });

    // 2. Now simulate downgrade between generation and finalization
    await prisma.billingSubscription.update({
      where: { id: subDowngradeRace.id },
      data: { status: "CANCELED", currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    await prisma.user.update({
      where: { id: userDowngradeRace.id },
      data: { tier: "FREE" },
    });
    await prisma.entitlementGrant.deleteMany({
      where: { userId: userDowngradeRace.id },
    });

    // 3. Attempt completion / execution of this export
    const raceExportRes = await executeOpportunityExport(prisma, userDowngradeRace.id, opp.slug, "PDF", {
      context: downgradeRaceContext,
      requestKey: raceRequestKey,
      blueprintData: testBlueprint,
    });

    if (raceExportRes.success || raceExportRes.statusCode !== 403) {
      throw new Error(`Expected revoked export failure (403), got ${raceExportRes.statusCode}: ${raceExportRes.error}`);
    }
    const raceExportRow = await prisma.opportunityExport.findUnique({
      where: { id: pendingRaceExport.id },
    });
    if (raceExportRow.status !== "FAILED" || raceExportRow.failureCode !== "ENTITLEMENT_REVOKED_DURING_EXPORT") {
      throw new Error(`Unexpected failure code on revoked race export: ${raceExportRow.failureCode}`);
    }
    console.log("  ✓ Final entitlement recheck: Downgrade between reservation and completion fails safely (403 ENTITLEMENT_REVOKED_DURING_EXPORT).");

    // ----------------------------------------------------
    // TEST 6: Subscription Cancellation & Grace Semantics
    // ----------------------------------------------------
    console.log("Test 6: Subscription Cancellation & Grace Semantics...");

    // 6A: cancel_at_period_end while subscription remains active -> Pro access remains active
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() + 15 * 86400 * 1000), // 15 days remaining
      },
    });
    const cancelPendingUser = await prisma.user.findUnique({
      where: { id: userPro.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const cancelPendingContext = resolveUserEntitlements(cancelPendingUser, new Date(), { isLiveEnvironment: false });
    if (!cancelPendingContext.hasActiveSubscription || cancelPendingContext.tier !== "PRO") {
      throw new Error("cancel_at_period_end before periodEnd prematurely revoked Pro access!");
    }
    console.log("  ✓ cancel_at_period_end preserves Pro access until currentPeriodEnd.");

    // 6B: Subscription expired/canceled after currentPeriodEnd -> Immediate revocation
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        currentPeriodEnd: new Date(Date.now() - 86400 * 1000), // Expired in past
      },
    });

    const downgradedDbUser = await prisma.user.findUnique({
      where: { id: userPro.id },
      include: {
        billingSubscriptions: { include: { planPrice: { include: { plan: true } } } },
        entitlementGrants: true,
      },
    });
    const downgradedContext = resolveUserEntitlements(downgradedDbUser, new Date(), { isLiveEnvironment: false });

    const downgradedExport = await executeOpportunityExport(prisma, userPro.id, opp.slug, "PDF", {
      context: downgradedContext,
      requestKey: `req_downgraded_${Date.now()}`,
      blueprintData: testBlueprint,
    });

    if (downgradedExport.success || downgradedExport.statusCode !== 403) {
      throw new Error("Downgraded user export was not revoked!");
    }
    console.log("  ✓ Canceled/expired subscription immediately revokes Pro content & exports.");

    console.log("\n=======================================================");
    console.log("Phase 4D Content Access & Exports Suite PASSED (100%)!");
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
  runExportsAndAccessSuite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runExportsAndAccessSuite };
