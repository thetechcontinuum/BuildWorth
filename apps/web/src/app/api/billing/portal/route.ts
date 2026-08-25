import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession, checkAndIncrementRateLimit, hashRateLimitKey } from "@buildworth/database";
import { getStripeClient, createBillingPortalSession } from "@buildworth/billing";

export async function POST(request: NextRequest) {
  try {
    // 1. Session Authentication
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to manage billing." },
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

    // 3. Rate Limiting
    const rateKey = hashRateLimitKey("portal", sessionUser.id);
    const rateCheck = await checkAndIncrementRateLimit(prisma, rateKey, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS: Please wait before opening the portal again." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) } }
      );
    }

    // 4. Create Billing Portal Session
    const stripe = getStripeClient();
    const result = await createBillingPortalSession(prisma, stripe, {
      userId: sessionUser.id,
    });

    return NextResponse.json({
      portalUrl: result.portalUrl,
    });
  } catch (err: any) {
    console.error("Billing Portal Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create customer portal session." },
      { status: 500 }
    );
  }
}
