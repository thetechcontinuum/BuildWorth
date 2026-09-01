import Stripe from "stripe";
import { PrismaClient } from "@buildworth/database";
import crypto from "crypto";
import { ensureBillingCustomer } from "./customer-service.js";
import { getBillingConfig } from "./config.js";
import { resolveServerPriceEntry, BillingIntervalType } from "./pricing-catalog.js";

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  userName?: string | null;
  catalogKey: string;
  returnTo?: string | null;
  requestId?: string;
  appUrlOverride?: string;
}

export interface CreateCheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  requestId: string;
  catalogKey: string;
}

/**
 * Sanitizes returnTo to prevent open redirects.
 * Only relative application paths starting with '/' are permitted.
 */
export function sanitizeReturnTo(returnTo?: string | null): string {
  if (!returnTo || typeof returnTo !== "string") {
    return "/pricing";
  }
  const trimmed = returnTo.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("://")
  ) {
    return "/pricing";
  }
  return trimmed;
}

/**
 * Validates client-supplied requestId length and character set.
 */
export function validateRequestId(requestId?: string): string {
  if (!requestId) {
    return `req_chk_${crypto.randomBytes(32).toString("hex")}`;
  }
  if (typeof requestId !== "string") {
    throw new Error("INVALID_REQUEST_ID: requestId must be a string.");
  }
  if (requestId.length < 1 || requestId.length > 128) {
    throw new Error("INVALID_REQUEST_ID: requestId length must be between 1 and 128 characters.");
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(requestId)) {
    throw new Error("INVALID_REQUEST_ID: requestId contains invalid characters. Only alphanumeric, '_', '.', ':', and '-' are permitted.");
  }
  return requestId;
}

export async function createBillingCheckoutSession(
  prisma: PrismaClient,
  stripe: Stripe,
  params: CreateCheckoutSessionParams,
): Promise<CreateCheckoutSessionResult> {
  const config = getBillingConfig();
  const appUrl = (params.appUrlOverride || config.appUrl).replace(/\/+$/, "");

  // 1. Authoritative Server-only Catalog Resolution
  const { entry: catalogEntry, stripePriceId } = resolveServerPriceEntry(params.catalogKey);
  const planCode = catalogEntry.tier;
  const billingInterval: BillingIntervalType = catalogEntry.billingInterval;

  // 2. Sanitize returnTo
  const safeReturnTo = sanitizeReturnTo(params.returnTo);

  // 3. Validate or generate Request ID
  const requestId = validateRequestId(params.requestId);

  // 4. Check if requestId already exists for idempotency (scoped by user, catalogKey & safeReturnTo)
  if (params.requestId) {
    const existingAttempt = await prisma.billingCheckoutAttempt.findUnique({
      where: { requestId },
    });

    if (existingAttempt) {
      // Check for conflicting user, plan, or interval
      if (
        existingAttempt.userId !== params.userId ||
        existingAttempt.selectedPlanCode !== planCode ||
        existingAttempt.billingInterval !== billingInterval
      ) {
        throw new Error("IDEMPOTENCY_CONFLICT: Reused request ID with conflicting parameters.");
      }

      // Check returnTo binding via idempotencyKey
      const expectedIdemPrefix = `chk_idem_${params.userId}_${requestId}_${crypto.createHash("sha256").update(safeReturnTo).digest("hex").substring(0, 16)}`;
      if (existingAttempt.idempotencyKey !== expectedIdemPrefix) {
        throw new Error("IDEMPOTENCY_CONFLICT: Reused request ID with conflicting returnTo path.");
      }

      if (existingAttempt.checkoutSessionId) {
        return {
          checkoutUrl: `https://checkout.stripe.com/c/pay/${existingAttempt.checkoutSessionId}`,
          sessionId: existingAttempt.checkoutSessionId,
          requestId: existingAttempt.requestId,
          catalogKey: params.catalogKey,
        };
      }
    }
  }

  // 5. Verify Stripe Price with provider abstraction before creating checkout
  try {
    const providerPrice = await stripe.prices.retrieve(stripePriceId);
    const { verifyPriceAgainstProvider } = await import("./pricing-catalog.js");
    verifyPriceAgainstProvider(catalogEntry, providerPrice);
  } catch (err: any) {
    if (err?.message?.startsWith("PRICING_CONFIGURATION_MISMATCH")) {
      throw err;
    }
    // If provider retrieval fails, do not create checkout with unverified price
    throw new Error(`PRICING_CONFIGURATION_MISMATCH: Failed to verify Stripe price with provider: ${err?.message || "Unknown error"}`);
  }

  // 6. Resolve active allowlisted PlanPrice from database
  const plan = await prisma.productPlan.findUnique({
    where: { code: planCode },
    include: {
      prices: {
        where: {
          billingInterval,
          isActive: true,
        },
      },
    },
  });

  const selectedPlanPrice = plan?.prices?.[0];
  if (!plan || !plan.isActive || !selectedPlanPrice) {
    throw new Error(
      `PRICE_NOT_FOUND: No active allowlisted price found in database for ${planCode} (${billingInterval}).`,
    );
  }

  // 7. Ensure Billing Customer (belongs strictly to authenticated user)
  const { customerId } = await ensureBillingCustomer(
    prisma,
    stripe,
    params.userId,
    params.userEmail,
    params.userName,
  );

  // 8. Create deterministic Idempotency Key bound to user, requestId, and safeReturnTo
  const returnToHash = crypto.createHash("sha256").update(safeReturnTo).digest("hex").substring(0, 16);
  const idempotencyKey = `chk_idem_${params.userId}_${requestId}_${returnToHash}`;

  // 7. Construct Server-side URLs
  const returnParam = encodeURIComponent(safeReturnTo);
  const successUrl = `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}&returnTo=${returnParam}`;
  const cancelUrl = `${appUrl}/pricing?checkout=cancelled&returnTo=${returnParam}`;

  // 8. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create(
    {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: params.userId,
      metadata: {
        userId: params.userId,
        catalogKey: params.catalogKey,
        requestId,
        planCode,
        billingInterval,
        planPriceId: selectedPlanPrice.id,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          catalogKey: params.catalogKey,
          planCode,
          billingInterval,
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

  // 9. Record Checkout Attempt in DB
  const attempt = await prisma.billingCheckoutAttempt.create({
    data: {
      userId: params.userId,
      requestId,
      selectedPlanCode: planCode,
      billingInterval,
      planPriceId: selectedPlanPrice.id,
      stripePriceId,
      checkoutSessionId: session.id,
      idempotencyKey,
      status: "PENDING",
      expiresAt: new Date(
        session.expires_at ? session.expires_at * 1000 : Date.now() + 24 * 3600 * 1000,
      ),
    },
  });

  // 10. Emit Server-Authoritative CHECKOUT_CREATED Commercial Event
  try {
    const { recordCommercialEvent } = await import("./commercial-events.js");
    await recordCommercialEvent(prisma, {
      eventType: "CHECKOUT_CREATED",
      deduplicationKey: `chk_created_${attempt.id}`,
      userId: params.userId,
      checkoutAttemptId: attempt.id,
      source: "CHECKOUT_SERVICE",
      metadata: {
        planCode,
        billingInterval,
        currency: catalogEntry.currency,
        amountCents: catalogEntry.amountCents,
        catalogKey: params.catalogKey,
      },
    });
  } catch (err: any) {
    // Non-blocking best effort
    console.error("Commercial Event Emission Error:", err?.message || err);
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    requestId,
    catalogKey: params.catalogKey,
  };
}
