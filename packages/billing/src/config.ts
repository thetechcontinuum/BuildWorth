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

  const isProd = process.env.NODE_ENV === "production" && !process.env.TEST_ENV;

  const rawMonthlyCents = process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS;
  const rawYearlyCents = process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS;
  const rawCurrency = process.env.STRIPE_CURRENCY;

  let stripeProMonthlyAmountCents = 0;
  if (rawMonthlyCents !== undefined && rawMonthlyCents !== "") {
    const parsed = parseInt(rawMonthlyCents, 10);
    if (!isNaN(parsed) && parsed > 0 && String(parsed) === rawMonthlyCents.trim()) {
      stripeProMonthlyAmountCents = parsed;
    }
  } else if (!isProd) {
    stripeProMonthlyAmountCents = 1900;
  }

  let stripeProYearlyAmountCents = 0;
  if (rawYearlyCents !== undefined && rawYearlyCents !== "") {
    const parsed = parseInt(rawYearlyCents, 10);
    if (!isNaN(parsed) && parsed > 0 && String(parsed) === rawYearlyCents.trim()) {
      stripeProYearlyAmountCents = parsed;
    }
  } else if (!isProd) {
    stripeProYearlyAmountCents = 19000;
  }

  let stripeCurrency = "";
  if (rawCurrency !== undefined && rawCurrency !== "") {
    const trimmed = rawCurrency.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(trimmed)) {
      stripeCurrency = trimmed;
    }
  } else if (!isProd) {
    stripeCurrency = "USD";
  }

  // Canonical server application URL validation
  const rawAppUrl = process.env.APP_URL || (!isProd ? process.env.NEXT_PUBLIC_APP_URL : "") || "http://localhost:3000";
  let appUrl = "http://localhost:3000";
  try {
    const parsedUrl = new URL(rawAppUrl);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      if (!parsedUrl.username && !parsedUrl.password) {
        appUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      }
    }
  } catch {}

  const isLiveBilling = stripeSecretKey.startsWith("sk_live_");

  return {
    stripeSecretKey,
    stripeWebhookSecret,
    stripeProMonthlyPriceId,
    stripeProYearlyPriceId,
    stripeProMonthlyAmountCents,
    stripeProYearlyAmountCents,
    stripeCurrency,
    appUrl,
    isLiveBilling,
  };
}
