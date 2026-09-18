import {
  EntitlementKey,
  ResolvedEntitlement,
  UserEntitlementContext,
  EntitlementCheckResult,
  SubscriptionTierType,
  BillingSubscriptionStatusType,
} from "@buildworth/shared";
import { CANONICAL_PLANS } from "./plans.js";

export interface DatabaseUserData {
  id: string;
  role: "USER" | "ADMIN" | "REVIEWER";
  tier?: SubscriptionTierType;
  billingSubscriptions?: Array<{
    id: string;
    status: BillingSubscriptionStatusType;
    currentPeriodStart?: Date;
    currentPeriodEnd: Date;
    trialStart?: Date | null;
    trialEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    planPrice: {
      id?: string;
      stripePriceId?: string | null;
      isActive?: boolean;
      plan: {
        code: string;
        isActive?: boolean;
      };
    };
  }>;
  entitlementGrants?: Array<{
    id: string;
    entitlementType: string;
    source: "SUBSCRIPTION" | "PROMOTIONAL" | "ADMIN_OVERRIDE" | "TRIAL";
    isUnlimited: boolean;
    limitQuantity: number | null;
    remainingUnits: number | null;
    startsAt?: Date | null;
    expiresAt: Date | null;
  }>;
}

export function resolveUserEntitlements(
  user: DatabaseUserData | null | undefined,
  currentDate: Date = new Date(),
  envContext: { isLiveEnvironment?: boolean } = { isLiveEnvironment: true },
): UserEntitlementContext {
  const allKeys: EntitlementKey[] = [
    "EVIDENCE_LINEAGE_UNRESTRICTED",
    "FOUNDER_FIT_FULL_BREAKDOWN",
    "VENTURE_BLUEPRINT_FINANCIALS",
    "VENTURE_BLUEPRINT_EXPORT",
    "OPPORTUNITY_RADAR_WATCHLIST",
    "OPPORTUNITY_RADAR_ALERTS",
    "OPPORTUNITY_COMPARISON",
    "EARLY_OPPORTUNITY_ACCESS",
    "CUSTOM_SOURCE_INDEXING",
  ];

  if (!user) {
    const freePlan = CANONICAL_PLANS.FREE;
    const entitlements = {} as Record<EntitlementKey, ResolvedEntitlement>;
    for (const key of allKeys) {
      const pEnt = freePlan.entitlements[key];
      entitlements[key] = {
        entitlementType: key,
        isGranted: pEnt?.isGranted ?? false,
        isUnlimited: pEnt?.isUnlimited ?? false,
        limitQuantity: pEnt?.limitQuantity ?? null,
        remainingUnits: pEnt?.limitQuantity ?? null,
        resetInterval: pEnt?.resetInterval ?? null,
        source: "FREE_DEFAULT",
        expiresAt: null,
      };
    }
    return {
      userId: "anonymous",
      tier: "FREE",
      hasActiveSubscription: false,
      subscriptionStatus: null,
      entitlements,
    };
  }

  // Find authoritative active billing subscription:
  // Must satisfy:
  // 1. Status is ACTIVE or TRIALING
  // 2. If ACTIVE: currentDate <= currentPeriodEnd
  // 3. If TRIALING: trialEnd exists and currentDate <= trialEnd AND currentDate <= currentPeriodEnd
  // 4. Plan is active in canonical catalog
  // 5. If isLiveEnvironment is true, test-only Price IDs (e.g. starting with "price_test_") are blocked
  const activeSub = (user.billingSubscriptions || []).find((sub) => {
    // Check status
    if (sub.status !== "ACTIVE" && sub.status !== "TRIALING") {
      return false;
    }

    // Check period boundary
    const periodEnd = new Date(sub.currentPeriodEnd);
    if (isNaN(periodEnd.getTime()) || currentDate > periodEnd) {
      return false;
    }

    // If TRIALING, trialEnd must also be valid
    if (sub.status === "TRIALING") {
      if (!sub.trialEnd) return false;
      const trialEnd = new Date(sub.trialEnd);
      if (isNaN(trialEnd.getTime()) || currentDate > trialEnd) {
        return false;
      }
    }

    // Check plan active state
    const planCode = sub.planPrice?.plan?.code?.toUpperCase() as SubscriptionTierType;
    const catalogPlan = CANONICAL_PLANS[planCode];
    if (!catalogPlan || !catalogPlan.isActive) {
      return false;
    }

    // Price active state if specified
    if (sub.planPrice?.isActive === false) {
      return false;
    }

    // Block TEST price IDs in live environment
    if (envContext.isLiveEnvironment) {
      const stripePriceId = sub.planPrice?.stripePriceId;
      const priceId = sub.planPrice?.id;
      if (
        (stripePriceId && /^price_(test|sample|fixture)_/.test(stripePriceId)) ||
        (priceId && /^price_(test|sample|fixture)_/.test(priceId))
      ) {
        return false;
      }
    }

    return true;
  });

  let effectiveTier: SubscriptionTierType = "FREE";
  if (activeSub) {
    const planCode = activeSub.planPrice.plan.code.toUpperCase() as SubscriptionTierType;
    if (CANONICAL_PLANS[planCode]?.isActive) {
      effectiveTier = planCode;
    }
  }

  const basePlan = CANONICAL_PLANS[effectiveTier] || CANONICAL_PLANS.FREE;
  const entitlements = {} as Record<EntitlementKey, ResolvedEntitlement>;

  for (const key of allKeys) {
    const pEnt = basePlan.entitlements[key];
    entitlements[key] = {
      entitlementType: key,
      isGranted: pEnt?.isGranted ?? false,
      isUnlimited: pEnt?.isUnlimited ?? false,
      limitQuantity: pEnt?.limitQuantity ?? null,
      remainingUnits: pEnt?.limitQuantity ?? null,
      resetInterval: pEnt?.resetInterval ?? null,
      source: activeSub ? "SUBSCRIPTION" : "FREE_DEFAULT",
      expiresAt: activeSub ? activeSub.currentPeriodEnd.toISOString() : null,
    };
  }

  // Apply explicit Entitlement Grants (ADMIN_OVERRIDE, PROMOTIONAL, TRIAL, etc.)
  // Must satisfy:
  // 1. startsAt (if provided) <= currentDate
  // 2. expiresAt is required for temporary/promotional/admin grants; if present, currentDate <= expiresAt
  // 3. Merges deterministically:
  //    - boolean capability: if either is true -> true
  //    - numeric limit: max(grant.remainingUnits, current.remainingUnits)
  for (const grant of user.entitlementGrants || []) {
    const key = grant.entitlementType as EntitlementKey;
    if (!allKeys.includes(key)) continue;

    // Check startsAt
    if (grant.startsAt) {
      const start = new Date(grant.startsAt);
      if (!isNaN(start.getTime()) && currentDate < start) {
        continue;
      }
    }

    // Check expiresAt
    if (grant.expiresAt) {
      const expiry = new Date(grant.expiresAt);
      if (isNaN(expiry.getTime()) || currentDate > expiry) {
        continue;
      }
    } else if (grant.source !== "SUBSCRIPTION") {
      // Require explicit expiry for non-subscription grants to prevent indefinite unearned access
      continue;
    }

    // If grant source is SUBSCRIPTION, it is only active if the user currently has an active subscription
    if (grant.source === "SUBSCRIPTION" && !activeSub) {
      continue;
    }

    const current = entitlements[key];
    if (grant.isUnlimited) {
      entitlements[key] = {
        entitlementType: key,
        isGranted: true,
        isUnlimited: true,
        limitQuantity: null,
        remainingUnits: null,
        resetInterval: null,
        source: grant.source,
        expiresAt: grant.expiresAt ? new Date(grant.expiresAt).toISOString() : null,
      };
    } else if (grant.remainingUnits !== null && grant.remainingUnits !== undefined) {
      const curRemaining = current?.remainingUnits ?? 0;
      if (grant.remainingUnits > curRemaining || !current?.isGranted) {
        entitlements[key] = {
          entitlementType: key,
          isGranted: true,
          isUnlimited: false,
          limitQuantity: grant.limitQuantity ?? grant.remainingUnits,
          remainingUnits: grant.remainingUnits,
          resetInterval: current?.resetInterval ?? null,
          source: grant.source,
          expiresAt: grant.expiresAt ? new Date(grant.expiresAt).toISOString() : null,
        };
      }
    }
  }

  return {
    userId: user.id,
    tier: effectiveTier,
    hasActiveSubscription: !!activeSub,
    subscriptionStatus: activeSub ? activeSub.status : null,
    entitlements,
  };
}

export function checkEntitlement(
  context: UserEntitlementContext,
  key: EntitlementKey,
  requiredUnits: number = 1,
): EntitlementCheckResult {
  if (requiredUnits <= 0 || !Number.isInteger(requiredUnits)) {
    return { allowed: false, reason: "INVALID_REQUIRED_UNITS", upgradeRequired: false };
  }

  const entitlement = context.entitlements[key];
  if (!entitlement) {
    return { allowed: false, reason: "ENTITLEMENT_NOT_FOUND", upgradeRequired: true };
  }

  if (!entitlement.isGranted) {
    return {
      allowed: false,
      reason: `Feature requires an active paid plan. Current tier: ${context.tier}`,
      entitlement,
      upgradeRequired: true,
    };
  }

  if (entitlement.isUnlimited) {
    return { allowed: true, entitlement };
  }

  if (entitlement.remainingUnits !== null && entitlement.remainingUnits < requiredUnits) {
    return {
      allowed: false,
      reason: `Usage limit reached (${entitlement.remainingUnits}/${entitlement.limitQuantity} remaining)`,
      entitlement,
      upgradeRequired: true,
    };
  }

  return { allowed: true, entitlement };
}
