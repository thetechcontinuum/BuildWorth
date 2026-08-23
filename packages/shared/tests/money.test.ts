import { describe, it, expect } from "vitest";
import {
  createMoney,
  formatMoney,
  formatMoneyRange,
  toMinorUnits,
  toMajorUnits,
} from "../src/utils/money.js";

describe("Money Utilities", () => {
  it("creates valid money with integer minor units", () => {
    const money = createMoney(5000, "USD");
    expect(money.amountMinor).toBe(5000);
    expect(money.currency).toBe("USD");
  });

  it("throws when non-integer minor unit is provided", () => {
    expect(() => createMoney(50.5, "USD")).toThrow();
  });

  it("formats USD money correctly", () => {
    expect(formatMoney({ amountMinor: 150000, currency: "USD" })).toBe("$1,500");
    expect(formatMoney({ amountMinor: 2999, currency: "USD" })).toBe("$29.99");
  });

  it("formats money ranges correctly", () => {
    const range = { minMinor: 500000, maxMinor: 1200000, currency: "USD" as const };
    expect(formatMoneyRange(range)).toBe("$5,000 – $12,000");
  });

  it("converts major to minor units accurately", () => {
    expect(toMinorUnits(49.99)).toBe(4999);
    expect(toMajorUnits(4999)).toBe(49.99);
  });
});
