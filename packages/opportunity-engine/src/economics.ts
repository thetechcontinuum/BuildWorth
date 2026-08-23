import { MoneyRange } from "@buildworth/shared";

export interface EconomicModelResult {
  estimatedMvpCost: MoneyRange;
  estimatedTimeToMvpWeeks: { min: number; max: number };
  estimatedMonthlyOperatingCost: MoneyRange;
  plausibleMonthlyPriceRange: MoneyRange;
  estimatedCustomerHoursSavedMonthly: number;
  estimatedCustomerValueCreatedMonthlyCents: number;
  breakEvenCustomerCount: { min: number; max: number };
  grossMarginPercent: number;
}

/**
 * Calculates conservative unit economics, payback, and break-even scenarios.
 */
export function calculateEconomics(
  complexityLevel: "LOW" | "MEDIUM" | "HIGH",
  targetAudience: "DEV_TOOL" | "B2B_SAAS_OPS" | "ENTERPRISE_COMPLIANCE",
): EconomicModelResult {
  let mvpCostMin = 400000; // $4,000
  let mvpCostMax = 800000; // $8,000
  let weeksMin = 3;
  let weeksMax = 6;
  let opCostMin = 15000; // $150/mo
  let opCostMax = 35000; // $350/mo
  let priceMin = 4900; // $49/mo
  let priceMax = 19900; // $199/mo
  let hoursSaved = 20;

  if (complexityLevel === "MEDIUM") {
    mvpCostMin = 600000;
    mvpCostMax = 1200000;
    weeksMin = 4;
    weeksMax = 8;
    opCostMin = 25000;
    opCostMax = 60000;
    priceMin = 9900;
    priceMax = 39900;
    hoursSaved = 35;
  } else if (complexityLevel === "HIGH") {
    mvpCostMin = 1200000;
    mvpCostMax = 2500000;
    weeksMin = 8;
    weeksMax = 14;
    opCostMin = 50000;
    opCostMax = 150000;
    priceMin = 29900;
    priceMax = 99900;
    hoursSaved = 60;
  }

  if (targetAudience === "ENTERPRISE_COMPLIANCE") {
    priceMin = Math.round(priceMin * 1.5);
    priceMax = Math.round(priceMax * 2.0);
  }

  // Value created: assume $65/hr skilled labor rate
  const valueCreatedCents = hoursSaved * 65 * 100;

  // Break-even customer count based on monthly operating cost + 12-month MVP amortization
  const monthlyAmortizedMvp = (mvpCostMin + mvpCostMax) / 2 / 12;
  const avgMonthlyOpCost = (opCostMin + opCostMax) / 2;
  const totalMonthlyBurden = monthlyAmortizedMvp + avgMonthlyOpCost;

  const breakEvenMin = Math.ceil(totalMonthlyBurden / priceMax);
  const breakEvenMax = Math.ceil(totalMonthlyBurden / priceMin);

  return {
    estimatedMvpCost: { minMinor: mvpCostMin, maxMinor: mvpCostMax, currency: "USD" },
    estimatedTimeToMvpWeeks: { min: weeksMin, max: weeksMax },
    estimatedMonthlyOperatingCost: { minMinor: opCostMin, maxMinor: opCostMax, currency: "USD" },
    plausibleMonthlyPriceRange: { minMinor: priceMin, maxMinor: priceMax, currency: "USD" },
    estimatedCustomerHoursSavedMonthly: hoursSaved,
    estimatedCustomerValueCreatedMonthlyCents: valueCreatedCents,
    breakEvenCustomerCount: { min: breakEvenMin, max: breakEvenMax },
    grossMarginPercent: 85,
  };
}
