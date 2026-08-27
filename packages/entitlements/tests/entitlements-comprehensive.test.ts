import { describe, it, expect } from "vitest";
import { resolveUserEntitlements, checkEntitlement } from "../src/resolver.js";
import { CANONICAL_PLANS } from "../src/plans.js";

describe("Phase 4A Comprehensive Entitlement & Policy Suite", () => {
  const fixedNow = new Date("2026-08-25T12:00:00Z");

  // =========================================================================
  // 1. ADMIN Regression & Isolation
  // =========================================================================
  it("never grants paid commercial capabilities automatically to ADMIN without subscription or grant", () => {
    const adminUser: any = {
      id: "admin-user-1",
      role: "ADMIN",
      billingSubscriptions: [],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(adminUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);

    // Gated paid features remain blocked
    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.isGranted).toBe(false);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(false);

    const check = checkEntitlement(ctx, "VENTURE_BLUEPRINT_EXPORT");
    expect(check.allowed).toBe(false);
    expect(check.upgradeRequired).toBe(true);
  });

  it("permits temporary QA access to ADMIN via explicit EntitlementGrant with valid expiry", () => {
    const adminWithGrant: any = {
      id: "admin-qa-1",
      role: "ADMIN",
      billingSubscriptions: [],
      entitlementGrants: [
        {
          id: "grant-qa-1",
          entitlementType: "VENTURE_BLUEPRINT_EXPORT",
          source: "ADMIN_OVERRIDE",
          isUnlimited: true,
          limitQuantity: null,
          remainingUnits: null,
          startsAt: new Date("2026-08-01T00:00:00Z"),
          expiresAt: new Date("2026-08-30T00:00:00Z"),
        },
      ],
    };

    const ctx = resolveUserEntitlements(adminWithGrant, fixedNow);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(true);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.source).toBe("ADMIN_OVERRIDE");

    const check = checkEntitlement(ctx, "VENTURE_BLUEPRINT_EXPORT");
    expect(check.allowed).toBe(true);
  });

  // =========================================================================
  // 2. Subscription State Policy Matrix
  // =========================================================================
  const testSubWithStatus = (
    status: any,
    periodEndOffsetMs: number,
    extra: Record<string, any> = {},
  ) => {
    return {
      id: "sub-matrix-1",
      status,
      currentPeriodEnd: new Date(fixedNow.getTime() + periodEndOffsetMs),
      planPrice: {
        id: "price_pro_monthly",
        stripePriceId: "price_live_pro_monthly",
        isActive: true,
        plan: { code: "PRO", isActive: true },
        ...extra.planPrice,
      },
      ...extra,
    };
  };

  it("evaluates complete subscription state matrix accurately", () => {
    // 1. ACTIVE future period -> PRO
    const activeSub = testSubWithStatus("ACTIVE", 86400000);
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [activeSub] },
        fixedNow,
      ).tier,
    ).toBe("PRO");

    // 2. ACTIVE expired period -> FREE
    const expiredActive = testSubWithStatus("ACTIVE", -1000);
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [expiredActive] },
        fixedNow,
      ).tier,
    ).toBe("FREE");

    // 3. TRIALING valid trial -> PRO
    const validTrial = testSubWithStatus("TRIALING", 86400000, {
      trialStart: new Date(fixedNow.getTime() - 86400000),
      trialEnd: new Date(fixedNow.getTime() + 86400000),
    });
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [validTrial] },
        fixedNow,
      ).tier,
    ).toBe("PRO");

    // 4. TRIALING expired trial -> FREE
    const expiredTrial = testSubWithStatus("TRIALING", 86400000, {
      trialStart: new Date(fixedNow.getTime() - 172800000),
      trialEnd: new Date(fixedNow.getTime() - 86400000),
    });
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [expiredTrial] },
        fixedNow,
      ).tier,
    ).toBe("FREE");

    // 5. PAST_DUE -> FREE (Never infer grace access)
    const pastDue = testSubWithStatus("PAST_DUE", 86400000);
    expect(
      resolveUserEntitlements({ id: "u1", role: "USER", billingSubscriptions: [pastDue] }, fixedNow)
        .tier,
    ).toBe("FREE");

    // 6. UNPAID -> FREE
    const unpaid = testSubWithStatus("UNPAID", 86400000);
    expect(
      resolveUserEntitlements({ id: "u1", role: "USER", billingSubscriptions: [unpaid] }, fixedNow)
        .tier,
    ).toBe("FREE");

    // 7. PAUSED -> FREE
    const paused = testSubWithStatus("PAUSED", 86400000);
    expect(
      resolveUserEntitlements({ id: "u1", role: "USER", billingSubscriptions: [paused] }, fixedNow)
        .tier,
    ).toBe("FREE");

    // 8. INCOMPLETE -> FREE
    const incomplete = testSubWithStatus("INCOMPLETE", 86400000);
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [incomplete] },
        fixedNow,
      ).tier,
    ).toBe("FREE");

    // 9. INCOMPLETE_EXPIRED -> FREE
    const incExp = testSubWithStatus("INCOMPLETE_EXPIRED", 86400000);
    expect(
      resolveUserEntitlements({ id: "u1", role: "USER", billingSubscriptions: [incExp] }, fixedNow)
        .tier,
    ).toBe("FREE");

    // 10. CANCELED expired -> FREE
    const canceled = testSubWithStatus("CANCELED", -1000);
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [canceled] },
        fixedNow,
      ).tier,
    ).toBe("FREE");

    // 11. cancelAtPeriodEnd=true while ACTIVE in future -> PRO until period end
    const pendingCancel = testSubWithStatus("ACTIVE", 86400000, { cancelAtPeriodEnd: true });
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [pendingCancel] },
        fixedNow,
      ).tier,
    ).toBe("PRO");

    // 12. Multiple subscriptions where only one is active -> PRO
    const multipleSubs = [
      testSubWithStatus("CANCELED", -86400000),
      testSubWithStatus("ACTIVE", 86400000),
      testSubWithStatus("PAST_DUE", 86400000),
    ];
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: multipleSubs },
        fixedNow,
      ).tier,
    ).toBe("PRO");

    // 13. Subscription referencing inactive plan -> FREE
    const inactivePlanSub = testSubWithStatus("ACTIVE", 86400000, {
      planPrice: { plan: { code: "TEAM", isActive: false } },
    });
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [inactivePlanSub] },
        fixedNow,
      ).tier,
    ).toBe("FREE");

    // 14. TEST price ID in LIVE environment -> FREE
    const testPriceSub = testSubWithStatus("ACTIVE", 86400000, {
      planPrice: {
        id: "price_test_pro_monthly",
        stripePriceId: "price_test_pro_monthly",
        plan: { code: "PRO", isActive: true },
      },
    });
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [testPriceSub] },
        fixedNow,
        { isLiveEnvironment: true },
      ).tier,
    ).toBe("FREE");
    // But works in non-live environment:
    expect(
      resolveUserEntitlements(
        { id: "u1", role: "USER", billingSubscriptions: [testPriceSub] },
        fixedNow,
        { isLiveEnvironment: false },
      ).tier,
    ).toBe("PRO");
  });

  // =========================================================================
  // 3. Grant Policy & Deterministic Merging
  // =========================================================================
  it("enforces grant policy and deterministic merging", () => {
    // 1. Grant with missing expiry fails closed
    const missingExpiryGrant: any = {
      id: "g1",
      entitlementType: "VENTURE_BLUEPRINT_EXPORT",
      source: "PROMOTIONAL",
      isUnlimited: true,
      expiresAt: null, // Required for promo
    };
    const ctx1 = resolveUserEntitlements(
      { id: "u1", role: "USER", entitlementGrants: [missingExpiryGrant] },
      fixedNow,
    );
    expect(ctx1.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(false);

    // 2. Numeric limit merge takes higher remaining limit
    const numGrants: any = [
      {
        id: "g2",
        entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
        source: "PROMOTIONAL",
        isUnlimited: false,
        limitQuantity: 10,
        remainingUnits: 8,
        expiresAt: new Date(fixedNow.getTime() + 86400000),
      },
      {
        id: "g3",
        entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
        source: "ADMIN_OVERRIDE",
        isUnlimited: false,
        limitQuantity: 20,
        remainingUnits: 15,
        expiresAt: new Date(fixedNow.getTime() + 86400000),
      },
    ];
    const ctx2 = resolveUserEntitlements(
      { id: "u1", role: "USER", entitlementGrants: numGrants },
      fixedNow,
    );
    expect(ctx2.entitlements.OPPORTUNITY_RADAR_WATCHLIST.remainingUnits).toBe(15);
  });

  // =========================================================================
  // 4. Security & Fail-Closed Checks
  // =========================================================================
  it("fails closed on invalid requested units", () => {
    const ctx = resolveUserEntitlements(null, fixedNow);
    expect(checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", -1).allowed).toBe(false);
    expect(checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", 0).allowed).toBe(false);
    expect(checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", 1.5).allowed).toBe(false);
  });
});
