import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { getPublicPriceCatalogDTO } from "@buildworth/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = getPublicPriceCatalogDTO();
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      // Anonymous summary
      const anonCtx = resolveUserEntitlements(null);
      return NextResponse.json(
        {
          conversionState: "FREE",
          tier: anonCtx.tier,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          isCheckoutAvailable: true,
          isPortalAvailable: false,
          hasActiveSubscription: false,
          catalog,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
            Vary: "Cookie",
          },
        },
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        billingCustomer: true,
        billingSubscriptions: {
          include: {
            planPrice: {
              include: {
                plan: true,
              },
            },
          },
        },
        entitlementGrants: true,
      },
    });

    const isLive = process.env.NODE_ENV === "production" && !process.env.TEST_ENV;
    const ctx = resolveUserEntitlements(dbUser, new Date(), { isLiveEnvironment: isLive });
    const activeSub = dbUser?.billingSubscriptions?.find(
      (s) => s.status === "ACTIVE" || s.status === "TRIALING",
    );
    const pastDueSub = dbUser?.billingSubscriptions?.find(
      (s) => s.status === "PAST_DUE",
    );
    const unpaidSub = dbUser?.billingSubscriptions?.find(
      (s) => s.status === "UNPAID",
    );

    // Check for recent, unexpired, non-cancelled checkout attempt belonging to user
    // Both PENDING (checkout started) and COMPLETED (checkout returned/session completed)
    // resolve to ACTIVATION_PENDING until a valid subscription webhook arrives.
    const now = new Date();
    const recentPendingAttempt = await prisma.billingCheckoutAttempt.findFirst({
      where: {
        userId: sessionUser.id,
        status: { in: ["PENDING", "COMPLETED"] },
        expiresAt: { gt: now },
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30 min timeout window
      },
      orderBy: { createdAt: "desc" },
    });

    let conversionState:
      | "FREE"
      | "ACTIVATION_PENDING"
      | "PRO_ACTIVE"
      | "PRO_ACTIVE_UNTIL_PERIOD_END"
      | "PAYMENT_GRACE"
      | "PAYMENT_ACTION_REQUIRED" = "FREE";

    if (ctx.hasActiveSubscription && ctx.tier === "PRO") {
      if (activeSub?.cancelAtPeriodEnd) {
        conversionState = "PRO_ACTIVE_UNTIL_PERIOD_END";
      } else {
        conversionState = "PRO_ACTIVE";
      }
    } else if (pastDueSub) {
      conversionState = "PAYMENT_GRACE";
    } else if (unpaidSub) {
      conversionState = "PAYMENT_ACTION_REQUIRED";
    } else if (recentPendingAttempt) {
      conversionState = "ACTIVATION_PENDING";
    }

    return NextResponse.json(
      {
        conversionState,
        tier: ctx.tier,
        subscriptionStatus: ctx.subscriptionStatus,
        currentPeriodEnd: activeSub ? activeSub.currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd: activeSub ? activeSub.cancelAtPeriodEnd : false,
        isCheckoutAvailable: !ctx.hasActiveSubscription,
        isPortalAvailable: !!dbUser?.billingCustomer?.stripeCustomerId,
        hasActiveSubscription: ctx.hasActiveSubscription,
        catalog,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      },
    );
  } catch (err: any) {
    console.error("Billing Status Error:", err);
    return NextResponse.json({ error: "Failed to retrieve billing status." }, { status: 500 });
  }
}
