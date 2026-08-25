const path = require("path");
const { execSync } = require("child_process");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { createBillingCheckoutSession, createBillingPortalSession, processStripeWebhookEvent } = require("../../billing/dist/index.js");
const { resolveUserEntitlements, checkEntitlement } = require("../../entitlements/dist/index.js");

// Mock Stripe Driver for Local Automated Verification
function getMockStripe() {
  return {
    customers: {
      create: async (data, opts) => ({ id: `cus_stripe_mock_${Date.now()}` }),
    },
    checkout: {
      sessions: {
        create: async (data, opts) => ({
          id: `cs_test_${Date.now()}`,
          url: `https://checkout.stripe.com/c/pay/cs_test_${Date.now()}`,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: async (data) => ({
          url: `https://billing.stripe.com/p/session/test_${Date.now()}`,
        }),
      },
    },
    subscriptions: {
      retrieve: async (subId) => ({
        id: subId,
        customer: "cus_stripe_mock_123",
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
        items: {
          data: [{ price: { id: "price_test_pro_monthly" } }],
        },
      }),
    },
    webhooks: {
      constructEvent: (rawBody, signature, secret) => {
        if (signature !== "sig_test_valid") throw new Error("Invalid signature");
        return JSON.parse(rawBody.toString());
      },
    },
  };
}

async function testPhase4bBilling() {
  console.log("=== BuildWorth Phase 4B Stripe Checkout & Webhook Integration Suite ===");

  const dbName = "test_phase4b_billing_" + Date.now();
  execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`);

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy all migrations (Phase 1 through 4B)
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    // 2. Reconcile Plan Catalog
    execSync(`DATABASE_URL="${dbUrl}" node "${path.resolve(__dirname, "reconcile-catalog.js")}"`, { stdio: "pipe" });


    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    const stripe = getMockStripe();

    // 3. Create User
    const user = await prisma.user.create({
      data: { email: "founder.billing.test@buildworth.io", name: "Billing Founder", role: "USER", tier: "FREE" },
    });

    console.log("Test 1: Checkout Session Creation Flow...");
    const checkoutResult = await createBillingCheckoutSession(prisma, stripe, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      planCode: "PRO",
      billingInterval: "MONTHLY",
    });

    if (!checkoutResult.checkoutUrl || !checkoutResult.sessionId) {
      throw new Error("Checkout session creation failed to return URL or ID");
    }

    const recordedAttempt = await prisma.billingCheckoutAttempt.findUnique({
      where: { requestId: checkoutResult.requestId },
    });
    if (!recordedAttempt || recordedAttempt.status !== "PENDING") {
      throw new Error("Checkout attempt was not recorded in PENDING state");
    }
    console.log("  ✓ Checkout session generated and attempt recorded in DB.");

    console.log("Test 2: Webhook checkout.session.completed...");
    const checkoutEvent = {
      id: `evt_chk_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: checkoutResult.sessionId,
          client_reference_id: user.id,
          metadata: { userId: user.id, requestId: checkoutResult.requestId },
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(checkoutEvent),
      "sig_test_valid",
      "whsec_test_secret"
    );

    const completedAttempt = await prisma.billingCheckoutAttempt.findUnique({
      where: { requestId: checkoutResult.requestId },
    });
    if (completedAttempt.status !== "COMPLETED") {
      throw new Error("Checkout attempt status was not updated to COMPLETED");
    }
    console.log("  ✓ Webhook verified checkout and completed checkout attempt.");

    console.log("Test 3: Webhook customer.subscription.created...");
    const subCreatedEvent = {
      id: `evt_sub_${Date.now()}`,
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_stripe_real_123",
          customer: (await prisma.billingCustomer.findUnique({ where: { userId: user.id } })).stripeCustomerId,
          status: "active",
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          cancel_at_period_end: false,
          items: {
            data: [{ price: { id: "price_test_pro_monthly" } }],
          },
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(subCreatedEvent),
      "sig_test_valid",
      "whsec_test_secret"
    );

    // Verify DB state
    const subRecord = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: "sub_stripe_real_123" },
    });
    if (!subRecord || subRecord.status !== "ACTIVE") {
      throw new Error("Subscription record was not created with ACTIVE status");
    }

    // Verify User.tier read projection updated
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (updatedUser.tier !== "PRO") {
      throw new Error(`Expected User.tier projection to be PRO, got ${updatedUser.tier}`);
    }

    // Verify server-authoritative entitlement resolution
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        billingSubscriptions: {
          include: { planPrice: { include: { plan: true } } },
        },
      },
    });
    const ctx = resolveUserEntitlements(fullUser, new Date(), { isLiveEnvironment: false });
    if (ctx.tier !== "PRO") throw new Error(`Expected resolved PRO tier, got ${ctx.tier}`);
    const checkExp = checkEntitlement(ctx, "VENTURE_BLUEPRINT_EXPORT");
    if (!checkExp.allowed) throw new Error("Pro subscriber denied blueprint export");
    console.log("  ✓ Subscription created, projection updated, and entitlements activated.");

    console.log("Test 4: Customer Portal Session Creation...");
    const portalResult = await createBillingPortalSession(prisma, stripe, { userId: user.id });
    if (!portalResult.portalUrl) throw new Error("Customer portal URL generation failed");
    console.log("  ✓ Customer portal URL generated successfully.");

    console.log("Test 5: Webhook customer.subscription.deleted...");
    const subDeletedEvent = {
      id: `evt_del_${Date.now()}`,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_stripe_real_123",
          customer: (await prisma.billingCustomer.findUnique({ where: { userId: user.id } })).stripeCustomerId,
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(subDeletedEvent),
      "sig_test_valid",
      "whsec_test_secret"
    );

    const deletedSub = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId: "sub_stripe_real_123" },
    });
    if (deletedSub.status !== "CANCELED") throw new Error("Subscription status was not updated to CANCELED");

    const demotedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (demotedUser.tier !== "FREE") throw new Error("User.tier projection was not demoted to FREE");
    console.log("  ✓ Subscription cancellation and tier demotion verified.");

    await prisma.$disconnect();
    execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`);

    console.log("\n=======================================================");
    console.log("Phase 4B End-to-End Billing Integration PASSED (5/5)!");
    console.log("=======================================================");
  } catch (err) {
    execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`);
    throw err;
  }
}

testPhase4bBilling().catch((err) => {
  console.error("Phase 4B integration test failed:", err);
  process.exit(1);
});
