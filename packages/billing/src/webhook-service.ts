import Stripe from "stripe";
import { PrismaClient } from "@buildworth/database";
import crypto from "crypto";
import { mapStripeSubscriptionStatus } from "./subscription-mapper.js";

export interface ProcessWebhookResult {
  received: boolean;
  duplicate: boolean;
  eventId: string;
  eventType: string;
  processingStatus: "PROCESSED" | "IGNORED" | "FAILED";
  error?: string;
}

export function computePayloadHash(rawBody: string | Buffer): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export async function processStripeWebhookEvent(
  prisma: PrismaClient,
  stripe: Stripe,
  rawBody: string | Buffer,
  signature: string,
  webhookSecret: string,
): Promise<ProcessWebhookResult> {
  // 1. Verify Stripe-Signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    throw new Error(
      `WEBHOOK_SIGNATURE_VERIFICATION_FAILED: ${err?.message || "Invalid signature"}`,
    );
  }

  const eventId = event.id;
  const eventType = event.type;
  const payloadHash = computePayloadHash(rawBody);
  const eventCreated = event.created ? new Date(event.created * 1000) : new Date();

  // 2. Idempotency Check in BillingWebhookEvent
  let existingEvent = await prisma.billingWebhookEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent) {
    // Security check: If eventId reused but payloadHash differs -> defect
    if (existingEvent.payloadHash && existingEvent.payloadHash !== payloadHash) {
      throw new Error(
        `WEBHOOK_SECURITY_DEFECT: Event ID ${eventId} reused with differing payload hash.`,
      );
    }

    // If previously processed or ignored, return immediately
    if (
      existingEvent.processingStatus === "PROCESSED" ||
      existingEvent.processingStatus === "IGNORED"
    ) {
      return {
        received: true,
        duplicate: true,
        eventId,
        eventType,
        processingStatus: existingEvent.processingStatus as any,
      };
    }

    // If previously FAILED or PENDING, increment attempt count and retry processing
    await prisma.billingWebhookEvent.update({
      where: { eventId },
      data: {
        attemptCount: { increment: 1 },
        errorMessage: null,
      },
    });
  } else {
    // 3. Persist Pending BillingWebhookEvent (with race safety)
    try {
      await prisma.billingWebhookEvent.create({
        data: {
          eventId,
          eventType,
          payloadHash,
          payload: event as any,
          processingStatus: "PENDING",
          attemptCount: 1,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        // Handled race: another concurrent request created the record
        const fetched = await prisma.billingWebhookEvent.findUnique({ where: { eventId } });
        if (fetched?.processingStatus === "PROCESSED") {
          return {
            received: true,
            duplicate: true,
            eventId,
            eventType,
            processingStatus: "PROCESSED",
          };
        }
      } else {
        throw err;
      }
    }
  }

  // 4. Process event within database transaction
  try {
    await prisma.$transaction(async (tx: any) => {
      switch (eventType) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(tx, session);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpsert(tx, stripe, subscription, eventCreated);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(tx, stripe, subscription, eventCreated);
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(tx, stripe, invoice, eventCreated);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentFailed(tx, stripe, invoice, eventCreated);
          break;
        }

        default:
          // Unhandled event types are marked IGNORED
          break;
      }

      // Mark event as PROCESSED
      await tx.billingWebhookEvent.update({
        where: { eventId },
        data: {
          processingStatus: "PROCESSED",
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    });

    return {
      received: true,
      duplicate: !!existingEvent,
      eventId,
      eventType,
      processingStatus: "PROCESSED",
    };
  } catch (err: any) {
    // Record error state in DB
    await prisma.billingWebhookEvent
      .update({
        where: { eventId },
        data: {
          processingStatus: "FAILED",
          errorMessage: err?.message || "Unknown error",
        },
      })
      .catch(() => {});

    throw err;
  }
}

async function handleCheckoutSessionCompleted(tx: any, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || (session.client_reference_id as string);
  const requestId = session.metadata?.requestId;

  if (requestId) {
    await tx.billingCheckoutAttempt.updateMany({
      where: { requestId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  }

  // Audit log entry
  if (userId) {
    await tx.auditLog.create({
      data: {
        userId,
        action: "BILLING_CHECKOUT_COMPLETED",
        entityType: "CHECKOUT_SESSION",
        entityId: session.id,
        details: {
          sessionId: session.id,
          requestId,
        },
      },
    });

    // Emit Server-Authoritative CHECKOUT_COMPLETED Commercial Event
    try {
      const { recordCommercialEvent } = await import("./commercial-events.js");
      const attempt = requestId
        ? await tx.billingCheckoutAttempt.findUnique({ where: { requestId } })
        : null;

      await recordCommercialEvent(tx, {
        eventType: "CHECKOUT_COMPLETED",
        deduplicationKey: `chk_completed_${session.id}`,
        userId,
        checkoutAttemptId: attempt?.id || null,
        source: "WEBHOOK_PROCESSOR",
        metadata: {
          planCode: attempt?.selectedPlanCode || "PRO",
          billingInterval: attempt?.billingInterval || "MONTHLY",
          catalogKey: attempt?.selectedPlanCode === "PRO" && attempt?.billingInterval === "ANNUAL" ? "pro_annual" : "pro_monthly",
          stripeEventId: session.id,
        },
      });
    } catch (err: any) {
      console.error("Commercial Event Emission Error:", err?.message || err);
    }
  }
}

async function handleSubscriptionUpsert(
  tx: any,
  stripe: Stripe,
  sub: Stripe.Subscription,
  eventCreated: Date,
) {
  let targetSub = sub;

  const existingSub = await tx.billingSubscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (existingSub) {
    // 1. Terminal cancellation protection: If already CANCELED, do not allow resurrection from older events
    if (
      existingSub.status === "CANCELED" &&
      (!existingSub.latestProviderEventTimestamp ||
        existingSub.latestProviderEventTimestamp > eventCreated)
    ) {
      return;
    }

    // 2. Strict older-event protection
    if (
      existingSub.latestProviderEventTimestamp &&
      existingSub.latestProviderEventTimestamp > eventCreated
    ) {
      return;
    }

    // 3. Same-timestamp collision check:
    // If event.created === latestProviderEventTimestamp, retrieve authoritative state from Stripe adapter
    const currentMapped = mapStripeSubscriptionStatus(sub.status);
    if (
      existingSub.latestProviderEventTimestamp &&
      existingSub.latestProviderEventTimestamp.getTime() === eventCreated.getTime() &&
      existingSub.status !== currentMapped
    ) {
      try {
        targetSub = await stripe.subscriptions.retrieve(sub.id);
      } catch (err: any) {
        throw new Error(
          `STRIPE_RETRIEVAL_FAILED: Could not retrieve authoritative subscription ${sub.id}: ${err?.message || "Unknown error"}`,
        );
      }
    }
  }

  const stripeCustomerId =
    typeof targetSub.customer === "string" ? targetSub.customer : targetSub.customer.id;
  const customer = await tx.billingCustomer.findUnique({
    where: { stripeCustomerId },
    include: { user: true },
  });

  if (!customer) {
    // Unknown provider customer -> fail closed, ignore
    return;
  }

  const userId = customer.userId;
  const priceItem = targetSub.items?.data?.[0]?.price;
  const stripePriceId = priceItem?.id;

  if (!stripePriceId) return;

  const planPrice = await tx.planPrice.findFirst({
    where: { stripePriceId, isActive: true },
    include: { plan: true },
  });

  if (!planPrice || !planPrice.plan?.isActive) {
    // Unknown or inactive price ID -> fail closed, ignore
    return;
  }

  const mappedStatus = mapStripeSubscriptionStatus(targetSub.status);
  const periodStart = new Date(targetSub.current_period_start * 1000);
  const periodEnd = new Date(targetSub.current_period_end * 1000);
  const trialStart = targetSub.trial_start ? new Date(targetSub.trial_start * 1000) : null;
  const trialEnd = targetSub.trial_end ? new Date(targetSub.trial_end * 1000) : null;
  const canceledAt = targetSub.canceled_at ? new Date(targetSub.canceled_at * 1000) : null;

  if (existingSub) {
    // Terminal cancellation protection: never let ambiguous snapshot restore access if target is CANCELED
    if (
      existingSub.status === "CANCELED" &&
      mappedStatus !== "CANCELED" &&
      existingSub.latestProviderEventTimestamp &&
      existingSub.latestProviderEventTimestamp.getTime() >= eventCreated.getTime()
    ) {
      // Re-verify if retrieved was truly not canceled; if targetSub was retrieved and status is indeed not canceled, update. Otherwise ignore.
      if (targetSub === sub) return;
    }

    await tx.billingSubscription.update({
      where: { id: existingSub.id },
      data: {
        planPriceId: planPrice.id,
        status: mappedStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: targetSub.cancel_at_period_end,
        canceledAt,
        trialStart,
        trialEnd,
        latestProviderEventTimestamp: eventCreated,
      },
    });
  } else {
    await tx.billingSubscription.create({
      data: {
        userId,
        billingCustomerId: customer.id,
        planPriceId: planPrice.id,
        stripeSubscriptionId: targetSub.id,
        status: mappedStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: targetSub.cancel_at_period_end,
        canceledAt,
        trialStart,
        trialEnd,
        latestProviderEventTimestamp: eventCreated,
      },
    });
  }

  // Update User.tier read projection (never the authorization source)
  const isSubscriberActive = mappedStatus === "ACTIVE" || mappedStatus === "TRIALING";
  const projectedTier =
    isSubscriberActive && planPrice.plan.isActive ? planPrice.plan.code : "FREE";

  await tx.user.update({
    where: { id: userId },
    data: { tier: projectedTier },
  });

  // Audit log
  await tx.auditLog.create({
    data: {
      userId,
      action: "BILLING_SUBSCRIPTION_SYNCHRONIZED",
      entityType: "BILLING_SUBSCRIPTION",
      entityId: targetSub.id,
      details: {
        status: mappedStatus,
        planCode: planPrice.plan.code,
        periodEnd: periodEnd.toISOString(),
        eventTimestamp: eventCreated.toISOString(),
      },
    },
  });

  // Emit Server-Authoritative ENTITLEMENT_ACTIVATED Commercial Event when subscriber is active
  if (isSubscriberActive && projectedTier === "PRO") {
    try {
      const { recordCommercialEvent } = await import("./commercial-events.js");
      await recordCommercialEvent(tx, {
        eventType: "ENTITLEMENT_ACTIVATED",
        deduplicationKey: `ent_activated_${targetSub.id}_${periodStart.getTime()}`,
        userId,
        source: "WEBHOOK_PROCESSOR",
        metadata: {
          tier: "PRO",
          planCode: planPrice.plan.code,
          billingInterval: planPrice.billingInterval,
          subscriptionStatus: mappedStatus,
          periodEnd: periodEnd.toISOString(),
          stripeEventId: targetSub.id,
        },
      });
    } catch (err: any) {
      console.error("Commercial Event Emission Error:", err?.message || err);
    }
  }
}

async function handleSubscriptionDeleted(
  tx: any,
  stripe: Stripe,
  sub: Stripe.Subscription,
  eventCreated: Date,
) {
  const stripeSubscriptionId = sub.id;
  const existingSub = await tx.billingSubscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!existingSub) return;

  // Ordering check: deletion should never be undone by older events
  if (
    existingSub.latestProviderEventTimestamp &&
    existingSub.latestProviderEventTimestamp > eventCreated
  ) {
    return;
  }

  let finalStatus = "CANCELED";

  // Same-timestamp check
  if (
    existingSub.latestProviderEventTimestamp &&
    existingSub.latestProviderEventTimestamp.getTime() === eventCreated.getTime() &&
    existingSub.status !== "CANCELED"
  ) {
    try {
      const retrieved = await stripe.subscriptions.retrieve(sub.id);
      finalStatus = mapStripeSubscriptionStatus(retrieved.status);
    } catch (err: any) {
      throw new Error(
        `STRIPE_RETRIEVAL_FAILED: Could not retrieve authoritative subscription ${sub.id}: ${err?.message || "Unknown error"}`,
      );
    }
  }

  await tx.billingSubscription.update({
    where: { id: existingSub.id },
    data: {
      status: finalStatus,
      canceledAt: finalStatus === "CANCELED" ? new Date() : existingSub.canceledAt,
      latestProviderEventTimestamp: eventCreated,
    },
  });

  // Revert User.tier read projection if canceled
  const isSubscriberActive = finalStatus === "ACTIVE" || finalStatus === "TRIALING";
  const projectedTier = isSubscriberActive ? existingSub.planPrice?.plan?.code || "PRO" : "FREE";

  await tx.user.update({
    where: { id: existingSub.userId },
    data: { tier: projectedTier },
  });

  // Graceful Downgrade Policy:
  // If user downgraded to FREE and has > 3 watched opportunities:
  // - Preserve ALL saved records (never delete user data)
  // - Keep radarEnabled = true on the 3 most recently saved watches
  // - Set radarEnabled = false on excess watches (ranked 4th and beyond)
  if (projectedTier === "FREE" && tx.savedOpportunity) {
    const userWatches = await tx.savedOpportunity.findMany({
      where: { userId: existingSub.userId },
      orderBy: { createdAt: "desc" },
    });

    if (userWatches && userWatches.length > 3) {
      const excessWatches = userWatches.slice(3);
      const excessIds = excessWatches.map((w: any) => w.id);

      await tx.savedOpportunity.updateMany({
        where: { id: { in: excessIds } },
        data: {
          radarEnabled: false,
          alertCadence: "WEEKLY_DIGEST",
        },
      });

      // Cancel any pending instant alert notifications for these disabled watches
      if (tx.notificationOutbox) {
        await tx.notificationOutbox.updateMany({
          where: {
            userId: existingSub.userId,
            status: "PENDING",
            notificationType: "RADAR_CHANGE_ALERT",
          },
          data: {
            status: "CANCELLED",
            sanitizedLastError: "TIER_DOWNGRADED_TO_FREE",
          },
        });
      }
    }
  }

  await tx.auditLog.create({
    data: {
      userId: existingSub.userId,
      action: "BILLING_SUBSCRIPTION_CANCELED",
      entityType: "BILLING_SUBSCRIPTION",
      entityId: sub.id,
      details: { status: finalStatus, eventTimestamp: eventCreated.toISOString() },
    },
  });
}

async function handleInvoicePaid(
  tx: any,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventCreated: Date,
) {
  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;

  const existingSub = await tx.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subId },
    include: { billingCustomer: true, planPrice: { include: { plan: true } } },
  });

  if (!existingSub) return;

  // Verify customer ownership if customer specified in invoice
  const invoiceCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (invoiceCustomerId && existingSub.billingCustomer.stripeCustomerId !== invoiceCustomerId) {
    return;
  }

  if (
    existingSub.latestProviderEventTimestamp &&
    existingSub.latestProviderEventTimestamp > eventCreated
  ) {
    return;
  }

  // Retrieve current subscription state through the Stripe adapter
  let retrievedSub: Stripe.Subscription;
  try {
    retrievedSub = await stripe.subscriptions.retrieve(subId);
  } catch (err: any) {
    throw new Error(
      `STRIPE_RETRIEVAL_FAILED: Could not retrieve authoritative subscription ${subId}: ${err?.message || "Unknown error"}`,
    );
  }

  // Validate customer ownership on retrieved sub
  const retrievedCustId =
    typeof retrievedSub.customer === "string" ? retrievedSub.customer : retrievedSub.customer.id;
  if (retrievedCustId !== existingSub.billingCustomer.stripeCustomerId) {
    return;
  }

  // Validate active allowlisted Price ID
  const priceItem = retrievedSub.items?.data?.[0]?.price;
  const stripePriceId = priceItem?.id;
  if (!stripePriceId) return;

  const planPrice = await tx.planPrice.findFirst({
    where: { stripePriceId, isActive: true },
    include: { plan: true },
  });
  if (!planPrice || !planPrice.plan?.isActive) return;

  const mappedStatus = mapStripeSubscriptionStatus(retrievedSub.status);
  const isGrantEligible = mappedStatus === "ACTIVE" || mappedStatus === "TRIALING";

  const periodStart = new Date(retrievedSub.current_period_start * 1000);
  const periodEnd = new Date(retrievedSub.current_period_end * 1000);

  await tx.billingSubscription.update({
    where: { id: existingSub.id },
    data: {
      planPriceId: planPrice.id,
      status: mappedStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      latestProviderEventTimestamp: eventCreated,
    },
  });

  await tx.user.update({
    where: { id: existingSub.userId },
    data: { tier: isGrantEligible ? planPrice.plan.code : "FREE" },
  });
}

async function handleInvoicePaymentFailed(
  tx: any,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventCreated: Date,
) {
  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;

  const existingSub = await tx.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subId },
    include: { billingCustomer: true, planPrice: { include: { plan: true } } },
  });

  if (!existingSub) return;

  // Verify customer ownership
  const invoiceCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (invoiceCustomerId && existingSub.billingCustomer.stripeCustomerId !== invoiceCustomerId) {
    return;
  }

  if (
    existingSub.latestProviderEventTimestamp &&
    existingSub.latestProviderEventTimestamp > eventCreated
  ) {
    return;
  }

  // Retrieve current subscription from Stripe
  let retrievedSub: Stripe.Subscription;
  try {
    retrievedSub = await stripe.subscriptions.retrieve(subId);
  } catch (err: any) {
    throw new Error(
      `STRIPE_RETRIEVAL_FAILED: Could not retrieve authoritative subscription ${subId}: ${err?.message || "Unknown error"}`,
    );
  }

  const mappedStatus = mapStripeSubscriptionStatus(retrievedSub.status);
  const periodStart = new Date(retrievedSub.current_period_start * 1000);
  const periodEnd = new Date(retrievedSub.current_period_end * 1000);

  await tx.billingSubscription.update({
    where: { id: existingSub.id },
    data: {
      status: mappedStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      latestProviderEventTimestamp: eventCreated,
    },
  });

  // Revert User.tier projection to FREE (or active if somehow still active/trialing)
  const isSubscriberActive = mappedStatus === "ACTIVE" || mappedStatus === "TRIALING";
  await tx.user.update({
    where: { id: existingSub.userId },
    data: { tier: isSubscriberActive ? existingSub.planPrice?.plan?.code || "PRO" : "FREE" },
  });
}
