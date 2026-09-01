const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  resolveUserEntitlements,
  checkEntitlement,
  enforceAtomicUsage,
  CANONICAL_PLANS,
} = require("../../entitlements/dist/index.js");

async function testPhase4aEntitlements() {
  console.log("=== BuildWorth Phase 4A Entitlements & Real PostgreSQL Concurrency Suite ===");
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const testEmail = "concurrency.test.user@buildworth.io";
  const testEmail2 = "concurrency.test.user2@buildworth.io";

  try {
    // 0. Cleanup
    for (const email of [testEmail, testEmail2]) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await prisma.usageLedger.deleteMany({ where: { userId: existing.id } });
        await prisma.entitlementGrant.deleteMany({ where: { userId: existing.id } });
        await prisma.billingSubscription.deleteMany({ where: { userId: existing.id } });
        await prisma.billingCustomer.deleteMany({ where: { userId: existing.id } });
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }

    // 1. Ensure Plans & Prices
    const proPlan = await prisma.productPlan.upsert({
      where: { code: "PRO" },
      update: { isActive: true },
      create: {
        code: "PRO",
        name: "Pro",
        description: "For active builders",
        isActive: true,
        sortOrder: 1,
      },
    });

    const proPrice = await prisma.planPrice.upsert({
      where: { id: "price_pro_monthly_test" },
      update: { isActive: true },
      create: {
        id: "price_pro_monthly_test",
        planId: proPlan.id,
        stripePriceId: "price_test_pro_monthly",
        billingInterval: "MONTHLY",
        amountCents: 1900,
        currency: "USD",
        isActive: true,
      },
    });

    // 2. Create User 1 & 2
    const user1 = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Concurrency Founder 1",
        role: "USER",
        tier: "FREE",
      },
    });

    const user2 = await prisma.user.create({
      data: {
        email: testEmail2,
        name: "Concurrency Founder 2",
        role: "USER",
        tier: "FREE",
      },
    });

    // Grant capped entitlement to User 1 (limit: 5 units)
    await prisma.entitlementGrant.create({
      data: {
        userId: user1.id,
        entitlementType: "OPPORTUNITY_COMPARISON",
        source: "PROMOTIONAL",
        isUnlimited: false,
        limitQuantity: 5,
        remainingUnits: 5,
        expiresAt: new Date(Date.now() + 86400000), // +1 day
      },
    });

    // Grant capped entitlement to User 2 (limit: 5 units)
    await prisma.entitlementGrant.create({
      data: {
        userId: user2.id,
        entitlementType: "OPPORTUNITY_COMPARISON",
        source: "PROMOTIONAL",
        isUnlimited: false,
        limitQuantity: 5,
        remainingUnits: 5,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    console.log("Test 1: Two requests that together exactly reach the limit (3 + 2 = 5)...");
    const r1 = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 3,
      periodBucketKey: "2026-08-C1",
    });
    const r2 = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 2,
      periodBucketKey: "2026-08-C1",
    });
    if (!r1.allowed || !r2.allowed) throw new Error("Exact limit requests failed");
    console.log("  ✓ Both requests succeeded (total committed = 5).");

    console.log("Test 2: Request that exceeds the limit (1 additional unit)...");
    const r3 = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 1,
      periodBucketKey: "2026-08-C1",
    });
    if (r3.allowed) throw new Error("Over-limit request was incorrectly allowed");
    console.log(`  ✓ Over-limit rejected: ${r3.error}`);

    console.log("Test 3: 10 simultaneous requests competing for the same final 1 unit...");
    // Fresh period bucket with limit 5; consume 4 first
    await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 4,
      periodBucketKey: "2026-08-RACE",
    });

    // Fire 10 simultaneous promises
    const promises = Array.from({ length: 10 }).map((_, idx) =>
      enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
        units: 1,
        resourceId: `race-opp-${idx}`,
        periodBucketKey: "2026-08-RACE",
      }),
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    console.log(
      `  ✓ 10 simultaneous requests: ${successCount} succeeded, ${rejectedCount} rejected.`,
    );
    if (successCount !== 1) {
      throw new Error(
        `Expected exactly 1 success among 10 competing requests, got ${successCount}`,
      );
    }

    const totalCommittedInRace = await prisma.usageLedger.aggregate({
      where: { userId: user1.id, periodBucketKey: "2026-08-RACE" },
      _sum: { unitsConsumed: true },
    });
    if (totalCommittedInRace._sum.unitsConsumed !== 5) {
      throw new Error(
        `Committed usage exceeded limit! Found ${totalCommittedInRace._sum.unitsConsumed}`,
      );
    }
    console.log(
      "  ✓ PostgreSQL advisory lock guaranteed total committed usage == 5 (0 over-allocation).",
    );

    console.log("Test 4: Idempotency Key testing...");
    const idemKey = "idem_test_abc_123";
    const firstCall = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 1,
      idempotencyKey: idemKey,
      periodBucketKey: "2026-08-IDEM",
    });
    if (!firstCall.allowed) throw new Error("First call failed");

    // Repeat identical call
    const repeatCall = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 1,
      idempotencyKey: idemKey,
      periodBucketKey: "2026-08-IDEM",
    });
    if (!repeatCall.allowed) throw new Error("Idempotent repeat failed");

    // Conflicting payload on same key
    let conflictCaught = false;
    try {
      await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
        units: 2, // Different unit count
        idempotencyKey: idemKey,
        periodBucketKey: "2026-08-IDEM",
      });
    } catch (err) {
      conflictCaught = true;
    }
    if (!conflictCaught) throw new Error("Conflicting idempotency payload did not throw");
    console.log("  ✓ Idempotency key behaves deterministically with conflict rejection.");

    console.log("Test 5: Different users running concurrently...");
    const [u1Res, u2Res] = await Promise.all([
      enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
        units: 1,
        periodBucketKey: "2026-08-PAR",
      }),
      enforceAtomicUsage(prisma, user2.id, "OPPORTUNITY_COMPARISON", {
        units: 1,
        periodBucketKey: "2026-08-PAR",
      }),
    ]);
    if (!u1Res.allowed || !u2Res.allowed) throw new Error("Concurrent multi-user execution failed");
    console.log("  ✓ Different users execute concurrently without locking contention.");

    console.log("Test 6: Transaction rollback on error creates 0 usage rows...");
    const rowsBefore = await prisma.usageLedger.count({
      where: { userId: user1.id, periodBucketKey: "2026-08-FAIL" },
    });
    try {
      await prisma.$transaction(async (tx) => {
        await enforceAtomicUsage(tx, user1.id, "OPPORTUNITY_COMPARISON", {
          units: 1,
          periodBucketKey: "2026-08-FAIL",
        });
        throw new Error("Simulated downstream business error");
      });
    } catch {}
    const rowsAfter = await prisma.usageLedger.count({
      where: { userId: user1.id, periodBucketKey: "2026-08-FAIL" },
    });
    if (rowsBefore !== rowsAfter) throw new Error("Rollback leaked usage ledger rows!");
    console.log("  ✓ Rollback verified: 0 usage rows created on failure.");

    console.log("Test 7: Negative, zero, and malformed units validation...");
    const neg = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", { units: -5 });
    const zero = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", { units: 0 });
    const floatU = await enforceAtomicUsage(prisma, user1.id, "OPPORTUNITY_COMPARISON", {
      units: 1.5,
    });
    if (neg.allowed || zero.allowed || floatU.allowed)
      throw new Error("Malformed unit requests allowed");
    console.log("  ✓ Negative, zero, and non-integer unit requests rejected.");

    console.log("\n=======================================================");
    console.log("All Phase 4A PostgreSQL Concurrency Tests Passed!");
    console.log("=======================================================");
  } finally {
    await prisma.$disconnect();
  }
}

testPhase4aEntitlements().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
