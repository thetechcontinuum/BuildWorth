import { EntitlementKey, SubscriptionTierType } from "@buildworth/shared";

export interface PlanConfig {
  code: SubscriptionTierType;
  name: string;
  description: string;
  isActive: boolean;
  monthlyPriceCents: number;
  annualPriceCents: number;
  entitlements: Record<
    EntitlementKey,
    {
      isGranted: boolean;
      isUnlimited: boolean;
      limitQuantity: number | null;
      resetInterval: "DAILY" | "MONTHLY" | "NEVER" | null;
    }
  >;
}

export const CANONICAL_PLANS: Record<SubscriptionTierType, PlanConfig> = {
  FREE: {
    code: "FREE",
    name: "Free",
    description: "For exploratory researchers and indie hackers.",
    isActive: true,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    entitlements: {
      EVIDENCE_LINEAGE_UNRESTRICTED: { isGranted: false, isUnlimited: false, limitQuantity: 3, resetInterval: "NEVER" },
      FOUNDER_FIT_FULL_BREAKDOWN: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_FINANCIALS: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_EXPORT: { isGranted: false, isUnlimited: false, limitQuantity: 0, resetInterval: null },
      OPPORTUNITY_RADAR_WATCHLIST: { isGranted: true, isUnlimited: false, limitQuantity: 3, resetInterval: "NEVER" },
      OPPORTUNITY_RADAR_ALERTS: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_COMPARISON: { isGranted: true, isUnlimited: false, limitQuantity: 2, resetInterval: "NEVER" },
      EARLY_OPPORTUNITY_ACCESS: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
      CUSTOM_SOURCE_INDEXING: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
    },
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    description: "For active builders, startup founders, and PMs.",
    isActive: true,
    monthlyPriceCents: 1900, // $19.00 USD
    annualPriceCents: 19000, // $190.00 USD
    entitlements: {
      EVIDENCE_LINEAGE_UNRESTRICTED: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      FOUNDER_FIT_FULL_BREAKDOWN: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_FINANCIALS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_EXPORT: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_RADAR_WATCHLIST: { isGranted: true, isUnlimited: false, limitQuantity: 50, resetInterval: "NEVER" },
      OPPORTUNITY_RADAR_ALERTS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_COMPARISON: { isGranted: true, isUnlimited: false, limitQuantity: 5, resetInterval: "NEVER" },
      EARLY_OPPORTUNITY_ACCESS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      CUSTOM_SOURCE_INDEXING: { isGranted: false, isUnlimited: false, limitQuantity: null, resetInterval: null },
    },
  },
  TEAM: {
    code: "TEAM",
    name: "Team & Studio",
    description: "For software agencies, venture studios, and accelerators.",
    isActive: false, // Inactive future plan in Phase 4A
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    entitlements: {
      EVIDENCE_LINEAGE_UNRESTRICTED: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      FOUNDER_FIT_FULL_BREAKDOWN: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_FINANCIALS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_EXPORT: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_RADAR_WATCHLIST: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_RADAR_ALERTS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_COMPARISON: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      EARLY_OPPORTUNITY_ACCESS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      CUSTOM_SOURCE_INDEXING: { isGranted: true, isUnlimited: false, limitQuantity: 5, resetInterval: "MONTHLY" },
    },
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "For innovation departments & enterprise automation.",
    isActive: false, // Inactive future plan in Phase 4A
    monthlyPriceCents: 29900,
    annualPriceCents: 299000,
    entitlements: {
      EVIDENCE_LINEAGE_UNRESTRICTED: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      FOUNDER_FIT_FULL_BREAKDOWN: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_FINANCIALS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      VENTURE_BLUEPRINT_EXPORT: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_RADAR_WATCHLIST: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_RADAR_ALERTS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      OPPORTUNITY_COMPARISON: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      EARLY_OPPORTUNITY_ACCESS: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
      CUSTOM_SOURCE_INDEXING: { isGranted: true, isUnlimited: true, limitQuantity: null, resetInterval: null },
    },
  },
};
