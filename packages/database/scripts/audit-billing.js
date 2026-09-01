const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const { resolveUserEntitlements } = require("../../entitlements/dist/index.js");

async function auditBilling() {
  const isReportOnly = process.argv.includes("--report-only");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[FATAL] Missing required environment variable: DATABASE_URL");
    process.exit(2);
  }

  let prisma;
  try {
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();
  } catch (err) {
    console.error(
      "DATABASE_CONNECTION_ERROR: Could not connect to database for billing audit.",
      err.message,
    );
    process.exit(2);
  }

  console.log("=== BuildWorth Phase 4B Server-Authoritative Billing Audit ===");

  const defects = [];

  try {
    // 1. Audit Customers
    const customers = await prisma.billingCustomer.findMany({
      include: { user: true, subscriptions: true },
    });

    for (const cus of customers) {
      if (!cus.user) {
        defects.push(`Orphaned BillingCustomer ${cus.id} without valid User record.`);
      }
      if (!cus.stripeCustomerId || !cus.stripeCustomerId.startsWith("cus_")) {
        defects.push(`Invalid stripeCustomerId on customer ${cus.id}: ${cus.stripeCustomerId}`);
      }
    }

    // 2. Audit Subscriptions & Provider State
    const subscriptions = await prisma.billingSubscription.findMany({
      include: { user: true, planPrice: { include: { plan: true } } },
    });

    for (const sub of subscriptions) {
      if (!sub.user) {
        defects.push(`Orphaned subscription ${sub.id} without user.`);
      }
      if (!sub.planPrice) {
        defects.push(`Subscription ${sub.id} references invalid/missing planPrice.`);
      }
      if (sub.status === "UNKNOWN") {
        defects.push(`Subscription ${sub.id} has UNKNOWN provider status requiring review.`);
      }

      // Check TEST/LIVE mismatch
      const isLiveDb =
        process.env.NODE_ENV === "production" && !process.env.ALLOW_TEST_STRIPE_IN_PROD;
      if (isLiveDb && sub.planPrice?.stripePriceId?.startsWith("price_test_")) {
        defects.push(
          `TEST Stripe price ID ${sub.planPrice.stripePriceId} found on LIVE subscription ${sub.id}.`,
        );
      }

      // Check User.tier read projection consistency
      const expectedProjectedTier =
        (sub.status === "ACTIVE" || sub.status === "TRIALING") && sub.planPrice?.plan?.isActive
          ? sub.planPrice.plan.code
          : "FREE";

      if (sub.user && sub.user.tier !== expectedProjectedTier) {
        defects.push(
          `User.tier projection mismatch for user ${sub.user.id}: expected ${expectedProjectedTier}, found ${sub.user.tier}`,
        );
      }

      // Check authoritative entitlement resolution
      const resolvedCtx = resolveUserEntitlements(sub.user, new Date(), {
        isLiveEnvironment: isLiveDb,
      });
      if (expectedProjectedTier === "FREE" && resolvedCtx.hasActiveSubscription) {
        defects.push(`Unearned active subscription entitlement resolved for user ${sub.user?.id}`);
      }
    }

    // 3. Audit Webhook Events & Payload Integrity
    const webhookEvents = await prisma.billingWebhookEvent.findMany();
    for (const evt of webhookEvents) {
      if (!evt.payloadHash) {
        defects.push(`Webhook event ${evt.eventId} missing payloadHash.`);
      }
      if (evt.processingStatus === "FAILED" && !evt.errorMessage) {
        defects.push(`Failed webhook event ${evt.eventId} missing sanitized errorMessage.`);
      }
    }

    // 4. Audit Checkout Attempts
    const checkoutAttempts = await prisma.billingCheckoutAttempt.findMany({
      include: { user: true },
    });
    for (const attempt of checkoutAttempts) {
      if (!attempt.user) {
        defects.push(`Orphaned checkout attempt ${attempt.id} without user.`);
      }
      if (attempt.status === "COMPLETED" && !attempt.completedAt) {
        defects.push(`Completed checkout attempt ${attempt.id} missing completedAt timestamp.`);
      }
    }

    console.log("----------------------------------------------------------------");
    console.log(`Total Customers Audited         : ${customers.length}`);
    console.log(`Total Subscriptions Audited     : ${subscriptions.length}`);
    console.log(`Total Webhook Events Audited    : ${webhookEvents.length}`);
    console.log(`Total Checkout Attempts Audited : ${checkoutAttempts.length}`);
    console.log(`Total Billing Defects Found     : ${defects.length}`);
    console.log("----------------------------------------------------------------");

    if (defects.length > 0) {
      console.log("Defects detected:");
      defects.forEach((d, idx) => console.log(` [${idx + 1}] ${d}`));

      if (isReportOnly) {
        console.log("Billing Audit Result: REPORT-ONLY MODE (Exit code 0)");
        process.exit(0);
      } else {
        console.log("Billing Audit Result: FAILED (Exit code 1)");
        process.exit(1);
      }
    }

    console.log("Billing Audit Result: CLEAN PASS (Exit code 0)");
    process.exit(0);
  } catch (err) {
    console.error("Billing Audit Execution Error:", err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

auditBilling();
