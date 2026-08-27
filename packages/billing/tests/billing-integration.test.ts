import { describe, it, expect } from "vitest";
import { processStripeWebhookEvent, computePayloadHash } from "../src/webhook-service.js";

// Mock Database & Mock Stripe
function createMockPrisma() {
  const db = {
    users: [{ id: "usr_int_1", email: "subscriber@buildworth.io", role: "USER", tier: "FREE" }],
    customers: [{ id: "cus_db_1", userId: "usr_int_1", stripeCustomerId: "cus_stripe_123" }],
    planPrices: [
      {
        id: "price_pro_monthly",
        stripePriceId: "price_stripe_pro_monthly",
        plan: { code: "PRO", isActive: true },
      },
    ],
    subscriptions: [] as any[],
    webhookEvents: [] as any[],
    auditLogs: [] as any[],
    checkoutAttempts: [] as any[],
  };

  const prisma: any = {
    billingWebhookEvent: {
      findUnique: async ({ where }: any) =>
        db.webhookEvents.find((e) => e.eventId === where.eventId) || null,
      create: async ({ data }: any) => {
        db.webhookEvents.push(data);
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
        db.customers.find((c) => c.stripeCustomerId === where.stripeCustomerId) || null,
    },
    planPrice: {
      findFirst: async ({ where }: any) =>
        db.planPrices.find((p) => p.stripePriceId === where.stripePriceId) || null,
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
      updateMany: async ({ where, data }: any) => {
        const item = db.checkoutAttempts.find((a) => a.requestId === where.requestId);
        if (item) Object.assign(item, data);
        return { count: 1 };
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

function createMockStripe(eventsMap: Record<string, any>) {
  return {
    webhooks: {
      constructEvent: (rawBody: any, signature: string, secret: string) => {
        if (signature !== "valid_sig") {
          throw new Error("Invalid signature");
        }
        const parsed = JSON.parse(rawBody.toString());
        return parsed;
      },
    },
  } as any;
}

describe("Phase 4B Webhook Idempotency, Ordering and Status Processing", () => {
  const secret = "whsec_test_secret";

  it("processes subscription.created event and projects PRO tier", async () => {
    const { prisma, db } = createMockPrisma();
    const eventPayload = {
      id: "evt_sub_created_1",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_stripe_abc",
          customer: "cus_stripe_123",
          status: "active",
          current_period_start: 1787680000,
          current_period_end: 1790272000,
          cancel_at_period_end: false,
          items: {
            data: [{ price: { id: "price_stripe_pro_monthly" } }],
          },
        },
      },
    };

    const rawBody = JSON.stringify(eventPayload);
    const stripe = createMockStripe({});

    const res = await processStripeWebhookEvent(prisma, stripe, rawBody, "valid_sig", secret);
    expect(res.received).toBe(true);
    expect(res.duplicate).toBe(false);
    expect(res.processingStatus).toBe("PROCESSED");

    // Subscription created in DB
    expect(db.subscriptions.length).toBe(1);
    expect(db.subscriptions[0].status).toBe("ACTIVE");
    expect(db.subscriptions[0].userId).toBe("usr_int_1");

    // User.tier read projection updated
    expect(db.users[0].tier).toBe("PRO");
  });

  it("handles exact duplicate webhook event idempotently without double-processing", async () => {
    const { prisma, db } = createMockPrisma();
    const eventPayload = {
      id: "evt_duplicate_test",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_123",
          subscription: "sub_stripe_abc",
        },
      },
    };
    const rawBody = JSON.stringify(eventPayload);
    const stripe = createMockStripe({});

    // First call
    const res1 = await processStripeWebhookEvent(prisma, stripe, rawBody, "valid_sig", secret);
    expect(res1.duplicate).toBe(false);

    // Second call (exact replay)
    const res2 = await processStripeWebhookEvent(prisma, stripe, rawBody, "valid_sig", secret);
    expect(res2.duplicate).toBe(true);
    expect(res2.processingStatus).toBe("PROCESSED");
  });

  it("detects and rejects security defects on reused event ID with tampered payload hash", async () => {
    const { prisma } = createMockPrisma();
    const eventPayload = {
      id: "evt_tamper_test",
      type: "invoice.paid",
      data: { object: { id: "in_1", subscription: "sub_1" } },
    };
    const rawBody1 = JSON.stringify(eventPayload);
    const stripe = createMockStripe({});

    await processStripeWebhookEvent(prisma, stripe, rawBody1, "valid_sig", secret);

    // Tampered payload with same event ID
    const rawBody2 = JSON.stringify({
      id: "evt_tamper_test",
      type: "invoice.paid",
      data: { object: { id: "in_1", subscription: "sub_1" } },
      malicious: true,
    });
    await expect(
      processStripeWebhookEvent(prisma, stripe, rawBody2, "valid_sig", secret),
    ).rejects.toThrow("WEBHOOK_SECURITY_DEFECT");
  });

  it("processes subscription.deleted and demotes projected tier back to FREE", async () => {
    const { prisma, db } = createMockPrisma();
    db.subscriptions.push({
      id: "sub_existing_1",
      userId: "usr_int_1",
      stripeSubscriptionId: "sub_stripe_abc",
      status: "ACTIVE",
    });
    db.users[0].tier = "PRO";

    const deleteEvent = {
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_stripe_abc",
          customer: "cus_stripe_123",
        },
      },
    };

    const stripe = createMockStripe({});
    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(deleteEvent),
      "valid_sig",
      secret,
    );

    expect(db.subscriptions[0].status).toBe("CANCELED");
    expect(db.users[0].tier).toBe("FREE");
  });

  it("fails closed on invalid Stripe webhook signatures", async () => {
    const { prisma } = createMockPrisma();
    const stripe = createMockStripe({});

    await expect(
      processStripeWebhookEvent(prisma, stripe, "{}", "invalid_sig", secret),
    ).rejects.toThrow("WEBHOOK_SIGNATURE_VERIFICATION_FAILED");
  });
});
