import { SubscriptionTierType } from "@buildworth/shared";
import { getBillingConfig } from "./config.js";

export type BillingIntervalType = "MONTHLY" | "ANNUAL";

export interface ServerPriceCatalogEntry {
  catalogKey: string;
  tier: SubscriptionTierType;
  billingInterval: BillingIntervalType;
  currency: string;
  amountCents: number;
  displayAmount: string;
  displayInterval: string;
  isPopular?: boolean;
  savingsBadge?: string;
  description: string;
  features: string[];
}

export interface PublicPriceCatalogDTO {
  catalogKey: string;
  tier: SubscriptionTierType;
  billingInterval: BillingIntervalType;
  currency: string;
  amountCents: number;
  displayAmount: string;
  displayInterval: string;
  isPopular?: boolean;
  savingsBadge?: string;
  description: string;
  features: string[];
}

const PRO_FEATURES = [
  "Unrestricted Evidence Lineage & Raw Source Audit",
  "Full Multi-Dimensional Founder Fit Breakdown",
  "Decision-Grade Venture Financial Scenarios & Costs",
  "Export Venture Blueprints to Audit-Grade PDF & CSV",
  "Opportunity Radar Watchlist expansion (up to 50 items)",
  "Early access to newly verified market signals",
];

function formatCurrencyAmount(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return Number.isInteger(amount) ? `${symbol}${amount}` : `${symbol}${amount.toFixed(2)}`;
}

/**
 * Builds the authoritative server price catalog derived strictly from validated environment/server configuration.
 */
export function getServerPriceCatalog(): Record<string, ServerPriceCatalogEntry> {
  const config = getBillingConfig();

  // Validate currency
  if (!config.stripeCurrency || !/^[A-Z]{3}$/.test(config.stripeCurrency)) {
    throw new Error("CONFIGURATION_ERROR: Invalid or missing STRIPE_CURRENCY.");
  }

  // Validate monthly configuration
  const hasMonthlyPriceId = !!config.stripeProMonthlyPriceId && config.stripeProMonthlyPriceId !== "price_unconfigured";
  const hasMonthlyAmount = config.stripeProMonthlyAmountCents > 0;
  const isMonthlyValid = hasMonthlyPriceId && hasMonthlyAmount;

  // Validate yearly configuration
  const hasYearlyPriceId = !!config.stripeProYearlyPriceId && config.stripeProYearlyPriceId !== "price_unconfigured";
  const hasYearlyAmount = config.stripeProYearlyAmountCents > 0;
  const isYearlyValid = hasYearlyPriceId && hasYearlyAmount;

  const catalog: Record<string, ServerPriceCatalogEntry> = {};

  // Calculate annual savings badge if both valid
  let savingsBadge: string | undefined;
  if (isMonthlyValid && isYearlyValid) {
    const annualizedMonthly = config.stripeProMonthlyAmountCents * 12;
    const annualSavingsCents = annualizedMonthly - config.stripeProYearlyAmountCents;
    if (annualSavingsCents > 0) {
      savingsBadge = `SAVE ${formatCurrencyAmount(annualSavingsCents, config.stripeCurrency)} / YEAR`;
    }
  }

  if (isMonthlyValid) {
    catalog.pro_monthly = {
      catalogKey: "pro_monthly",
      tier: "PRO",
      billingInterval: "MONTHLY",
      currency: config.stripeCurrency,
      amountCents: config.stripeProMonthlyAmountCents,
      displayAmount: formatCurrencyAmount(config.stripeProMonthlyAmountCents, config.stripeCurrency),
      displayInterval: "/ month",
      isPopular: true,
      description: "For founders, operators, and PMs building high-conviction ventures with zero guesswork.",
      features: [...PRO_FEATURES],
    };
  }

  if (isYearlyValid) {
    catalog.pro_annual = {
      catalogKey: "pro_annual",
      tier: "PRO",
      billingInterval: "ANNUAL",
      currency: config.stripeCurrency,
      amountCents: config.stripeProYearlyAmountCents,
      displayAmount: formatCurrencyAmount(config.stripeProYearlyAmountCents, config.stripeCurrency),
      displayInterval: "/ year",
      isPopular: true,
      savingsBadge,
      description: "For founders, operators, and PMs building high-conviction ventures with zero guesswork.",
      features: [...PRO_FEATURES],
    };
  }

  return catalog;
}

/**
 * Resolves allowlisted Stripe Price ID for a given catalogKey from server environment
 */
export function resolveServerPriceEntry(catalogKey: string): {
  entry: ServerPriceCatalogEntry;
  stripePriceId: string;
} {
  const catalog = getServerPriceCatalog();
  const entry = catalog[catalogKey];
  if (!entry) {
    throw new Error(`INVALID_CATALOG_KEY: Price catalog key "${catalogKey}" is not recognized.`);
  }

  const config = getBillingConfig();
  let stripePriceId: string | undefined;

  if (entry.tier === "PRO") {
    if (entry.billingInterval === "MONTHLY") {
      stripePriceId = config.stripeProMonthlyPriceId;
    } else if (entry.billingInterval === "ANNUAL") {
      stripePriceId = config.stripeProYearlyPriceId;
    }
  }

  if (!stripePriceId || stripePriceId === "price_unconfigured") {
    throw new Error("PRICING_UNAVAILABLE: Configured Stripe price ID is missing for this plan.");
  }

  if (config.isLiveBilling && /^price_(test|sample|fixture)_/.test(stripePriceId)) {
    throw new Error("SECURITY_ERROR: Test Stripe Price ID cannot be used in Live billing environment.");
  }

  return {
    entry,
    stripePriceId,
  };
}

/**
 * Verifies that a resolved catalog entry matches the provider Stripe Price object.
 * Throws PRICING_CONFIGURATION_MISMATCH if any attribute disagrees.
 */
export function verifyPriceAgainstProvider(
  entry: ServerPriceCatalogEntry,
  stripePrice: {
    id: string;
    active?: boolean;
    currency?: string;
    unit_amount?: number | null;
    recurring?: { interval?: string } | null;
  },
): void {
  if (!stripePrice || !stripePrice.id) {
    throw new Error("PRICING_CONFIGURATION_MISMATCH: Stripe price object is missing or invalid.");
  }

  if (stripePrice.active === false) {
    throw new Error(`PRICING_CONFIGURATION_MISMATCH: Stripe price ${stripePrice.id} is inactive.`);
  }

  if (stripePrice.currency && stripePrice.currency.toUpperCase() !== entry.currency.toUpperCase()) {
    throw new Error(
      `PRICING_CONFIGURATION_MISMATCH: Currency mismatch for ${entry.catalogKey}. Configured: ${entry.currency}, Stripe: ${stripePrice.currency.toUpperCase()}`,
    );
  }

  if (stripePrice.unit_amount !== undefined && stripePrice.unit_amount !== null && stripePrice.unit_amount !== entry.amountCents) {
    throw new Error(
      `PRICING_CONFIGURATION_MISMATCH: Amount mismatch for ${entry.catalogKey}. Configured: ${entry.amountCents}, Stripe: ${stripePrice.unit_amount}`,
    );
  }

  if (stripePrice.recurring) {
    const expectedInterval = entry.billingInterval === "MONTHLY" ? "month" : "year";
    if (stripePrice.recurring.interval && stripePrice.recurring.interval.toLowerCase() !== expectedInterval) {
      throw new Error(
        `PRICING_CONFIGURATION_MISMATCH: Interval mismatch for ${entry.catalogKey}. Configured: ${entry.billingInterval}, Stripe: ${stripePrice.recurring.interval}`,
      );
    }
  }
}

/**
 * Returns sanitized public catalog DTOs without secret values
 */
export function getPublicPriceCatalogDTO(): PublicPriceCatalogDTO[] {
  const catalog = getServerPriceCatalog();
  return Object.values(catalog).map((meta) => ({
    catalogKey: meta.catalogKey,
    tier: meta.tier,
    billingInterval: meta.billingInterval,
    currency: meta.currency,
    amountCents: meta.amountCents,
    displayAmount: meta.displayAmount,
    displayInterval: meta.displayInterval,
    isPopular: meta.isPopular,
    savingsBadge: meta.savingsBadge,
    description: meta.description,
    features: [...meta.features],
  }));
}
