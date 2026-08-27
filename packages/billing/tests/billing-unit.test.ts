import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapStripeSubscriptionStatus } from "../src/subscription-mapper.js";
import { computePayloadHash } from "../src/webhook-service.js";
import { getBillingConfig } from "../src/config.js";

describe("Phase 4B Billing Unit & Safety Tests", () => {
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
});
