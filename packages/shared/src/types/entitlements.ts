export type SubscriptionTierType = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export type BillingSubscriptionStatusType =
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED"
  | "UNKNOWN";

export type EntitlementKey =
  | "EVIDENCE_LINEAGE_UNRESTRICTED"
  | "FOUNDER_FIT_FULL_BREAKDOWN"
  | "VENTURE_BLUEPRINT_FINANCIALS"
  | "VENTURE_BLUEPRINT_EXPORT"
  | "OPPORTUNITY_RADAR_WATCHLIST"
  | "OPPORTUNITY_RADAR_ALERTS"
  | "OPPORTUNITY_COMPARISON"
  | "EARLY_OPPORTUNITY_ACCESS"
  | "CUSTOM_SOURCE_INDEXING";

export interface ResolvedEntitlement {
  entitlementType: EntitlementKey;
  isGranted: boolean;
  isUnlimited: boolean;
  limitQuantity: number | null;
  remainingUnits: number | null;
  resetInterval: "DAILY" | "MONTHLY" | "NEVER" | null;
  source: "SUBSCRIPTION" | "PROMOTIONAL" | "ADMIN_OVERRIDE" | "TRIAL" | "FREE_DEFAULT";
  expiresAt: string | null;
}

export interface UserEntitlementContext {
  userId: string;
  tier: SubscriptionTierType;
  hasActiveSubscription: boolean;
  subscriptionStatus: BillingSubscriptionStatusType | null;
  entitlements: Record<EntitlementKey, ResolvedEntitlement>;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  entitlement?: ResolvedEntitlement;
  upgradeRequired?: boolean;
}
