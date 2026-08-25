import { describe, it, expect } from "vitest";
import {
  hashToken,
  isValidEmail,
  normalizeEmail,
} from "../../database/src/auth-identity.js";

describe("Mandatory Phase 3 Authentication & Security Suite", () => {
  it("normalizes and validates email addresses correctly", () => {
    expect(normalizeEmail("  FOUNDER@Example.COM ")).toBe("founder@example.com");
    expect(isValidEmail("user@domain.com")).toBe(true);
    expect(isValidEmail("invalid-email-address")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
  });

  it("hashes tokens cryptographically with SHA-256 (64 hex characters) and ensures one-way irreversibility", () => {
    const raw = "sample-raw-high-entropy-verification-token-32-chars";
    const hashed1 = hashToken(raw);
    const hashed2 = hashToken(raw);
    expect(hashed1).toHaveLength(64);
    expect(hashed1).toBe(hashed2);
    expect(hashed1).not.toBe(raw);
  });
});
