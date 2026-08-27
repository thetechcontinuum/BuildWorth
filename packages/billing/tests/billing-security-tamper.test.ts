import { describe, it, expect } from "vitest";
import { processStripeWebhookEvent } from "../src/webhook-service.js";
import { createBillingCheckoutSession } from "../src/checkout-service.js";

function createMockPrisma() {
  const db = {
    users: [
      { id: "usr_alice", email: "alice@buildworth.io", role: "USER", tier: "FREE" },
      { id: "usr_bob", email: "bob@buildworth.io", role: "USER", tier: "FREE" },
    ],
    customers: [{ id: "cus_db_alice", userId: "usr_alice", stripeCustomerId: "cus_stripe_alice" }],
    planPrices: [
      {
        id: "price_pro_monthly",
        stripePriceId: "price_test_pro_monthly",
        plan: { code: "PRO", isActive: true },
      },
    ],
    subscriptions: [] as any[],
    webhookEvents: [] as any[],
    checkoutAttempts: [] as any[],
    auditLogs: [] as any[],
  };

  const prisma: any = {
    billingWebhookEvent: {
      findUnique: async ({ where }: any) =>
        db.webhookEvents.find((e) => e.eventId === where.eventId) || null,
      create: async ({ data }: any) => {
        db.webhookEvents.push({ ...data, attemptCount: 1 });
        return data;
      },
      update: async ({ where, data }: any) => {
        const item = db.webhookEvents.find((e) => e.eventId === where.eventId);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    billingCustomer: {
      findUnique: async ({ where }: any) =>
        db.customers.find(
          (c) => c.stripeCustomerId === where.stripeCustomerId || c.userId === where.userId,
        ) || null,
      create: async ({ data }: any) => {
        const c = { id: `cus_${Date.now()}`, ...data };
        db.customers.push(c);
        return c;
      },
    },
    planPrice: {
      findFirst: async ({ where }: any) =>
        db.planPrices.find((p) => p.stripePriceId === where.stripePriceId) || null,
    },
    productPlan: {
      findUnique: async ({ where }: any) => {
        if (where.code === "PRO")
          return { code: "PRO", isActive: true, prices: [db.planPrices[0]] };
        return null;
      },
    },
    billingSubscription: {
      findUnique: async ({ where }: any) =>
        db.subscriptions.find((s) => s.stripeSubscriptionId === where.stripeSubscriptionId) || null,
      create: async ({ data }: any) => {
        db.subscriptions.push(data);
        return data;
      },
      update: async ({ where, data }: any) => {
        const item = db.subscriptions.find(
          (s) => s.id === where.id || s.stripeSubscriptionId === where.stripeSubscriptionId,
        );
        if (item) Object.assign(item, data);
        return item;
      },
    },
    billingCheckoutAttempt: {
      findUnique: async ({ where }: any) =>
        db.checkoutAttempts.find((a) => a.requestId === where.requestId) || null,
      create: async ({ data }: any) => {
        db.checkoutAttempts.push(data);
        return data;
      },
    },
    user: {
      update: async ({ where, data }: any) => {
        const user = db.users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data);
        return user;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        db.auditLogs.push(data);
        return data;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };

  return { prisma, db };
}

function createMockStripe() {
  return {
    customers: {
      create: async () => ({ id: `cus_stripe_${Date.now()}` }),
    },
    checkout: {
      sessions: {
        create: async () => ({
          id: `cs_${Date.now()}`,
          url: "https://checkout.stripe.com/pay/cs_1",
        }),
      },
    },
    webhooks: {
      constructEvent: (rawBody: any, signature: string, secret: string) => {
        if (signature !== "valid_sig") throw new Error("Invalid signature");
        return JSON.parse(rawBody.toString());
      },
    },
  } as any;
}

describe("Phase 4B Security, Ownership & Metadata Tamper Tests", () => {
  const secret = "whsec_test_secret";

  it("proves forged metadata userId in webhook cannot escalate privileges of victim or unearned user", async () => {
    const { prisma, db } = createMockPrisma();
    const stripe = createMockStripe();

    // Attacker sends webhook for Alice's customer ID, but puts Bob's ID in metadata
    const forgedWebhook = {
      id: "evt_forged_meta",
      type: "customer.subscription.created",
      created: 100,
      data: {
        object: {
          id: "sub_forged_1",
          customer: "cus_stripe_alice", // Alice's customer ID
          metadata: { userId: "usr_bob" }, // Forged metadata
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(forgedWebhook),
      "valid_sig",
      secret,
    );

    // Subscription MUST be bound to Alice (the verified customer owner), NEVER Bob!
    expect(db.subscriptions[0].userId).toBe("usr_alice");
    expect(db.users.find((u) => u.id === "usr_alice")?.tier).toBe("PRO");
    expect(db.users.find((u) => u.id === "usr_bob")?.tier).toBe("FREE");
  });

  it("fails closed on webhook referencing unknown Stripe customer", async () => {
    const { prisma, db } = createMockPrisma();
    const stripe = createMockStripe();

    const unknownCusWebhook = {
      id: "evt_unknown_cus",
      type: "customer.subscription.created",
      created: 100,
      data: {
        object: {
          id: "sub_unknown_cus",
          customer: "cus_unknown_nonexistent",
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(unknownCusWebhook),
      "valid_sig",
      secret,
    );

    // 0 subscriptions created
    expect(db.subscriptions.length).toBe(0);
  });

  it("fails closed on webhook referencing unknown or inactive price ID", async () => {
    const { prisma, db } = createMockPrisma();
    const stripe = createMockStripe();

    const unknownPriceWebhook = {
      id: "evt_unknown_price",
      type: "customer.subscription.created",
      created: 100,
      data: {
        object: {
          id: "sub_unknown_price",
          customer: "cus_stripe_alice",
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          items: { data: [{ price: { id: "price_malicious_unregistered" } }] },
        },
      },
    };

    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(unknownPriceWebhook),
      "valid_sig",
      secret,
    );

    expect(db.subscriptions.length).toBe(0);
    expect(db.users.find((u) => u.id === "usr_alice")?.tier).toBe("FREE");
  });

  it("enforces checkout idempotency and rejects conflicting parameters on reused requestId", async () => {
    const { prisma, db } = createMockPrisma();
    const stripe = createMockStripe();

    // 1. Initial checkout request
    const res1 = await createBillingCheckoutSession(prisma, stripe, {
      userId: "usr_alice",
      userEmail: "alice@buildworth.io",
      planCode: "PRO",
      billingInterval: "MONTHLY",
      requestId: "req_idem_100",
    });
    expect(res1.requestId).toBe("req_idem_100");
    expect(db.checkoutAttempts.length).toBe(1);

    // 2. Replay with identical params -> returns existing session without duplicate DB row
    const res2 = await createBillingCheckoutSession(prisma, stripe, {
      userId: "usr_alice",
      userEmail: "alice@buildworth.io",
      planCode: "PRO",
      billingInterval: "MONTHLY",
      requestId: "req_idem_100",
    });
    expect(res2.requestId).toBe("req_idem_100");
    expect(db.checkoutAttempts.length).toBe(1);

    // 3. Replay with conflicting interval -> throws IDEMPOTENCY_CONFLICT
    await expect(
      createBillingCheckoutSession(prisma, stripe, {
        userId: "usr_alice",
        userEmail: "alice@buildworth.io",
        planCode: "PRO",
        billingInterval: "ANNUAL", // Conflicting!
        requestId: "req_idem_100",
      }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
});
