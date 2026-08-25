import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession, checkAndIncrementRateLimit, hashRateLimitKey } from "@buildworth/database";
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
        { status: 401 }
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
          { status: 403 }
        );
      }
    }

    // 3. Rate Limiting (5 checkout attempts per 5 minutes per user)
    const rateKey = hashRateLimitKey("checkout", sessionUser.id);
    const rateCheck = await checkAndIncrementRateLimit(prisma, rateKey, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS: Please wait before creating another checkout session." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) } }
      );
    }

    // 4. Request Body Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const { plan, interval } = body;
    if (plan !== "PRO") {
      return NextResponse.json(
        { error: "INVALID_PLAN: Only 'PRO' plan checkout is supported." },
        { status: 400 }
      );
    }

    const normalizedInterval = (interval || "").toUpperCase() === "YEAR" || (interval || "").toUpperCase() === "ANNUAL"
      ? "ANNUAL"
      : "MONTHLY";

    // 5. Create Stripe Checkout Session
    const stripe = getStripeClient();
    const result = await createBillingCheckoutSession(prisma, stripe, {
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      userName: sessionUser.name,
      planCode: "PRO",
      billingInterval: normalizedInterval,
    });

    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      requestId: result.requestId,
    });
  } catch (err: any) {
    console.error("Billing Checkout Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error during checkout." },
      { status: 500 }
    );
  }
}
