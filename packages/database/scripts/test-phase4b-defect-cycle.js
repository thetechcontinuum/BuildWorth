const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));

async function runDefectCycle() {
  console.log("=== BuildWorth Phase 4B Billing Audit 11-Step Defect Cycle ===");

  const dbName = "test_phase4b_audit_cycle_" + Date.now();
  execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`);
  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy migrations and reconcile catalog
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    execSync(`DATABASE_URL="${dbUrl}" node "${path.resolve(__dirname, "reconcile-catalog.js")}"`, { stdio: "pipe" });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Populate initial valid state: User, Customer, PlanPrice, Subscription, WebhookEvent, CheckoutAttempt
    const user = await prisma.user.create({
      data: { email: "audit.billing.user@buildworth.io", name: "Audit User", role: "USER", tier: "PRO" },
    });

    const proPrice = await prisma.planPrice.findFirst({ where: { plan: { code: "PRO" }, billingInterval: "MONTHLY" } });
    const customer = await prisma.billingCustomer.create({
      data: { userId: user.id, stripeCustomerId: "cus_audit_123", billingEmail: user.email },
    });

    const sub = await prisma.billingSubscription.create({
      data: {
        userId: user.id,
        billingCustomerId: customer.id,
        planPriceId: proPrice.id,
        stripeSubscriptionId: "sub_audit_123",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    await prisma.billingWebhookEvent.create({
      data: {
        eventId: "evt_audit_123",
        eventType: "customer.subscription.created",
        payloadHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        payload: { id: "evt_audit_123" },
        processingStatus: "PROCESSED",
      },
    });

    await prisma.billingCheckoutAttempt.create({
      data: {
        userId: user.id,
        requestId: "req_audit_123",
        selectedPlanCode: "PRO",
        billingInterval: "MONTHLY",
        planPriceId: proPrice.id,
        stripePriceId: proPrice.stripePriceId,
        checkoutSessionId: "cs_audit_123",
        idempotencyKey: "idem_audit_123",
        status: "COMPLETED",
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });

    function runAudit(flags = "", expectExit = 0, customDbUrl = dbUrl) {
      let code = 0;
      try {
        execSync(`DATABASE_URL="${customDbUrl}" node "${path.resolve(__dirname, "audit-billing.js")}" ${flags}`, {
          stdio: "pipe",
        });
      } catch (err) {
        code = err.status || 1;
      }
      if (code !== expectExit) {
        throw new Error(`Expected exit ${expectExit}, got ${code} for flags "${flags}"`);
      }
      return code;
    }

    console.log("Step 1: Clean State -> Expect exit 0...");
    runAudit("", 0);
    console.log("  ✓ Step 1 passed (Exit 0)");

    console.log("Step 2: Corrupt Customer Stripe ID -> Expect exit 1...");
    await prisma.billingCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId: "invalid_stripe_id" } });
    runAudit("", 1);
    console.log("  ✓ Step 2 passed (Exit 1)");

    console.log("Step 3: Restore Customer -> Expect exit 0...");
    await prisma.billingCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId: "cus_audit_123" } });
    runAudit("", 0);
    console.log("  ✓ Step 3 passed (Exit 0)");

    console.log("Step 4: Corrupt User.tier projection -> Expect exit 1...");
    await prisma.user.update({ where: { id: user.id }, data: { tier: "FREE" } });
    runAudit("", 1);
    console.log("  ✓ Step 4 passed (Exit 1)");

    console.log("Step 5: Restore User.tier projection -> Expect exit 0...");
    await prisma.user.update({ where: { id: user.id }, data: { tier: "PRO" } });
    runAudit("", 0);
    console.log("  ✓ Step 5 passed (Exit 0)");

    console.log("Step 6: Corrupt Webhook payloadHash (null) -> Expect exit 1...");
    await prisma.billingWebhookEvent.update({ where: { eventId: "evt_audit_123" }, data: { payloadHash: null } });
    runAudit("", 1);
    console.log("  ✓ Step 6 passed (Exit 1)");

    console.log("Step 7: Restore Webhook payloadHash -> Expect exit 0...");
    await prisma.billingWebhookEvent.update({
      where: { eventId: "evt_audit_123" },
      data: { payloadHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" },
    });
    runAudit("", 0);
    console.log("  ✓ Step 7 passed (Exit 0)");

    console.log("Step 8: Set Subscription to UNKNOWN provider status -> Expect exit 1...");
    await prisma.billingSubscription.update({ where: { id: sub.id }, data: { status: "UNKNOWN" } });
    runAudit("", 1);
    console.log("  ✓ Step 8 passed (Exit 1)");

    console.log("Step 9: Restore Subscription to ACTIVE -> Expect exit 0...");
    await prisma.billingSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } });
    runAudit("", 0);
    console.log("  ✓ Step 9 passed (Exit 0)");

    console.log("Step 10: Unreachable Database -> Expect exit 2...");
    runAudit("", 2, "postgresql://postgres:postgres@localhost:5449/non_existent?schema=public");
    console.log("  ✓ Step 10 passed (Exit 2)");

    console.log("Step 11: Corrupted State with --report-only -> Expect exit 0...");
    await prisma.user.update({ where: { id: user.id }, data: { tier: "FREE" } }); // Corrupt state
    runAudit("--report-only", 0);
    console.log("  ✓ Step 11 passed (Exit 0 with report-only)");

    await prisma.$disconnect();
    execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`);

    console.log("\n=======================================================");
    console.log("Phase 4B Billing Audit 11-Step Defect Cycle PASSED (11/11)!");
    console.log("=======================================================");
  } catch (err) {
    execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`);
    throw err;
  }
}

runDefectCycle().catch((err) => {
  console.error("Defect cycle failed:", err);
  process.exit(1);
});
