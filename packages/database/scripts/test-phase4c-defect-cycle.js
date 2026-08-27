const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runDefectCycle() {
  console.log("=== BuildWorth Phase 4C Comprehensive 25-Stage Radar Defect Cycle ===");

  const dbName = "test_phase4c_defect_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // Deploy all migrations
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Seed test baseline fixtures
    const userFree = await prisma.user.create({
      data: { email: `defect_free_${Date.now()}@example.com`, tier: "FREE" },
    });
    const userPro = await prisma.user.create({
      data: { email: `defect_pro_${Date.now()}@example.com`, tier: "PRO" },
    });

    const opp = await prisma.opportunity.create({
      data: {
        slug: `opp-defect-${Date.now()}`,
        title: "Defect Cycle Opp",
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
        snapshotData: { status: "HYPOTHESIS" },
        reasonForChange: "Initial revision",
      },
    });

    const rev2 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 2,
        snapshotData: { status: "VERIFIED" },
        reasonForChange: "Validation verified",
      },
    });

    const rev3 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 3,
        snapshotData: { status: "VERIFIED", price: 2900 },
        reasonForChange: "Pricing update",
      },
    });

    const job1 = await prisma.opportunityRadarJob.create({
      data: { opportunityRevisionId: rev1.id, status: "COMPLETED", completedAt: new Date() },
    });
    const job2 = await prisma.opportunityRadarJob.create({
      data: { opportunityRevisionId: rev2.id, status: "COMPLETED", completedAt: new Date() },
    });

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

    const outboxFreeWeekly = await prisma.notificationOutbox.create({
      data: {
        userId: userFree.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        radarEvaluationId: evalFree.id,
        notificationType: "RADAR_WEEKLY_DIGEST",
        channel: "EMAIL",
        status: "PENDING",
        attemptCount: 1,
        deduplicationKey: `dedupe_free_weekly_${Date.now()}`,
        sanitizedPayload: { title: "Weekly Digest" },
      },
    });
    const keyFree = `idemp_${crypto.createHash("sha256").update(`${outboxFreeWeekly.id}:${outboxFreeWeekly.deduplicationKey}`).digest("hex").slice(0, 24)}`;
    await prisma.notificationDelivery.create({
      data: {
        outboxId: outboxFreeWeekly.id,
        attemptNumber: 1,
        provider: "TEST_MOCK",
        providerIdempotencyKey: keyFree,
        status: "FAILED",
        attemptedAt: new Date(),
        sanitizedError: "Transient timeout",
      },
    });

    const outboxProInstant = await prisma.notificationOutbox.create({
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
        deduplicationKey: `dedupe_pro_instant_${Date.now()}`,
        sanitizedPayload: { title: "Instant Alert" },
      },
    });
    const keyProInstant = `idemp_${crypto.createHash("sha256").update(`${outboxProInstant.id}:${outboxProInstant.deduplicationKey}`).digest("hex").slice(0, 24)}`;
    await prisma.notificationDelivery.create({
      data: {
        outboxId: outboxProInstant.id,
        attemptNumber: 1,
        provider: "TEST_MOCK",
        providerIdempotencyKey: keyProInstant,
        providerMessageId: keyProInstant,
        status: "SUCCESS",
        attemptedAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    const outboxProDaily = await prisma.notificationOutbox.create({
      data: {
        userId: userPro.id,
        opportunityId: opp.id,
        changeEventId: changeEvent2.id,
        radarEvaluationId: evalPro.id,
        notificationType: "RADAR_DAILY_DIGEST",
        channel: "EMAIL",
        status: "DEAD_LETTER",
        attemptCount: 5,
        sanitizedLastError: "DEAD_LETTER_EXHAUSTED_ATTEMPTS: Max attempts reached",
        deduplicationKey: `dedupe_pro_daily_deadletter_${Date.now()}`,
        sanitizedPayload: { title: "Daily Digest" },
      },
    });
    const keyProDaily = `idemp_${crypto.createHash("sha256").update(`${outboxProDaily.id}:${outboxProDaily.deduplicationKey}`).digest("hex").slice(0, 24)}`;
    for (let i = 1; i <= 5; i++) {
      await prisma.notificationDelivery.create({
        data: {
          outboxId: outboxProDaily.id,
          attemptNumber: i,
          provider: "TEST_MOCK",
          providerIdempotencyKey: keyProDaily,
          status: "FAILED",
          attemptedAt: new Date(2026, 0, i),
          sanitizedError: `Err ${i}`,
        },
      });
    }

    // Helper runner
    function runAudit() {
      return execSync("node scripts/audit-radar.js", {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
    }

    // --- STAGE 1: Clean Baseline Audit (Exit 0) ---
    console.log("Stage 1: Clean populated baseline audit...");
    runAudit();
    console.log("  ✓ Stage 1 Passed (Exit 0).");

    // --- STAGE 2: Non-consecutive revision defect (Rev 1 -> Rev 3) (Exit 1) ---
    console.log("Stage 2: Injecting non-consecutive revision defect...");
    const rev4 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 4,
        snapshotData: {},
        reasonForChange: "Rev 4",
      },
    });
    const badRevDiff = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev1.id,
        toRevisionId: rev4.id,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        overallSeverity: "HIGH",
        items: {
          create: [
            {
              dimension: "PUBLICATION_STATUS",
              reasonCode: "STATUS_CHANGE",
              sanitizedSummary: "Bad diff",
              beforeValue: "H",
              afterValue: "V",
            },
          ],
        },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 2 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 2 Detected defect (Exit 1).");

    // --- STAGE 3: Restore after Stage 2 (Exit 0) ---
    console.log("Stage 3: Restoring from Stage 2...");
    await prisma.opportunityChangeEvent.delete({ where: { id: badRevDiff.id } });
    runAudit();
    console.log("  ✓ Stage 3 Restore Clean (Exit 0).");

    // --- STAGE 4: Canonical hash corruption (Exit 1) ---
    console.log("Stage 4: Injecting canonical hash corruption...");
    const corruptHashEv = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev3.id,
        toRevisionId: rev4.id,
        canonicalInputHash: "short_bad_hash",
        overallSeverity: "LOW",
        items: {
          create: [
            {
              dimension: "PRICING",
              reasonCode: "PRICE_CHANGE",
              sanitizedSummary: "Price update",
              beforeValue: 10,
              afterValue: 20,
            },
          ],
        },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 4 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 4 Detected defect (Exit 1).");

    // --- STAGE 5: Restore after Stage 4 (Exit 0) ---
    console.log("Stage 5: Restoring from Stage 4...");
    await prisma.opportunityChangeEvent.delete({ where: { id: corruptHashEv.id } });
    runAudit();
    console.log("  ✓ Stage 5 Restore Clean (Exit 0).");

    // --- STAGE 6: User profile injected into global event (Exit 1) ---
    console.log("Stage 6: Injecting user profile data into global change event...");
    const corruptUserDataEv = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev3.id,
        toRevisionId: rev4.id,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        overallSeverity: "LOW",
        items: {
          create: [
            {
              dimension: "PRICING",
              reasonCode: "USER_SPECIFIC_ITEM",
              sanitizedSummary: "Contains userId: user_12345 leaked",
              beforeValue: 1,
              afterValue: 2,
            },
          ],
        },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 6 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 6 Detected defect (Exit 1).");

    // --- STAGE 7: Restore after Stage 6 (Exit 0) ---
    console.log("Stage 7: Restoring from Stage 6...");
    await prisma.opportunityChangeEvent.delete({ where: { id: corruptUserDataEv.id } });
    runAudit();
    console.log("  ✓ Stage 7 Restore Clean (Exit 0).");

    // --- STAGE 8: Stale/incorrect FounderProfileRevision (Exit 1) ---
    console.log("Stage 8: Injecting stale/incorrect FounderProfileRevision link...");
    const otherProfile = await prisma.founderProfile.create({
      data: { userId: userFree.id },
    });
    const otherProfileRev = await prisma.founderProfileRevision.create({
      data: {
        profileId: otherProfile.id,
        revisionNumber: 1,
        inputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });
    const badProfileEval = await prisma.radarEvaluation.create({
      data: {
        watchId: watchPro.id,
        changeEventId: changeEvent1.id,
        founderProfileRevisionId: otherProfileRev.id,
        matched: false,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        evaluationVersion: "1.0.1",
      },
    });
    try {
      runAudit();
      throw new Error("Stage 8 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 8 Detected defect (Exit 1).");

    // --- STAGE 9: Restore after Stage 8 (Exit 0) ---
    console.log("Stage 9: Restoring from Stage 8...");
    await prisma.radarEvaluation.delete({ where: { id: badProfileEval.id } });
    await prisma.founderProfileRevision.delete({ where: { id: otherProfileRev.id } });
    await prisma.founderProfile.delete({ where: { id: otherProfile.id } });
    runAudit();
    console.log("  ✓ Stage 9 Restore Clean (Exit 0).");

    // --- STAGE 10: Free instant notification (Exit 1) ---
    console.log("Stage 10: Injecting Free user with instant notification alert...");
    const corruptFreeOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userFree.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `defect_free_instant_${Date.now()}`,
        sanitizedPayload: { title: "Illegal Free Instant" },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 10 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 10 Detected defect (Exit 1).");

    // --- STAGE 11: Restore after Stage 10 (Exit 0) ---
    console.log("Stage 11: Restoring from Stage 10...");
    await prisma.notificationOutbox.delete({ where: { id: corruptFreeOutbox.id } });
    runAudit();
    console.log("  ✓ Stage 11 Restore Clean (Exit 0).");

    // --- STAGE 12: Sent outbox without delivery (Exit 1) ---
    console.log("Stage 12: Injecting SENT outbox without delivery record...");
    const corruptSentOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userPro.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "SENT",
        sentAt: new Date(),
        deduplicationKey: `defect_sent_nodeliv_${Date.now()}`,
        sanitizedPayload: { title: "Sent No Delivery" },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 12 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 12 Detected defect (Exit 1).");

    // --- STAGE 13: Restore after Stage 12 (Exit 0) ---
    console.log("Stage 13: Restoring from Stage 12...");
    await prisma.notificationOutbox.delete({ where: { id: corruptSentOutbox.id } });
    runAudit();
    console.log("  ✓ Stage 13 Restore Clean (Exit 0).");

    // --- STAGE 14: Duplicate attemptNumber in NotificationDelivery (Exit 1) ---
    console.log("Stage 14: Injecting duplicate NotificationDelivery attemptNumber defect...");
    const dupDelivery = await prisma.notificationDelivery.create({
      data: {
        outboxId: outboxProInstant.id,
        attemptNumber: 2,
        provider: "TEST_MOCK",
        providerIdempotencyKey: keyProInstant,
        status: "FAILED",
        attemptedAt: new Date(2026, 0, 1),
      },
    });
    // Corrupt attemptCount mismatch (attemptCount remains 1 while deliveries is 2)
    try {
      runAudit();
      throw new Error("Stage 14 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 14 Detected defect (Exit 1).");

    // --- STAGE 15: Restore after Stage 14 (Exit 0) ---
    console.log("Stage 15: Restoring from Stage 14...");
    await prisma.notificationDelivery.delete({ where: { id: dupDelivery.id } });
    runAudit();
    console.log("  ✓ Stage 15 Restore Clean (Exit 0).");

    // --- STAGE 16: Expired PROCESSING lease not reclaimable (Exit 1) ---
    console.log("Stage 16: Injecting expired unclaimable PROCESSING lease...");
    const badLeaseJob = await prisma.opportunityRadarJob.create({
      data: {
        opportunityRevisionId: rev4.id,
        status: "PROCESSING",
        lockedUntil: new Date(Date.now() - 3600 * 1000),
        claimToken: null,
      },
    });
    try {
      runAudit();
      throw new Error("Stage 16 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 16 Detected defect (Exit 1).");

    // --- STAGE 17: Restore after Stage 16 (Exit 0) ---
    console.log("Stage 17: Restoring from Stage 16...");
    await prisma.opportunityRadarJob.delete({ where: { id: badLeaseJob.id } });
    runAudit();
    console.log("  ✓ Stage 17 Restore Clean (Exit 0).");

    // --- STAGE 18: Sensitive profile answer in payload (Exit 1) ---
    console.log("Stage 18: Injecting sensitive profile answers into notification payload...");
    const corruptPayloadOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userPro.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `defect_sensitive_payload_${Date.now()}`,
        sanitizedPayload: {
          title: "Alert",
          founderSkill: "Secret Skill",
          technicalRiskTolerance: "HIGH",
        },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 18 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 18 Detected defect (Exit 1).");

    // --- STAGE 19: Restore after Stage 18 (Exit 0) ---
    console.log("Stage 19: Restoring from Stage 18...");
    await prisma.notificationOutbox.delete({ where: { id: corruptPayloadOutbox.id } });
    runAudit();
    console.log("  ✓ Stage 19 Restore Clean (Exit 0).");

    // --- STAGE 20: Watchlist entitlement overflow (Exit 1) ---
    console.log("Stage 20: Injecting watchlist entitlement overflow (4 watches on Free user)...");
    const extraWatches = [];
    for (let i = 0; i < 4; i++) {
      const extraOpp = await prisma.opportunity.create({
        data: {
          slug: `opp-extra-${i}-${Date.now()}`,
          title: `Extra Opp ${i}`,
          status: "PUBLISHED",
          oneSentenceSummary: "Summary",
          problemStatement: "Problem",
          jobsToBeDone: ["Job"],
          proposedProduct: "Product",
          narrowMvpScope: ["Scope"],
          targetCustomerSegments: ["B2B"],
          economicBuyer: "VP",
          endUser: "Engineer",
          buyingTrigger: "Trigger",
          existingWorkflow: "Workflow",
          painSeverity: "CRITICAL",
          painFrequency: "MONTHLY",
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
      const w = await prisma.savedOpportunity.create({
        data: { userId: userFree.id, opportunityId: extraOpp.id },
      });
      extraWatches.push(w);
    }
    try {
      runAudit();
      throw new Error("Stage 20 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 20 Detected defect (Exit 1).");

    // --- STAGE 21: Restore after Stage 20 (Exit 0) ---
    console.log("Stage 21: Restoring from Stage 20...");
    await prisma.savedOpportunity.deleteMany({
      where: { id: { in: extraWatches.map((w) => w.id) } },
    });
    runAudit();
    console.log("  ✓ Stage 21 Restore Clean (Exit 0).");

    // --- STAGE 22: Muted watch with deliverable instant alert (Exit 1) ---
    console.log("Stage 22: Injecting muted watch with deliverable instant alert...");
    await prisma.savedOpportunity.update({
      where: { id: watchPro.id },
      data: { mutedUntil: new Date(Date.now() + 86400 * 1000) },
    });
    const mutedDeliverableOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: userPro.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `defect_muted_instant_${Date.now()}`,
        sanitizedPayload: { title: "Muted Alert" },
      },
    });
    try {
      runAudit();
      throw new Error("Stage 22 should have failed");
    } catch (err) {
      if (err.status !== 1) throw err;
    }
    console.log("  ✓ Stage 22 Detected defect (Exit 1).");

    // --- STAGE 23: Restore after Stage 22 (Exit 0) ---
    console.log("Stage 23: Restoring from Stage 22...");
    await prisma.savedOpportunity.update({
      where: { id: watchPro.id },
      data: { mutedUntil: null },
    });
    await prisma.notificationOutbox.delete({ where: { id: mutedDeliverableOutbox.id } });
    runAudit();
    console.log("  ✓ Stage 23 Restore Clean (Exit 0).");

    // --- STAGE 24: Defect with --report-only (Exit 0) ---
    console.log("Stage 24: Verifying Report-Only mode on defective state (Exit 0)...");
    const tempCorrupt = await prisma.notificationOutbox.create({
      data: {
        userId: userFree.id,
        opportunityId: opp.id,
        changeEventId: changeEvent1.id,
        notificationType: "RADAR_CHANGE_ALERT",
        channel: "EMAIL",
        status: "PENDING",
        deduplicationKey: `defect_report_only_${Date.now()}`,
        sanitizedPayload: { title: "Report Only" },
      },
    });
    const reportOut = execSync("node scripts/audit-radar.js --report-only", {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    }).toString();
    if (!reportOut.includes("FREE_USER_WITH_INSTANT_ALERT")) {
      throw new Error("Report only did not report defect");
    }
    console.log("  ✓ Stage 24 Report-only detected defect and exited with 0.");
    await prisma.notificationOutbox.delete({ where: { id: tempCorrupt.id } });

    // --- STAGE 25: Unreachable database (Exit 2) ---
    console.log("Stage 25: Verifying Unreachable Database Failure (Exit 2)...");
    try {
      execSync("node scripts/audit-radar.js", {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://postgres:bad@localhost:5440/nonexistent?connect_timeout=1",
        },
        stdio: "pipe",
      });
      throw new Error("Stage 25 should have failed with exit 2.");
    } catch (err) {
      if (err.status !== 2) throw err;
      console.log("  ✓ Stage 25 Unreachable DB correctly exited with code 2.");
    }

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Phase 4C Comprehensive 25-Stage Radar Defect Cycle PASSED (100%)!");
    console.log("=======================================================\n");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

runDefectCycle().catch((err) => {
  console.error("Defect cycle execution failed:", err);
  process.exit(1);
});
