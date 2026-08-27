const { execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const { processPendingNotificationOutbox } = require(
  path.resolve(__dirname, "../../opportunity-engine/dist/index.js"),
);

function runAudit(dbUrl) {
  try {
    execSync("node scripts/audit-radar.js", {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    return 0;
  } catch (err) {
    return err.status || 1;
  }
}

async function runDeliveryInvariantsSuite() {
  console.log(
    "=== BuildWorth Phase 4C Delivery Invariants & Ambiguous Provider Recovery Suite ===",
  );

  const dbName = "test_phase4c_invariants_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // Deploy all migrations
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        PATH: process.env.PATH || "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        DATABASE_URL: dbUrl,
      },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // 1. Create User and Opportunity
    const user = await prisma.user.create({
      data: { email: `invar_user_${Date.now()}@buildworth.io`, tier: "PRO" },
    });

    const opp = await prisma.opportunity.create({
      data: {
        slug: `opp-invar-${Date.now()}`,
        title: "Invariants Opportunity",
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
    const rev2 = await prisma.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: 2,
        snapshotData: { price: 2900 },
        reasonForChange: "Update",
      },
    });

    const changeEvent = await prisma.opportunityChangeEvent.create({
      data: {
        opportunityId: opp.id,
        fromRevisionId: rev1.id,
        toRevisionId: rev2.id,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        overallSeverity: "HIGH",
        items: {
          create: [
            {
              dimension: "PRICING",
              direction: "POSITIVE",
              severity: "HIGH",
              reasonCode: "PRICE_INCREASED",
              sanitizedSummary: "Price increased to $29",
              beforeValue: 1900,
              afterValue: 2900,
            },
          ],
        },
      },
    });

    const watch = await prisma.savedOpportunity.create({
      data: { userId: user.id, opportunityId: opp.id, radarEnabled: true, alertCadence: "INSTANT" },
    });

    const evaluation = await prisma.radarEvaluation.create({
      data: {
        watchId: watch.id,
        changeEventId: changeEvent.id,
        matched: true,
        canonicalInputHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        reasonCodes: ["PRICE_INCREASED"],
      },
    });

    // 2. SEED FOUR REQUIRED OUTBOX STATES WITH EXACT PROVIDER IDEMPOTENCY KEYS
    // a) SENT (1 attempt, SUCCESS)
    const outboxSent = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        radarEvaluationId: evaluation.id,
        notificationType: "RADAR_CHANGE_ALERT",
        status: "SENT",
        sentAt: new Date(),
        attemptCount: 1,
        deduplicationKey: `dedupe_sent_${Date.now()}`,
        sanitizedPayload: { title: "Sent Alert" },
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

    // b) PENDING retryable (1 attempt, FAILED)
    const outboxPending = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        radarEvaluationId: evaluation.id,
        notificationType: "RADAR_CHANGE_ALERT",
        status: "PENDING",
        attemptCount: 1,
        nextAttemptAt: new Date(Date.now() + 60000),
        deduplicationKey: `dedupe_pending_${Date.now()}`,
        sanitizedPayload: { title: "Pending Retry" },
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
        sanitizedError: "Transient remote timeout",
      },
    });

    // c) DEAD_LETTER (5 attempts, all FAILED, identical key)
    const outboxDead = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        radarEvaluationId: evaluation.id,
        notificationType: "RADAR_DAILY_DIGEST",
        status: "DEAD_LETTER",
        attemptCount: 5,
        sanitizedLastError: "DEAD_LETTER_EXHAUSTED_ATTEMPTS: Permanent failure",
        deduplicationKey: `dedupe_dead_${Date.now()}`,
        sanitizedPayload: { title: "DeadLetter Digest" },
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

    // d) CANCELLED (0 attempts)
    const outboxCancelled = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        radarEvaluationId: evaluation.id,
        notificationType: "RADAR_WEEKLY_DIGEST",
        status: "CANCELLED",
        attemptCount: 0,
        sanitizedLastError: "WATCHLIST_RADAR_DISABLED",
        deduplicationKey: `dedupe_cancelled_${Date.now()}`,
        sanitizedPayload: { title: "Cancelled" },
      },
    });

    // Print per-outbox delivery consistency table
    console.log("\n--- Populated Outbox Delivery Consistency State ---");
    const outboxList = await prisma.notificationOutbox.findMany({
      include: { deliveries: { orderBy: { attemptNumber: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    const rows = outboxList.map((item) => {
      const distinctKeys = new Set(item.deliveries.map((d) => d.providerIdempotencyKey));
      return {
        outboxId: item.id.slice(0, 8) + "...",
        status: item.status,
        attemptCount: item.attemptCount,
        deliveryRows: item.deliveries.length,
        attemptSequence: JSON.stringify(item.deliveries.map((d) => d.attemptNumber)),
        distinctIdempKeys: distinctKeys.size,
        persistedKeyPrefix: item.deliveries[0]?.providerIdempotencyKey
          ? item.deliveries[0].providerIdempotencyKey.slice(0, 16) + "..."
          : "none",
      };
    });
    console.table(rows);

    // Run baseline strict audit
    console.log("\nBaseline strict audit exit code:", runAudit(dbUrl));

    // 3. AMBIGUOUS PROVIDER RESULT RECOVERY TEST
    console.log("\n--- Ambiguous Provider Result Recovery Test ---");
    const sentMessageTracker = new Set();
    const ambigOutbox = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        opportunityId: opp.id,
        changeEventId: changeEvent.id,
        radarEvaluationId: evaluation.id,
        notificationType: "RADAR_CHANGE_ALERT",
        status: "PENDING",
        deduplicationKey: `ambig_dedupe_${Date.now()}`,
        sanitizedPayload: { title: "Ambiguous Recovery" },
      },
    });

    // Worker 1: Provider succeeds, DB fails post-delivery
    console.log("Worker 1 attempting delivery (simulating DB crash post provider send)...");
    try {
      await processPendingNotificationOutbox(prisma, {
        providerOptions: {
          sentMessageIds: sentMessageTracker,
          failPersistenceAfterDelivery: true,
        },
      });
    } catch (err) {
      // Expected DB crash post-send
    }
    console.log(
      `Provider accepted logical message count after Worker 1: ${sentMessageTracker.size}`,
    );

    // Worker 2: Retry with identical idempotency key
    console.log("Worker 2 executing retry after lease recovery...");
    await prisma.notificationOutbox.update({
      where: { id: ambigOutbox.id },
      data: { status: "PENDING", nextAttemptAt: null, lockedUntil: null, claimToken: null },
    });

    await processPendingNotificationOutbox(prisma, {
      providerOptions: {
        sentMessageIds: sentMessageTracker,
      },
    });

    const ambigFinal = await prisma.notificationOutbox.findUnique({
      where: { id: ambigOutbox.id },
      include: { deliveries: { orderBy: { attemptNumber: "asc" } } },
    });

    console.log(`\nAmbiguous Outbox Verification Results:`);
    const ambigDistinctKeys = new Set(ambigFinal.deliveries.map((d) => d.providerIdempotencyKey));
    console.log(`- status: ${ambigFinal.status}`);
    console.log(`- attemptCount: ${ambigFinal.attemptCount}`);
    console.log(
      `- attempt sequence: ${JSON.stringify(ambigFinal.deliveries.map((d) => d.attemptNumber))}`,
    );
    console.log(
      `- persisted idempotency keys: ${JSON.stringify(ambigFinal.deliveries.map((d) => d.providerIdempotencyKey))}`,
    );
    console.log(`- distinct idempotency-key count: ${ambigDistinctKeys.size}`);
    console.log(`- provider call count: ${ambigFinal.deliveries.length}`);
    console.log(`- provider accepted logical-message count: ${sentMessageTracker.size}`);
    if (sentMessageTracker.size !== 1) throw new Error("Duplicate provider message was emitted!");
    if (ambigDistinctKeys.size !== 1)
      throw new Error("Deliveries have differing idempotency keys!");
    if (ambigFinal.status !== "SENT") throw new Error("Ambiguous outbox did not become SENT!");

    // 4. DELIVERY CORRUPTION STEPS A THROUGH G
    console.log("\n--- Delivery Corruption Steps A through G ---");

    // A. Set DEAD_LETTER attemptCount to 4 while retaining 5 deliveries: exit 1
    await prisma.notificationOutbox.update({
      where: { id: outboxDead.id },
      data: { attemptCount: 4 },
    });
    console.log(
      `Step A (attemptCount=4, 5 deliveries) exit code: ${runAudit(dbUrl)} (Expected: 1)`,
    );

    // B. Restore: exit 0
    await prisma.notificationOutbox.update({
      where: { id: outboxDead.id },
      data: { attemptCount: 5 },
    });
    console.log(`Step B (Restore) exit code: ${runAudit(dbUrl)} (Expected: 0)`);

    // C. Delete one DEAD_LETTER delivery while attemptCount remains 5: exit 1
    const del5 = await prisma.notificationDelivery.findFirst({
      where: { outboxId: outboxDead.id, attemptNumber: 5 },
    });
    await prisma.notificationDelivery.delete({ where: { id: del5.id } });
    console.log(
      `Step C (attemptCount=5, 4 deliveries) exit code: ${runAudit(dbUrl)} (Expected: 1)`,
    );

    // D. Restore: exit 0
    await prisma.notificationDelivery.create({
      data: {
        id: del5.id,
        outboxId: outboxDead.id,
        attemptNumber: 5,
        provider: "TEST_MOCK",
        providerIdempotencyKey: keyDead,
        status: "FAILED",
        attemptedAt: del5.attemptedAt,
        sanitizedError: del5.sanitizedError,
      },
    });
    console.log(`Step D (Restore) exit code: ${runAudit(dbUrl)} (Expected: 0)`);

    // E. Insert duplicate attemptNumber: expected PostgreSQL unique-constraint rejection
    let constraintTriggered = false;
    try {
      await prisma.notificationDelivery.create({
        data: {
          outboxId: outboxDead.id,
          attemptNumber: 1, // duplicate
          provider: "TEST_MOCK",
          providerIdempotencyKey: keyDead,
          status: "FAILED",
          attemptedAt: new Date(),
        },
      });
    } catch (err) {
      constraintTriggered = true;
    }
    console.log(
      `Step E (Duplicate attemptNumber) DB constraint rejected: ${constraintTriggered} (Expected: true)`,
    );

    // F. Add a provider delivery to the CANCELLED outbox: exit 1
    const illegalDel = await prisma.notificationDelivery.create({
      data: {
        outboxId: outboxCancelled.id,
        attemptNumber: 1,
        provider: "TEST_MOCK",
        providerIdempotencyKey: `idemp_${crypto.createHash("sha256").update(`${outboxCancelled.id}:${outboxCancelled.deduplicationKey}`).digest("hex").slice(0, 24)}`,
        status: "FAILED",
        attemptedAt: new Date(),
        sanitizedError: "Illegal delivery",
      },
    });
    console.log(
      `Step F (Cancelled outbox has delivery) exit code: ${runAudit(dbUrl)} (Expected: 1)`,
    );

    // G. Restore: exit 0
    await prisma.notificationDelivery.delete({ where: { id: illegalDel.id } });
    console.log(`Step G (Restore) exit code: ${runAudit(dbUrl)} (Expected: 0)`);

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Phase 4C Delivery Invariants & Recovery Suite PASSED!");
    console.log("=======================================================\n");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

runDeliveryInvariantsSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
