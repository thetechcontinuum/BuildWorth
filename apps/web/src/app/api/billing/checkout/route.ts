import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  prisma,
  resolveServerSession,
  checkAndIncrementRateLimit,
  hashRateLimitKey,
} from "@buildworth/database";
import { getStripeClient, createBillingCheckoutSession } from "@buildworth/billing";

export async function POST(request: NextRequest) {
  try {
    // 1. Session Authentication
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to upgrade." },
        { status: 401 },
      );
    }

    // 2. CSRF / Origin Verification
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: "FORBIDDEN: Cross-site request rejected." },
          { status: 403 },
        );
      }
    }

    // 3. Rate Limiting (5 checkout attempts per 5 minutes per user)
    const rateKey = hashRateLimitKey("checkout", sessionUser.id);
    const rateCheck = await checkAndIncrementRateLimit(prisma, rateKey, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS: Please wait before creating another checkout session." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) } },
      );
    }

    // 4. Request Body Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    // Disallow client-supplied price IDs, amounts, currencies, or Stripe customer IDs
    if ("priceId" in body || "stripePriceId" in body || "amount" in body || "currency" in body || "customerId" in body || "stripeCustomerId" in body) {
      return NextResponse.json(
        { error: "INVALID_PARAMETERS: Client cannot supply arbitrary price IDs, amounts, currencies, or customer IDs." },
        { status: 400 },
      );
    }

    let catalogKey = body.catalogKey;
    if (!catalogKey) {
      // Fallback for plan/interval legacy shape
      const plan = (body.plan || "").toUpperCase();
      const interval = (body.interval || "").toUpperCase();
      if (plan === "PRO") {
        if (interval === "ANNUAL" || interval === "YEAR") {
          catalogKey = "pro_annual";
        } else {
          catalogKey = "pro_monthly";
        }
      }
    }

    if (!catalogKey) {
      return NextResponse.json(
        { error: "INVALID_CATALOG_KEY: catalogKey is required." },
        { status: 400 },
      );
    }

    // 5. Create Stripe Checkout Session
    const stripe = getStripeClient();
    const result = await createBillingCheckoutSession(prisma, stripe, {
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      userName: sessionUser.name,
      catalogKey,
      returnTo: body.returnTo,
      requestId: body.requestId,
    });

    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      requestId: result.requestId,
      catalogKey: result.catalogKey,
    });
  } catch (err: any) {
    console.error("Billing Checkout Error:", err);
    if (err?.message?.includes("INVALID_CATALOG_KEY") || err?.message?.includes("IDEMPOTENCY_CONFLICT")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err?.message?.includes("PRICING_UNAVAILABLE")) {
      return NextResponse.json({ error: "PRICING_UNAVAILABLE: Pricing is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json(
      { error: err?.message || "Internal server error during checkout." },
      { status: 500 },
    );
  }
}
