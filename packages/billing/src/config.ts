export interface BillingConfig {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripeProMonthlyPriceId: string;
  stripeProYearlyPriceId: string;
  stripeProMonthlyAmountCents: number;
  stripeProYearlyAmountCents: number;
  stripeCurrency: string;
  appUrl: string;
  isLiveBilling: boolean;
}

export function getBillingConfig(): BillingConfig {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const stripeProMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "";
  const stripeProYearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID || "";

  const parsedMonthlyCents = parseInt(process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS || "1900", 10);
  const parsedYearlyCents = parseInt(process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS || "19000", 10);
  const stripeProMonthlyAmountCents = isNaN(parsedMonthlyCents) || parsedMonthlyCents <= 0 ? 1900 : parsedMonthlyCents;
  const stripeProYearlyAmountCents = isNaN(parsedYearlyCents) || parsedYearlyCents <= 0 ? 19000 : parsedYearlyCents;
  const stripeCurrency = (process.env.STRIPE_CURRENCY || "USD").toUpperCase();

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const isLiveBilling = stripeSecretKey.startsWith("sk_live_");

  return {
    stripeSecretKey,
    stripeWebhookSecret,
    stripeProMonthlyPriceId,
    stripeProYearlyPriceId,
    stripeProMonthlyAmountCents,
    stripeProYearlyAmountCents,
    stripeCurrency,
    appUrl: appUrl.replace(/\/+$/, ""),
    isLiveBilling,
  };
}
