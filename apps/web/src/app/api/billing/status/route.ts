import { NextResponse } from "next/server";

import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      // Anonymous summary
      const anonCtx = resolveUserEntitlements(null);
      return NextResponse.json(
        {
          tier: anonCtx.tier,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          isCheckoutAvailable: true,
          isPortalAvailable: false,
          hasActiveSubscription: false,
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

    const ctx = resolveUserEntitlements(dbUser);
    const activeSub = dbUser?.billingSubscriptions?.find(
      (s) => s.status === "ACTIVE" || s.status === "TRIALING",
    );

    return NextResponse.json(
      {
        tier: ctx.tier,
        subscriptionStatus: ctx.subscriptionStatus,
        currentPeriodEnd: activeSub ? activeSub.currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd: activeSub ? activeSub.cancelAtPeriodEnd : false,
        isCheckoutAvailable: !ctx.hasActiveSubscription,
        isPortalAvailable: !!dbUser?.billingCustomer?.stripeCustomerId,
        hasActiveSubscription: ctx.hasActiveSubscription,
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
