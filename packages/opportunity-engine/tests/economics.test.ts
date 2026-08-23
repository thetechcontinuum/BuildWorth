import { describe, it, expect } from "vitest";
import { calculateEconomics } from "../src/economics.js";

describe("Economic Modeling", () => {
  it("calculates realistic financial ranges for medium complexity tools", () => {
    const eco = calculateEconomics("MEDIUM", "DEV_TOOL");
    expect(eco.estimatedMvpCost.minMinor).toBe(600000);
    expect(eco.estimatedMvpCost.maxMinor).toBe(1200000);
    expect(eco.grossMarginPercent).toBe(85);
    expect(eco.breakEvenCustomerCount.min).toBeGreaterThan(0);
  });
});
