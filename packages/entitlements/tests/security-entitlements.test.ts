import { describe, it, expect } from "vitest";
import { resolveUserEntitlements, checkEntitlement } from "../src/resolver.js";

describe("Phase 4A Security, Tamper-Resistance & Fail-Closed Tests", () => {
  const fixedNow = new Date("2026-08-25T12:00:00Z");

  it("proves client-supplied tier is ignored and cannot escalate privileges", () => {
    // User object tampering: client injects tier: 'ENTERPRISE'
    const tamperedUser: any = {
      id: "usr_attacker_1",
      role: "USER",
      tier: "ENTERPRISE", // Spoofed client property
      billingSubscriptions: [],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(tamperedUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);

    // Paid capabilities remain inaccessible
    const checkBlueprintExport = checkEntitlement(ctx, "VENTURE_BLUEPRINT_EXPORT");
    expect(checkBlueprintExport.allowed).toBe(false);
    expect(checkBlueprintExport.upgradeRequired).toBe(true);

    const checkFit = checkEntitlement(ctx, "FOUNDER_FIT_FULL_BREAKDOWN");
    expect(checkFit.allowed).toBe(false);
  });

  it("proves TEST provider subscription cannot activate LIVE entitlements in production context", () => {
    const testSubUser: any = {
      id: "usr_attacker_2",
      role: "USER",
      tier: "FREE",
      billingSubscriptions: [
        {
          id: "sub_test_provider_123",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-25T12:00:00Z"),
          planPrice: {
            id: "price_test_pro_monthly",
            stripePriceId: "price_test_pro_monthly",
            isActive: true,
            plan: { code: "PRO", isActive: true },
          },
        },
      ],
      entitlementGrants: [],
    };

    // Live Environment resolution
    const liveCtx = resolveUserEntitlements(testSubUser, fixedNow, { isLiveEnvironment: true });
    expect(liveCtx.tier).toBe("FREE");
    expect(liveCtx.hasActiveSubscription).toBe(false);
    expect(checkEntitlement(liveCtx, "VENTURE_BLUEPRINT_EXPORT").allowed).toBe(false);

    // Test/Dev Environment resolution
    const devCtx = resolveUserEntitlements(testSubUser, fixedNow, { isLiveEnvironment: false });
    expect(devCtx.tier).toBe("PRO");
    expect(devCtx.hasActiveSubscription).toBe(true);
    expect(checkEntitlement(devCtx, "VENTURE_BLUEPRINT_EXPORT").allowed).toBe(true);
  });

  it("proves inactive plans fail closed and cannot grant access", () => {
    const inactivePlanUser: any = {
      id: "usr_attacker_3",
      role: "USER",
      tier: "FREE",
      billingSubscriptions: [
        {
          id: "sub_inactive_plan",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-25T12:00:00Z"),
          planPrice: {
            id: "price_enterprise_monthly",
            stripePriceId: "price_live_enterprise_monthly",
            isActive: true,
            plan: { code: "ENTERPRISE", isActive: false }, // Inactive plan
          },
        },
      ],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(inactivePlanUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);
    expect(checkEntitlement(ctx, "CUSTOM_SOURCE_INDEXING").allowed).toBe(false);
  });

  it("proves malformed entitlement values and units fail closed", () => {
    const ctx = resolveUserEntitlements(null, fixedNow);

    // Negative units
    expect(checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", -10).allowed).toBe(false);
    // Non-integer units
    expect(checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", 2.7).allowed).toBe(false);
    // Non-existent key
    expect(checkEntitlement(ctx, "UNKNOWN_KEY_DOES_NOT_EXIST" as any).allowed).toBe(false);
  });

  it("guarantees public baseline capabilities remain accessible without payment", () => {
    const ctx = resolveUserEntitlements(null, fixedNow);

    // Free watchlist allowance (3 items)
    const checkWatchlist = checkEntitlement(ctx, "OPPORTUNITY_RADAR_WATCHLIST", 1);
    expect(checkWatchlist.allowed).toBe(true);
    expect(checkWatchlist.entitlement?.limitQuantity).toBe(3);

    // Free comparison allowance (2 items)
    const checkComparison = checkEntitlement(ctx, "OPPORTUNITY_COMPARISON", 2);
    expect(checkComparison.allowed).toBe(true);
    expect(checkComparison.entitlement?.limitQuantity).toBe(2);
  });
});
