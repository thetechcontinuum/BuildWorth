import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapStripeSubscriptionStatus } from "../src/subscription-mapper.js";
import { computePayloadHash } from "../src/webhook-service.js";
import { getBillingConfig } from "../src/config.js";
import {
  resolveServerPriceEntry,
  getPublicPriceCatalogDTO,
  SERVER_PRICE_CATALOG,
} from "../src/pricing-catalog.js";
import { sanitizeReturnTo } from "../src/checkout-service.js";

describe("Phase 4B/4D Billing Unit & Safety Tests", () => {
  beforeEach(() => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_unit_pro_monthly";
    process.env.STRIPE_PRO_YEARLY_PRICE_ID = "price_unit_pro_annual";
  });
  it("maps Stripe subscription statuses accurately and fails closed on unknown statuses", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("UNPAID");
    expect(mapStripeSubscriptionStatus("paused")).toBe("PAUSED");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("INCOMPLETE");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("INCOMPLETE_EXPIRED");

    // Explicit UNKNOWN on unrecognized status
    expect(mapStripeSubscriptionStatus("unknown_status_from_future_api")).toBe("UNKNOWN");
    expect(mapStripeSubscriptionStatus("")).toBe("UNKNOWN");
  });

  it("computes deterministic SHA-256 payload hash", () => {
    const rawPayload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const hash1 = computePayloadHash(rawPayload);
    const hash2 = computePayloadHash(rawPayload);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);

    const modifiedPayload = JSON.stringify({
      id: "evt_123",
      type: "checkout.session.completed",
      tampered: true,
    });
    const hash3 = computePayloadHash(modifiedPayload);
    expect(hash1).not.toBe(hash3);
  });

  it("derives sanitized appUrl and distinguishes live/test billing mode", () => {
    const config = getBillingConfig();
    expect(config.appUrl).toBeDefined();
    expect(config.appUrl.endsWith("/")).toBe(false);
    expect(typeof config.isLiveBilling).toBe("boolean");
  });

  it("resolves authoritative server pricing entries and rejects invalid catalogKey", () => {
    const monthly = resolveServerPriceEntry("pro_monthly");
    expect(monthly.entry.tier).toBe("PRO");
    expect(monthly.entry.billingInterval).toBe("MONTHLY");
    expect(monthly.stripePriceId).toBeDefined();

    const annual = resolveServerPriceEntry("pro_annual");
    expect(annual.entry.tier).toBe("PRO");
    expect(annual.entry.billingInterval).toBe("ANNUAL");
    expect(annual.stripePriceId).toBeDefined();

    expect(() => resolveServerPriceEntry("pro_hacked_plan")).toThrow("INVALID_CATALOG_KEY");
    expect(() => resolveServerPriceEntry("enterprise_free")).toThrow("INVALID_CATALOG_KEY");
  });

  it("provides sanitized public catalog DTO without secret keys or sensitive provider variables", () => {
    const dts = getPublicPriceCatalogDTO();
    expect(dts.length).toBe(2);
    for (const item of dts) {
      expect(item.catalogKey).toBeDefined();
      expect(item.tier).toBe("PRO");
      expect(item.amountCents).toBeGreaterThan(0);
      expect((item as any).stripeSecretKey).toBeUndefined();
      expect((item as any).stripeWebhookSecret).toBeUndefined();
    }
  });

  it("sanitizes returnTo and strictly prevents open redirects", () => {
    expect(sanitizeReturnTo("/opportunities")).toBe("/opportunities");
    expect(sanitizeReturnTo("/pricing")).toBe("/pricing");
    expect(sanitizeReturnTo("https://evil.com/phish")).toBe("/pricing");
    expect(sanitizeReturnTo("//evil.com")).toBe("/pricing");
    expect(sanitizeReturnTo("/\\evil.com")).toBe("/pricing");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/pricing");
    expect(sanitizeReturnTo(null)).toBe("/pricing");
    expect(sanitizeReturnTo("")).toBe("/pricing");
  });

  it("verifies provider Stripe Price against server catalog and fails closed on mismatches", async () => {
    const { verifyPriceAgainstProvider } = await import("../src/pricing-catalog.js");
    const { entry } = resolveServerPriceEntry("pro_monthly");

    // 1. Valid matching price
    expect(() =>
      verifyPriceAgainstProvider(entry, {
        id: "price_test_pro_monthly",
        active: true,
        currency: "USD",
        unit_amount: 1900,
        recurring: { interval: "month" },
      }),
    ).not.toThrow();

    // 2. Inactive price -> PRICING_CONFIGURATION_MISMATCH
    expect(() =>
      verifyPriceAgainstProvider(entry, {
        id: "price_test_pro_monthly",
        active: false,
        currency: "USD",
        unit_amount: 1900,
      }),
    ).toThrow("PRICING_CONFIGURATION_MISMATCH");

    // 3. Amount mismatch -> PRICING_CONFIGURATION_MISMATCH
    expect(() =>
      verifyPriceAgainstProvider(entry, {
        id: "price_test_pro_monthly",
        active: true,
        currency: "USD",
        unit_amount: 2900, // Disagrees with configured 1900!
      }),
    ).toThrow("PRICING_CONFIGURATION_MISMATCH");

    // 4. Currency mismatch -> PRICING_CONFIGURATION_MISMATCH
    expect(() =>
      verifyPriceAgainstProvider(entry, {
        id: "price_test_pro_monthly",
        active: true,
        currency: "EUR",
        unit_amount: 1900,
      }),
    ).toThrow("PRICING_CONFIGURATION_MISMATCH");

    // 5. Interval mismatch -> PRICING_CONFIGURATION_MISMATCH
    expect(() =>
      verifyPriceAgainstProvider(entry, {
        id: "price_test_pro_monthly",
        active: true,
        currency: "USD",
        unit_amount: 1900,
        recurring: { interval: "year" }, // Configured interval is month!
      }),
    ).toThrow("PRICING_CONFIGURATION_MISMATCH");
  });

  describe("Server-Authoritative Pricing Contract & Fallback Removal", () => {
    it("handles missing or malformed pricing configuration in production without test fallbacks", () => {
      const origEnv = process.env.NODE_ENV;
      const origTest = process.env.TEST_ENV;
      const origMonthly = process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS;
      const origYearly = process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS;
      const origCurrency = process.env.STRIPE_CURRENCY;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.TEST_ENV;

        // 1. Missing monthly amount in production
        delete process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS;
        process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS = "19000";
        process.env.STRIPE_CURRENCY = "USD";
        let config = getBillingConfig();
        expect(config.stripeProMonthlyAmountCents).toBe(0);

        // 2. Missing yearly amount in production
        process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS = "1900";
        delete process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS;
        config = getBillingConfig();
        expect(config.stripeProYearlyAmountCents).toBe(0);

        // 3. Missing currency in production
        delete process.env.STRIPE_CURRENCY;
        config = getBillingConfig();
        expect(config.stripeCurrency).toBe("");

        // 4. Malformed amount
        process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS = "not_a_number";
        config = getBillingConfig();
        expect(config.stripeProMonthlyAmountCents).toBe(0);

        // 5. Unsupported currency format
        process.env.STRIPE_CURRENCY = "US_DOLLAR";
        config = getBillingConfig();
        expect(config.stripeCurrency).toBe("");

        // 6. Valid explicit configuration
        process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS = "1900";
        process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS = "19000";
        process.env.STRIPE_CURRENCY = "USD";
        config = getBillingConfig();
        expect(config.stripeProMonthlyAmountCents).toBe(1900);
        expect(config.stripeProYearlyAmountCents).toBe(19000);
        expect(config.stripeCurrency).toBe("USD");
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origTest !== undefined) process.env.TEST_ENV = origTest;
        if (origMonthly !== undefined) process.env.STRIPE_PRO_MONTHLY_AMOUNT_CENTS = origMonthly;
        if (origYearly !== undefined) process.env.STRIPE_PRO_YEARLY_AMOUNT_CENTS = origYearly;
        if (origCurrency !== undefined) process.env.STRIPE_CURRENCY = origCurrency;
      }
    });
  });

  describe("Privacy Transparency Contact Hardening", () => {
    it("handles explicit PRIVACY_CONTACT_EMAIL and unconfigured production state safely", async () => {
      const { getPrivacyRetentionDTO } = await import("../src/commercial-events.js");
      const origEnv = process.env.NODE_ENV;
      const origTest = process.env.TEST_ENV;
      const origEmail = process.env.PRIVACY_CONTACT_EMAIL;

      try {
        // Explicit valid email
        process.env.PRIVACY_CONTACT_EMAIL = "compliance@buildworth.io";
        let dto = getPrivacyRetentionDTO();
        expect(dto.privacyContact).toBe("compliance@buildworth.io");
        expect(dto.privacyContactConfigured).toBe(true);

        // Production without configured email
        process.env.NODE_ENV = "production";
        delete process.env.TEST_ENV;
        delete process.env.PRIVACY_CONTACT_EMAIL;

        dto = getPrivacyRetentionDTO();
        expect(dto.privacyContact).toBeNull();
        expect(dto.privacyContactConfigured).toBe(false);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origTest !== undefined) process.env.TEST_ENV = origTest;
        if (origEmail !== undefined) process.env.PRIVACY_CONTACT_EMAIL = origEmail;
        else delete process.env.PRIVACY_CONTACT_EMAIL;
      }
    });
  });

  describe("Canonical Application URL Ownership & Normalization", () => {
    it("normalizes origins and rejects credentials, fragments, and paths", () => {
      const origAppUrl = process.env.APP_URL;
      try {
        process.env.APP_URL = "https://app.buildworth.io/subpath/";
        let config = getBillingConfig();
        expect(config.appUrl).toBe("https://app.buildworth.io");

        process.env.APP_URL = "https://user:pass@evil.com/leak";
        config = getBillingConfig();
        expect(config.appUrl).toBe("http://localhost:3000"); // Neutralized fallback

        process.env.APP_URL = "javascript:alert(1)";
        config = getBillingConfig();
        expect(config.appUrl).toBe("http://localhost:3000");
      } finally {
        if (origAppUrl !== undefined) process.env.APP_URL = origAppUrl;
        else delete process.env.APP_URL;
      }
    });
  });
});
