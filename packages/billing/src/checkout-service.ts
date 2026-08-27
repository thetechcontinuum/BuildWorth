import Stripe from "stripe";
import { PrismaClient } from "@buildworth/database";
import crypto from "crypto";
import { ensureBillingCustomer } from "./customer-service.js";
import { getBillingConfig } from "./config.js";

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  userName?: string | null;
  planCode: "PRO";
  billingInterval: "MONTHLY" | "ANNUAL";
  requestId?: string;
  appUrlOverride?: string;
}

export interface CreateCheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  requestId: string;
}

export async function createBillingCheckoutSession(
  prisma: PrismaClient,
  stripe: Stripe,
  params: CreateCheckoutSessionParams,
): Promise<CreateCheckoutSessionResult> {
  const config = getBillingConfig();
  const appUrl = params.appUrlOverride || config.appUrl;

  // 1. Authorize requested plan
  if (params.planCode !== "PRO") {
    throw new Error("INVALID_PLAN: Only 'PRO' plan is currently eligible for checkout.");
  }

  if (params.billingInterval !== "MONTHLY" && params.billingInterval !== "ANNUAL") {
    throw new Error("INVALID_INTERVAL: Interval must be 'MONTHLY' or 'ANNUAL'.");
  }

  // 2. Check if requestId already exists for idempotency
  if (params.requestId) {
    const existingAttempt = await prisma.billingCheckoutAttempt.findUnique({
      where: { requestId: params.requestId },
    });

    if (existingAttempt) {
      if (
        existingAttempt.userId !== params.userId ||
        existingAttempt.selectedPlanCode !== params.planCode ||
        existingAttempt.billingInterval !== params.billingInterval
      ) {
        throw new Error("IDEMPOTENCY_CONFLICT: Reused request ID with conflicting parameters.");
      }

      if (existingAttempt.checkoutSessionId) {
        // Replay existing checkout session
        return {
          checkoutUrl: `https://checkout.stripe.com/c/pay/${existingAttempt.checkoutSessionId}`,
          sessionId: existingAttempt.checkoutSessionId,
          requestId: existingAttempt.requestId,
        };
      }
    }
  }

  // 3. Resolve active allowlisted PlanPrice from database
  const plan = await prisma.productPlan.findUnique({
    where: { code: params.planCode },
    include: {
      prices: {
        where: {
          billingInterval: params.billingInterval,
          isActive: true,
        },
      },
    },
  });

  const selectedPlanPrice = plan?.prices?.[0];
  if (!plan || !plan.isActive || !selectedPlanPrice) {
    throw new Error(
      `PRICE_NOT_FOUND: No active allowlisted price found for ${params.planCode} (${params.billingInterval}).`,
    );
  }

  if (!selectedPlanPrice.stripePriceId) {
    throw new Error(
      `STRIPE_PRICE_UNCONFIGURED: No Stripe price ID mapped for ${selectedPlanPrice.id}`,
    );
  }

  // Block TEST price IDs in LIVE environment
  if (config.isLiveBilling && selectedPlanPrice.stripePriceId.startsWith("price_test_")) {
    throw new Error(
      "SECURITY_ERROR: Test Stripe Price ID cannot be used in Live billing environment.",
    );
  }

  // 4. Ensure Billing Customer
  const { customerId } = await ensureBillingCustomer(
    prisma,
    stripe,
    params.userId,
    params.userEmail,
    params.userName,
  );

  // 5. Create deterministic Request & Idempotency Key
  const requestId = params.requestId || `req_chk_${crypto.randomBytes(16).toString("hex")}`;
  const idempotencyKey = `chk_idem_${params.userId}_${requestId}`;

  // 5. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create(
    {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPlanPrice.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: params.userId,
      metadata: {
        userId: params.userId,
        requestId,
        planCode: params.planCode,
        billingInterval: params.billingInterval,
        planPriceId: selectedPlanPrice.id,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          planCode: params.planCode,
          billingInterval: params.billingInterval,
          planPriceId: selectedPlanPrice.id,
        },
      },
    },
    {
      idempotencyKey,
    },
  );

  if (!session.url) {
    throw new Error("STRIPE_CHECKOUT_ERROR: Failed to generate checkout session URL.");
  }

  // 6. Record Checkout Attempt in DB
  await prisma.billingCheckoutAttempt.create({
    data: {
      userId: params.userId,
      requestId,
      selectedPlanCode: params.planCode,
      billingInterval: params.billingInterval,
      planPriceId: selectedPlanPrice.id,
      stripePriceId: selectedPlanPrice.stripePriceId,
      checkoutSessionId: session.id,
      idempotencyKey,
      status: "PENDING",
      expiresAt: new Date(
        session.expires_at ? session.expires_at * 1000 : Date.now() + 24 * 3600 * 1000,
      ),
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    requestId,
  };
}
