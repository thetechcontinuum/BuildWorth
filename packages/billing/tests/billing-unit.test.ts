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
});
