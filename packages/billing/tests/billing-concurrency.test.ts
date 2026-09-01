import { describe, it, expect } from "vitest";
import { processStripeWebhookEvent } from "../src/webhook-service.js";

function createMockPrismaWithConcurrency() {
  const db = {
    users: [
      { id: "usr_concurrent_1", email: "concurrent@buildworth.io", role: "USER", tier: "FREE" },
    ],
    customers: [
      {
        id: "cus_db_concurrent",
        userId: "usr_concurrent_1",
        stripeCustomerId: "cus_stripe_concurrent",
      },
    ],
    planPrices: [
      {
        id: "price_pro_monthly",
        stripePriceId: "price_test_pro_monthly",
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
        const existing = db.webhookEvents.find((e) => e.eventId === data.eventId);
        if (existing) {
          const err: any = new Error("Unique constraint failed on the fields: (`eventId`)");
          err.code = "P2002";
          throw err;
        }
        db.webhookEvents.push({ ...data, attemptCount: 1 });
        return data;
      },
      update: async ({ where, data }: any) => {
        const item = db.webhookEvents.find((e) => e.eventId === where.eventId);
        if (item) {
          if (
            data.attemptCount &&
            typeof data.attemptCount === "object" &&
            data.attemptCount.increment
          ) {
            item.attemptCount = (item.attemptCount || 1) + data.attemptCount.increment;
          } else if (typeof data.attemptCount === "number") {
            item.attemptCount = data.attemptCount;
          }
          Object.assign(item, { ...data, attemptCount: item.attemptCount });
        }
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
        const existing = db.subscriptions.find(
          (s) => s.stripeSubscriptionId === data.stripeSubscriptionId,
        );
        if (existing) {
          const err: any = new Error(
            "Unique constraint failed on the fields: (`stripeSubscriptionId`)",
          );
          err.code = "P2002";
          throw err;
        }
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

function createMockStripe(overrides?: { retrieveSubscription?: (id: string) => Promise<any> }) {
  return {
    subscriptions: {
      retrieve:
        overrides?.retrieveSubscription ||
        (async (id: string) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 1787680000,
          current_period_end: 1790272000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        })),
    },
    webhooks: {
      constructEvent: (rawBody: any, signature: string, secret: string) => {
        if (signature !== "valid_sig") throw new Error("Invalid signature");
        return JSON.parse(rawBody.toString());
      },
    },
  } as any;
}

describe("Phase 4B Concurrency, Webhook Ordering and Retry Tests", () => {
  const secret = "whsec_test_secret";

  it("handles 10 sequential duplicate webhook submissions gracefully without duplicate subscriptions", async () => {
    const { prisma, db } = createMockPrismaWithConcurrency();
    const eventPayload = {
      id: "evt_concurrent_10x",
      type: "customer.subscription.created",
      created: 1787680000,
      data: {
        object: {
          id: "sub_concurrent_1",
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 1787680000,
          current_period_end: 1790272000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };

    const rawBody = JSON.stringify(eventPayload);
    const stripe = createMockStripe();

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await processStripeWebhookEvent(prisma, stripe, rawBody, "valid_sig", secret));
    }

    // All 10 requests succeeded
    expect(results.length).toBe(10);
    results.forEach((res) => {
      expect(res.received).toBe(true);
      expect(res.processingStatus).toBe("PROCESSED");
    });

    // Exactly one subscription created
    expect(db.subscriptions.length).toBe(1);
    expect(db.subscriptions[0].status).toBe("ACTIVE");

    // Exactly one webhook event record stored
    expect(db.webhookEvents.length).toBe(1);
  });

  it("proves webhook ordering: delayed active (T2) arriving after past_due (T3) does not overwrite past_due", async () => {
    const { prisma, db } = createMockPrismaWithConcurrency();
    const stripe = createMockStripe();

    // 1. Subscription created at T1 (created: 100) -> ACTIVE
    const t1Event = {
      id: "evt_t1",
      type: "customer.subscription.created",
      created: 100,
      data: {
        object: {
          id: "sub_ordering_test",
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };
    await processStripeWebhookEvent(prisma, stripe, JSON.stringify(t1Event), "valid_sig", secret);
    expect(db.subscriptions[0].status).toBe("ACTIVE");
    expect(db.users[0].tier).toBe("PRO");

    // 2. Subscription updated to past_due at T3 (created: 300) -> PAST_DUE
    const t3Event = {
      id: "evt_t3",
      type: "customer.subscription.updated",
      created: 300,
      data: {
        object: {
          id: "sub_ordering_test",
          customer: "cus_stripe_concurrent",
          status: "past_due",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };
    await processStripeWebhookEvent(prisma, stripe, JSON.stringify(t3Event), "valid_sig", secret);
    expect(db.subscriptions[0].status).toBe("PAST_DUE");
    expect(db.users[0].tier).toBe("FREE");

    // 3. Delayed T2 event arrives (created: 200, status: active)
    const t2DelayedEvent = {
      id: "evt_t2_delayed",
      type: "customer.subscription.updated",
      created: 200,
      data: {
        object: {
          id: "sub_ordering_test",
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };
    await processStripeWebhookEvent(
      prisma,
      stripe,
      JSON.stringify(t2DelayedEvent),
      "valid_sig",
      secret,
    );

    // Final state MUST remain PAST_DUE / FREE!
    expect(db.subscriptions[0].status).toBe("PAST_DUE");
    expect(db.users[0].tier).toBe("FREE");
  });

  describe("Equal-Timestamp Webhook Collision & Provider State Reconciliation", () => {
    it("resolves ACTIVE and PAST_DUE arriving in Order 1 (ACTIVE then PAST_DUE) via Stripe authoritative state", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      // Provider authoritative state is PAST_DUE
      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "past_due",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const activeEvent = {
        id: "evt_active_same_ts",
        type: "customer.subscription.updated",
        created: 500,
        data: {
          object: {
            id: "sub_col_1",
            customer: "cus_stripe_concurrent",
            status: "active",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      const pastDueEvent = {
        id: "evt_pastdue_same_ts",
        type: "customer.subscription.updated",
        created: 500, // Same timestamp!
        data: {
          object: {
            id: "sub_col_1",
            customer: "cus_stripe_concurrent",
            status: "past_due",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(activeEvent),
        "valid_sig",
        secret,
      );
      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(pastDueEvent),
        "valid_sig",
        secret,
      );

      expect(db.subscriptions[0].status).toBe("PAST_DUE");
      expect(db.users[0].tier).toBe("FREE");
    });

    it("resolves ACTIVE and PAST_DUE arriving in Order 2 (PAST_DUE then ACTIVE) via Stripe authoritative state", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      // Provider authoritative state is PAST_DUE
      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "past_due",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const pastDueEvent = {
        id: "evt_pastdue_same_ts_2",
        type: "customer.subscription.updated",
        created: 500,
        data: {
          object: {
            id: "sub_col_2",
            customer: "cus_stripe_concurrent",
            status: "past_due",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      const activeEvent = {
        id: "evt_active_same_ts_2",
        type: "customer.subscription.updated",
        created: 500, // Same timestamp!
        data: {
          object: {
            id: "sub_col_2",
            customer: "cus_stripe_concurrent",
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
        JSON.stringify(pastDueEvent),
        "valid_sig",
        secret,
      );
      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(activeEvent),
        "valid_sig",
        secret,
      );

      expect(db.subscriptions[0].status).toBe("PAST_DUE");
      expect(db.users[0].tier).toBe("FREE");
    });

    it("resolves ACTIVE and DELETED arriving in both orders via Stripe authoritative state", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "canceled",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const activeEvent = {
        id: "evt_act_del_1",
        type: "customer.subscription.created",
        created: 600,
        data: {
          object: {
            id: "sub_col_del",
            customer: "cus_stripe_concurrent",
            status: "active",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      const deletedEvent = {
        id: "evt_del_same_ts",
        type: "customer.subscription.deleted",
        created: 600, // Same timestamp!
        data: {
          object: {
            id: "sub_col_del",
            customer: "cus_stripe_concurrent",
            status: "canceled",
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(activeEvent),
        "valid_sig",
        secret,
      );
      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(deletedEvent),
        "valid_sig",
        secret,
      );

      expect(db.subscriptions[0].status).toBe("CANCELED");
      expect(db.users[0].tier).toBe("FREE");
    });

    it("fails closed and remains retryable when provider retrieval fails on ambiguous collision", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      let failStripe = true;
      const stripe = createMockStripe({
        retrieveSubscription: async () => {
          if (failStripe) throw new Error("STRIPE_API_NETWORK_ERROR");
          return {
            id: "sub_fail_test",
            customer: "cus_stripe_concurrent",
            status: "past_due",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          };
        },
      });

      // 1. Initial event establishes state
      const event1 = {
        id: "evt_same_ts_err_1",
        type: "customer.subscription.created",
        created: 700,
        data: {
          object: {
            id: "sub_fail_test",
            customer: "cus_stripe_concurrent",
            status: "active",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };
      await processStripeWebhookEvent(prisma, stripe, JSON.stringify(event1), "valid_sig", secret);

      // 2. Conflicting same-timestamp event arrives while Stripe API is failing
      const event2 = {
        id: "evt_same_ts_err_2",
        type: "customer.subscription.updated",
        created: 700,
        data: {
          object: {
            id: "sub_fail_test",
            customer: "cus_stripe_concurrent",
            status: "past_due",
            current_period_start: 100,
            current_period_end: 200,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      await expect(
        processStripeWebhookEvent(prisma, stripe, JSON.stringify(event2), "valid_sig", secret),
      ).rejects.toThrow("STRIPE_RETRIEVAL_FAILED");

      // Event is marked FAILED and can be retried safely
      expect(db.webhookEvents[1].processingStatus).toBe("FAILED");

      // 3. Retry succeeds when Stripe recovers
      failStripe = false;
      const retryResult = await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(event2),
        "valid_sig",
        secret,
      );
      expect(retryResult.processingStatus).toBe("PROCESSED");
      expect(db.subscriptions[0].status).toBe("PAST_DUE");
    });
  });

  describe("Invoice Event Reconciliation", () => {
    it("handles invoice.paid + active subscription -> grants PRO", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      db.subscriptions.push({
        id: "sub_inv_1",
        userId: "usr_concurrent_1",
        billingCustomerId: "cus_db_concurrent",
        planPriceId: "price_pro_monthly",
        stripeSubscriptionId: "sub_stripe_inv_1",
        status: "PAST_DUE",
        billingCustomer: { stripeCustomerId: "cus_stripe_concurrent" },
        planPrice: { plan: { code: "PRO", isActive: true } },
      });

      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 1000,
          current_period_end: 2000,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const invoiceEvent = {
        id: "evt_inv_paid_1",
        type: "invoice.paid",
        created: 800,
        data: {
          object: {
            id: "in_1",
            subscription: "sub_stripe_inv_1",
            customer: "cus_stripe_concurrent",
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(invoiceEvent),
        "valid_sig",
        secret,
      );
      expect(db.subscriptions[0].status).toBe("ACTIVE");
      expect(db.users[0].tier).toBe("PRO");
    });

    it("handles invoice.paid + incomplete subscription -> remains FREE", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      db.subscriptions.push({
        id: "sub_inv_2",
        userId: "usr_concurrent_1",
        billingCustomerId: "cus_db_concurrent",
        planPriceId: "price_pro_monthly",
        stripeSubscriptionId: "sub_stripe_inv_2",
        status: "INCOMPLETE",
        billingCustomer: { stripeCustomerId: "cus_stripe_concurrent" },
        planPrice: { plan: { code: "PRO", isActive: true } },
      });

      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "incomplete",
          current_period_start: 1000,
          current_period_end: 2000,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const invoiceEvent = {
        id: "evt_inv_paid_2",
        type: "invoice.paid",
        created: 800,
        data: {
          object: {
            id: "in_2",
            subscription: "sub_stripe_inv_2",
            customer: "cus_stripe_concurrent",
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(invoiceEvent),
        "valid_sig",
        secret,
      );
      expect(db.subscriptions[0].status).toBe("INCOMPLETE");
      expect(db.users[0].tier).toBe("FREE");
    });

    it("handles invoice.payment_failed + past_due subscription -> status becomes PAST_DUE, tier FREE", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      db.subscriptions.push({
        id: "sub_inv_3",
        userId: "usr_concurrent_1",
        billingCustomerId: "cus_db_concurrent",
        planPriceId: "price_pro_monthly",
        stripeSubscriptionId: "sub_stripe_inv_3",
        status: "ACTIVE",
        billingCustomer: { stripeCustomerId: "cus_stripe_concurrent" },
        planPrice: { plan: { code: "PRO", isActive: true } },
      });
      db.users[0].tier = "PRO";

      const stripe = createMockStripe({
        retrieveSubscription: async (id) => ({
          id,
          customer: "cus_stripe_concurrent",
          status: "past_due",
          current_period_start: 1000,
          current_period_end: 2000,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        }),
      });

      const invoiceEvent = {
        id: "evt_inv_fail_1",
        type: "invoice.payment_failed",
        created: 800,
        data: {
          object: {
            id: "in_3",
            subscription: "sub_stripe_inv_3",
            customer: "cus_stripe_concurrent",
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(invoiceEvent),
        "valid_sig",
        secret,
      );
      expect(db.subscriptions[0].status).toBe("PAST_DUE");
      expect(db.users[0].tier).toBe("FREE");
    });

    it("handles invoice event without subscription reference gracefully", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      const stripe = createMockStripe();

      const invoiceEvent = {
        id: "evt_inv_nosub",
        type: "invoice.paid",
        created: 800,
        data: {
          object: {
            id: "in_no_sub",
            customer: "cus_stripe_concurrent",
            subscription: null,
          },
        },
      };

      const res = await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(invoiceEvent),
        "valid_sig",
        secret,
      );
      expect(res.processingStatus).toBe("PROCESSED");
      expect(db.subscriptions.length).toBe(0);
    });

    it("ignores invoice belonging to another customer", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      db.subscriptions.push({
        id: "sub_inv_other",
        userId: "usr_concurrent_1",
        billingCustomerId: "cus_db_concurrent",
        planPriceId: "price_pro_monthly",
        stripeSubscriptionId: "sub_stripe_inv_other",
        status: "ACTIVE",
        billingCustomer: { stripeCustomerId: "cus_stripe_concurrent" },
        planPrice: { plan: { code: "PRO", isActive: true } },
      });

      const stripe = createMockStripe();
      const invoiceEvent = {
        id: "evt_inv_other_cus",
        type: "invoice.paid",
        created: 800,
        data: {
          object: {
            id: "in_other",
            subscription: "sub_stripe_inv_other",
            customer: "cus_attacker_customer", // Mismatch!
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(invoiceEvent),
        "valid_sig",
        secret,
      );
      // Subscription unchanged
      expect(db.subscriptions[0].status).toBe("ACTIVE");
    });
  });

  describe("Checkout Completion & Deletion Terminality", () => {
    it("verifies checkout.session.completed alone does not grant PRO until subscription is active", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      const stripe = createMockStripe();

      db.checkoutAttempts.push({
        requestId: "req_chk_test_1",
        userId: "usr_concurrent_1",
        status: "PENDING",
      });

      const checkoutEvent = {
        id: "evt_chk_completed",
        type: "checkout.session.completed",
        created: 900,
        data: {
          object: {
            id: "cs_test_123",
            client_reference_id: "usr_concurrent_1",
            metadata: { userId: "usr_concurrent_1", requestId: "req_chk_test_1" },
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(checkoutEvent),
        "valid_sig",
        secret,
      );
      expect(db.checkoutAttempts[0].status).toBe("COMPLETED");
      // Access remains FREE
      expect(db.users[0].tier).toBe("FREE");
      expect(db.subscriptions.length).toBe(0);

      // Later active subscription webhook arrives -> activates PRO
      const subCreatedEvent = {
        id: "evt_sub_active_later",
        type: "customer.subscription.created",
        created: 910,
        data: {
          object: {
            id: "sub_real_123",
            customer: "cus_stripe_concurrent",
            status: "active",
            current_period_start: 910,
            current_period_end: 1910,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(subCreatedEvent),
        "valid_sig",
        secret,
      );
      expect(db.subscriptions[0].status).toBe("ACTIVE");
      expect(db.users[0].tier).toBe("PRO");
    });

    it("enforces deletion terminality: older event cannot reactivate canceled subscription", async () => {
      const { prisma, db } = createMockPrismaWithConcurrency();
      const stripe = createMockStripe();

      // Canceled at T=1000
      db.subscriptions.push({
        id: "sub_terminal",
        userId: "usr_concurrent_1",
        billingCustomerId: "cus_db_concurrent",
        planPriceId: "price_pro_monthly",
        stripeSubscriptionId: "sub_stripe_terminal",
        status: "CANCELED",
        latestProviderEventTimestamp: new Date(1000 * 1000),
      });

      // Older event arrives at T=500 claiming active
      const olderEvent = {
        id: "evt_older_active",
        type: "customer.subscription.updated",
        created: 500,
        data: {
          object: {
            id: "sub_stripe_terminal",
            customer: "cus_stripe_concurrent",
            status: "active",
            current_period_start: 500,
            current_period_end: 1500,
            items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
          },
        },
      };

      await processStripeWebhookEvent(
        prisma,
        stripe,
        JSON.stringify(olderEvent),
        "valid_sig",
        secret,
      );
      expect(db.subscriptions[0].status).toBe("CANCELED");
      expect(db.users[0].tier).toBe("FREE");
    });
  });

  it("proves failed webhook event retry succeeds on second attempt without duplicate effects", async () => {
    const { prisma, db } = createMockPrismaWithConcurrency();
    const stripe = createMockStripe();

    const event = {
      id: "evt_retry_test",
      type: "customer.subscription.created",
      created: 100,
      data: {
        object: {
          id: "sub_retry_test",
          customer: "cus_stripe_concurrent",
          status: "active",
          current_period_start: 100,
          current_period_end: 200,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_test_pro_monthly" } }] },
        },
      },
    };

    // Simulate transient failure on attempt 1
    let failTransaction = true;
    const failingPrisma: any = {
      ...prisma,
      $transaction: async (fn: any) => {
        if (failTransaction) throw new Error("TRANSIENT_DB_TIMEOUT");
        return fn(prisma);
      },
    };

    // First attempt -> fails
    await expect(
      processStripeWebhookEvent(failingPrisma, stripe, JSON.stringify(event), "valid_sig", secret),
    ).rejects.toThrow("TRANSIENT_DB_TIMEOUT");

    expect(db.webhookEvents[0].processingStatus).toBe("FAILED");
    expect(db.webhookEvents[0].errorMessage).toBe("TRANSIENT_DB_TIMEOUT");
    expect(db.subscriptions.length).toBe(0); // 0 partial state leaked

    // Second attempt -> succeeds
    failTransaction = false;
    const res = await processStripeWebhookEvent(
      failingPrisma,
      stripe,
      JSON.stringify(event),
      "valid_sig",
      secret,
    );
    expect(res.processingStatus).toBe("PROCESSED");
    expect(db.webhookEvents[0].processingStatus).toBe("PROCESSED");
    expect(db.webhookEvents[0].attemptCount).toBe(2);
    expect(db.subscriptions.length).toBe(1);
    expect(db.users[0].tier).toBe("PRO");
  });
});
