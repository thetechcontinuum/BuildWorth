import { describe, it, expect } from "vitest";
import { resolveUserEntitlements, checkEntitlement } from "../src/resolver.js";
import { CANONICAL_PLANS } from "../src/plans.js";

describe("Phase 4A Deterministic Entitlement Resolver & Hierarchy Tests", () => {
  const fixedNow = new Date("2026-08-25T12:00:00Z");

  it("resolves anonymous visitor to FREE default without access to gated features", () => {
    const ctx = resolveUserEntitlements(null, fixedNow);

    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);
    expect(ctx.subscriptionStatus).toBe(null);

    // Evidence lineage capped
    expect(ctx.entitlements.EVIDENCE_LINEAGE_UNRESTRICTED.isGranted).toBe(false);
    expect(ctx.entitlements.EVIDENCE_LINEAGE_UNRESTRICTED.limitQuantity).toBe(3);

    // Gated paid features
    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.isGranted).toBe(false);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_FINANCIALS.isGranted).toBe(false);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(false);

    // Check rejection
    const checkFit = checkEntitlement(ctx, "FOUNDER_FIT_FULL_BREAKDOWN");
    expect(checkFit.allowed).toBe(false);
    expect(checkFit.upgradeRequired).toBe(true);
  });

  it("never grants paid access from legacy User.tier string without active subscription", () => {
    const legacyProUser: any = {
      id: "legacy-user-1",
      role: "USER",
      tier: "PRO", // Legacy tier field in database
      billingSubscriptions: [],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(legacyProUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);

    const checkExp = checkEntitlement(ctx, "VENTURE_BLUEPRINT_EXPORT");
    expect(checkExp.allowed).toBe(false);
    expect(checkExp.upgradeRequired).toBe(true);
  });

  it("grants full Pro entitlements for valid active subscription within period", () => {
    const proUser: any = {
      id: "pro-user-1",
      role: "USER",
      tier: "FREE",
      billingSubscriptions: [
        {
          id: "sub-123",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-25T12:00:00Z"),
          planPrice: {
            plan: { code: "PRO" },
          },
        },
      ],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(proUser, fixedNow);
    expect(ctx.tier).toBe("PRO");
    expect(ctx.hasActiveSubscription).toBe(true);
    expect(ctx.subscriptionStatus).toBe("ACTIVE");

    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.isGranted).toBe(true);
    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.isUnlimited).toBe(true);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(true);
    expect(ctx.entitlements.OPPORTUNITY_RADAR_WATCHLIST.limitQuantity).toBe(50);

    const checkFit = checkEntitlement(ctx, "FOUNDER_FIT_FULL_BREAKDOWN");
    expect(checkFit.allowed).toBe(true);
  });

  it("reverts to FREE immediately if subscription has expired past currentPeriodEnd", () => {
    const expiredUser: any = {
      id: "expired-user-1",
      role: "USER",
      tier: "PRO",
      billingSubscriptions: [
        {
          id: "sub-expired",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-08-01T00:00:00Z"), // Expired before fixedNow
          planPrice: {
            plan: { code: "PRO" },
          },
        },
      ],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(expiredUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);

    const checkExp = checkEntitlement(ctx, "VENTURE_BLUEPRINT_FINANCIALS");
    expect(checkExp.allowed).toBe(false);
  });

  it("honors specific admin override / promotional grants without subscription", () => {
    const promoUser: any = {
      id: "promo-user-1",
      role: "USER",
      tier: "FREE",
      billingSubscriptions: [],
      entitlementGrants: [
        {
          id: "grant-1",
          entitlementType: "FOUNDER_FIT_FULL_BREAKDOWN",
          source: "PROMOTIONAL",
          isUnlimited: true,
          limitQuantity: null,
          remainingUnits: null,
          expiresAt: new Date("2026-09-01T00:00:00Z"),
        },
      ],
    };

    const ctx = resolveUserEntitlements(promoUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.isGranted).toBe(true);
    expect(ctx.entitlements.FOUNDER_FIT_FULL_BREAKDOWN.source).toBe("PROMOTIONAL");

    // Other paid features remain locked
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(false);
  });

  it("resolves ADMIN role to FREE commercial tier without subscription or grant", () => {
    const adminUser: any = {
      id: "admin-1",
      role: "ADMIN",
      tier: "FREE",
      billingSubscriptions: [],
      entitlementGrants: [],
    };

    const ctx = resolveUserEntitlements(adminUser, fixedNow);
    expect(ctx.tier).toBe("FREE");
    expect(ctx.hasActiveSubscription).toBe(false);
    expect(ctx.entitlements.VENTURE_BLUEPRINT_EXPORT.isGranted).toBe(false);
  });
});
