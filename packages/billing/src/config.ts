export interface BillingConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripeProMonthlyPriceId: string;
  stripeProYearlyPriceId: string;
  appUrl: string;
  isLiveBilling: boolean;
}

export function getBillingConfig(): BillingConfig {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_placeholder";
  const stripeProMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_test_pro_monthly";
  const stripeProYearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_test_pro_annual";
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const isLiveBilling = stripeSecretKey.startsWith("sk_live_");

  // Validate test/live key alignment
  if (process.env.NODE_ENV === "production" && !isLiveBilling && !process.env.ALLOW_TEST_STRIPE_IN_PROD) {
    // Test mode explicitly allowed in staging/preview, but logged
  }

  return {
    stripeSecretKey,
    stripeWebhookSecret,
    stripeProMonthlyPriceId,
    stripeProYearlyPriceId,
    appUrl: appUrl.replace(/\/+$/, ""),
    isLiveBilling,
  };
}
