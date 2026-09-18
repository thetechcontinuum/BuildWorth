const path = require("path");
const { execSync } = require("child_process");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function testDefectCycle() {
  console.log("=== BuildWorth Phase 4A Strict Entitlement Defect Cycle Suite ===");

  const dbName = "test_defect_cycle_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;
  const prismaBin = path.resolve(__dirname, "../node_modules/.bin/prisma");

  try {
    // 0. Deploy all migrations
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    // Seed canonical catalog
    execSync(`DATABASE_URL="${dbUrl}" node packages/database/scripts/reconcile-catalog.js`, {
      stdio: "pipe",
    });

    // Seed valid test users and usage
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    const userFree = await prisma.user.create({
      data: { email: "free@buildworth.io", name: "Free User", role: "USER", tier: "FREE" },
    });

    const userPro = await prisma.user.create({
      data: { email: "pro@buildworth.io", name: "Pro User", role: "USER", tier: "FREE" },
    });

    const proPrice = await prisma.planPrice.findFirst({ where: { id: "price_pro_monthly" } });
    const customer = await prisma.billingCustomer.create({
      data: {
        userId: userPro.id,
        stripeCustomerId: "cus_pro_test",
        billingEmail: "pro@buildworth.io",
      },
    });

    await prisma.billingSubscription.create({
      data: {
        userId: userPro.id,
        billingCustomerId: customer.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: "sub_pro_test",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    // Add valid usage entry
    await prisma.usageLedger.create({
      data: {
        userId: userFree.id,
        entitlementType: "OPPORTUNITY_COMPARISON",
        unitsConsumed: 2, // Limit is 2
        periodBucketKey: "2026-08",
      },
    });

    const runAudit = (args = "") => {
      try {
        const out = execSync(
          `DATABASE_URL="${dbUrl}" node packages/database/scripts/audit-entitlements.js ${args}`,
          {
            stdio: "pipe",
          },
        ).toString();
        return { code: 0, out };
      } catch (err) {
        return { code: err.status || 1, out: (err.stdout || "") + "\n" + (err.stderr || "") };
      }
    };

    // Step 1: Clean audit -> exit 0
    console.log("Step 1: Clean audit verification...");
    const s1 = runAudit();
    if (s1.code !== 0) throw new Error(`Step 1 failed, expected 0, got ${s1.code}: ${s1.out}`);
    console.log("  ✓ Step 1 Clean audit returned exit code 0.");

    // Step 2: Corrupt a plan entitlement -> exit 1
    console.log("Step 2: Corrupt plan entitlement verification...");
    await prisma.planEntitlement.update({
      where: {
        planId_entitlementType: {
          planId: (await prisma.productPlan.findUnique({ where: { code: "PRO" } })).id,
          entitlementType: "FOUNDER_FIT_FULL_BREAKDOWN",
        },
      },
      data: { isUnlimited: false, limitQuantity: 1 },
    });
    const s2 = runAudit();
    if (s2.code !== 1) throw new Error(`Step 2 failed, expected 1, got ${s2.code}: ${s2.out}`);
    console.log("  ✓ Step 2 Corrupted plan entitlement caught with exit code 1.");

    // Step 3: Restore -> exit 0
    console.log("Step 3: Reconcile & restore catalog...");
    execSync(`DATABASE_URL="${dbUrl}" node packages/database/scripts/reconcile-catalog.js`, {
      stdio: "pipe",
    });
    const s3 = runAudit();
    if (s3.code !== 0) throw new Error(`Step 3 failed, expected 0, got ${s3.code}: ${s3.out}`);
    console.log("  ✓ Step 3 Restored audit returned exit code 0.");

    // Step 4: Create unsupported legacy PRO projection -> exit 1
    console.log("Step 4: Unsupported legacy User.tier='PRO' projection...");
    await prisma.user.update({
      where: { id: userFree.id },
      data: { tier: "PRO" }, // Legacy tier without subscription
    });
    const s4 = runAudit();
    if (s4.code !== 1) throw new Error(`Step 4 failed, expected 1, got ${s4.code}: ${s4.out}`);
    console.log("  ✓ Step 4 Legacy tier projection mismatch caught with exit code 1.");

    // Step 5: Restore -> exit 0
    console.log("Step 5: Restore user tier projection...");
    await prisma.user.update({
      where: { id: userFree.id },
      data: { tier: "FREE" },
    });
    const s5 = runAudit();
    if (s5.code !== 0) throw new Error(`Step 5 failed, expected 0, got ${s5.code}: ${s5.out}`);
    console.log("  ✓ Step 5 Restored audit returned exit code 0.");

    // Step 6: Create over-limit usage state -> exit 1
    console.log("Step 6: Over-limit usage state...");
    await prisma.usageLedger.create({
      data: {
        userId: userFree.id,
        entitlementType: "OPPORTUNITY_COMPARISON",
        unitsConsumed: 5, // Exceeds limit of 2
        periodBucketKey: "2026-08",
      },
    });
    const s6 = runAudit();
    if (s6.code !== 1) throw new Error(`Step 6 failed, expected 1, got ${s6.code}: ${s6.out}`);
    console.log("  ✓ Step 6 Over-limit usage caught with exit code 1.");

    // Step 7: Restore -> exit 0
    console.log("Step 7: Remove over-limit usage row...");
    await prisma.usageLedger.deleteMany({
      where: { userId: userFree.id, unitsConsumed: 5 },
    });
    const s7 = runAudit();
    if (s7.code !== 0) throw new Error(`Step 7 failed, expected 0, got ${s7.code}: ${s7.out}`);
    console.log("  ✓ Step 7 Restored audit returned exit code 0.");

    // Step 8: Unreachable database -> exit 2
    console.log("Step 8: Unreachable database configuration...");
    try {
      execSync(
        `DATABASE_URL="postgresql://postgres:postgres@localhost:5999/unreachable" node packages/database/scripts/audit-entitlements.js`,
        {
          stdio: "pipe",
        },
      );
      throw new Error("Unreachable DB did not throw!");
    } catch (err) {
      if (err.status !== 2)
        throw new Error(`Expected exit code 2 on unreachable DB, got ${err.status}`);
    }
    console.log("  ✓ Step 8 Unreachable database exited with code 2.");

    // Step 9: Report-only mode with defect -> exit 0
    console.log("Step 9: Report-only corrupted state...");
    await prisma.user.update({
      where: { id: userFree.id },
      data: { tier: "PRO" },
    });
    const s9 = runAudit("--report-only");
    if (s9.code !== 0) throw new Error(`Step 9 failed, expected 0, got ${s9.code}: ${s9.out}`);
    if (!s9.out.includes("Report-only mode enabled"))
      throw new Error("Expected report-only message");
    console.log("  ✓ Step 9 Report-only mode reported defects with exit code 0.");

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Complete Phase 4A Defect Cycle Passed 100% (9/9 Steps)!");
    console.log("=======================================================");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

testDefectCycle().catch((err) => {
  console.error("Defect cycle failed:", err);
  process.exit(1);
});
