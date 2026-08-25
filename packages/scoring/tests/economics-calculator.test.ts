import { describe, it, expect } from "vitest";
import { calculateScenarioMetrics } from "../src/economics/calculator.js";

describe("Financial Economics Calculator v1.0.0", () => {
  it("calculates healthy SaaS unit economics accurately in integer cents", () => {
    const metrics = calculateScenarioMetrics(
      {
        scenarioType: "BASE",
        currency: "USD",
        activeCustomers: 50,
        monthlyPriceCents: 19900, // $199/mo
        onboardingPriceCents: 0,
        variableCostPerCustomerCents: 1500, // $15/mo serverless & AI compute
        monthlyFixedCostCents: 200000, // $2,000/mo fixed op cost
        customerAcquisitionCostCents: 45000, // $450 CAC
        deliveryTimeWeeks: 6,
      },
      [],
      [
        {
          id: "bd-1",
          category: "LABOR_TIME_SAVED",
          title: "Audit prep hours saved",
          affectedRole: "DevOps Engineer",
          unitQuantity: 30,
          unitValueCents: 7500,
          frequencyPeriod: "MONTHLY",
          annualValueCents: 2700000, // $27,000/yr
          calculationDescription: "30 hrs x $75/hr x 12 mos",
          provenanceType: "VERIFIED_EVIDENCE_BACKED",
          evidenceLinkIds: [],
          assumptionIds: [],
          confidenceScore: 85,
        },
      ]
    );

    expect(metrics.monthlyRevenueCents.status).toBe("CALCULATED");
    expect(metrics.monthlyRevenueCents.value).toBe(50 * 19900); // $9,950.00

    expect(metrics.contributionMarginPerCustomerCents.status).toBe("CALCULATED");
    expect(metrics.contributionMarginPerCustomerCents.value).toBe(19900 - 1500); // 18400 cents ($184)

    expect(metrics.grossMarginPercent.status).toBe("CALCULATED");
    expect(metrics.grossMarginPercent.value).toBe(92.46);

    expect(metrics.monthlyOperatingProfitCents.status).toBe("CALCULATED");
    expect(metrics.monthlyOperatingProfitCents.value).toBe((50 * 18400) - 200000); // $7,200.00

    expect(metrics.breakEvenCustomers.status).toBe("CALCULATED");
    expect(metrics.breakEvenCustomers.value).toBe(Math.ceil(200000 / 18400)); // 11 customers

    expect(metrics.customerAnnualCostCents.value).toBe(19900 * 12); // $2,388.00
    expect(metrics.customerNetAnnualBenefitCents.value).toBe(2700000 - (19900 * 12)); // $24,612.00

    expect(metrics.customerRoiPercent.status).toBe("CALCULATED");
    expect(metrics.customerRoiPercent.value).toBeGreaterThan(1000); // >1000% ROI

    expect(metrics.customerPaybackMonths.status).toBe("CALCULATED");
    expect(metrics.customerPaybackMonths.value).toBe(1.1); // ~1.1 months

    expect(metrics.providerCacPaybackMonths.status).toBe("CALCULATED");
    expect(metrics.providerCacPaybackMonths.value).toBe(2.4); // 2.4 months
  });

  it("handles negative unit economics honestly with tagged status", () => {
    const metrics = calculateScenarioMetrics({
      scenarioType: "CONSERVATIVE",
      currency: "USD",
      activeCustomers: 10,
      monthlyPriceCents: 5000, // $50/mo
      onboardingPriceCents: 0,
      variableCostPerCustomerCents: 7500, // $75/mo (cost exceeds price)
      monthlyFixedCostCents: 100000,
      customerAcquisitionCostCents: 20000,
      deliveryTimeWeeks: 4,
    });

    expect(metrics.contributionMarginPerCustomerCents.status).toBe("NEGATIVE_UNIT_ECONOMICS");
    expect(metrics.grossMarginPercent.status).toBe("NEGATIVE_UNIT_ECONOMICS");
    expect(metrics.breakEvenCustomers.status).toBe("NEGATIVE_UNIT_ECONOMICS");
    expect(metrics.providerCacPaybackMonths.status).toBe("NEGATIVE_UNIT_ECONOMICS");
  });

  it("handles zero price and missing inputs without returning fake zeros", () => {
    const metrics = calculateScenarioMetrics({
      scenarioType: "BASE",
      currency: "USD",
      activeCustomers: 0,
      monthlyPriceCents: 0,
      onboardingPriceCents: 0,
      variableCostPerCustomerCents: 0,
      monthlyFixedCostCents: 0,
      customerAcquisitionCostCents: 0,
      deliveryTimeWeeks: 0,
    });

    expect(metrics.contributionMarginPerCustomerCents.status).toBe("NOT_ENOUGH_DATA");
    expect(metrics.grossMarginPercent.status).toBe("NOT_ENOUGH_DATA");
    expect(metrics.customerRoiPercent.status).toBe("INVALID_ASSUMPTION");
    expect(metrics.customerPaybackMonths.status).toBe("NOT_APPLICABLE");
  });
});
