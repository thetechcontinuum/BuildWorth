"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScenarioMetrics = calculateScenarioMetrics;
/**
 * Calculates deterministic unit economics and financial metrics under v1.0.0 rules.
 * All monetary inputs and outputs operate strictly on integer minor units (cents).
 * No raw floats are stored for money.
 */
function calculateScenarioMetrics(input, _costs = [], benefits = []) {
  const {
    activeCustomers,
    monthlyPriceCents,
    onboardingPriceCents = 0,
    variableCostPerCustomerCents,
    monthlyFixedCostCents,
    customerAcquisitionCostCents,
  } = input;
  // 1. Monthly Revenue
  let monthlyRevenueCents;
  if (activeCustomers < 0 || monthlyPriceCents < 0) {
    monthlyRevenueCents = {
      status: "INVALID_ASSUMPTION",
      reason: "Negative customer count or price",
    };
  } else {
    monthlyRevenueCents = { status: "CALCULATED", value: activeCustomers * monthlyPriceCents };
  }
  // 2. Monthly Variable Cost
  let monthlyVariableCostCents;
  if (activeCustomers < 0 || variableCostPerCustomerCents < 0) {
    monthlyVariableCostCents = {
      status: "INVALID_ASSUMPTION",
      reason: "Negative customer count or variable cost",
    };
  } else {
    monthlyVariableCostCents = {
      status: "CALCULATED",
      value: activeCustomers * variableCostPerCustomerCents,
    };
  }
  // 3. Contribution Margin Per Customer
  let contributionMarginPerCustomerCents;
  if (monthlyPriceCents <= 0) {
    contributionMarginPerCustomerCents = {
      status: "NOT_ENOUGH_DATA",
      reason: "Monthly price is unconfigured or zero",
    };
  } else {
    const cm = monthlyPriceCents - variableCostPerCustomerCents;
    if (cm < 0) {
      contributionMarginPerCustomerCents = {
        status: "NEGATIVE_UNIT_ECONOMICS",
        value: cm,
        reason: "Variable cost per customer exceeds monthly price",
      };
    } else {
      contributionMarginPerCustomerCents = { status: "CALCULATED", value: cm };
    }
  }
  // 4. Monthly Total Contribution Margin
  let monthlyContributionMarginCents;
  if (
    monthlyRevenueCents.status === "CALCULATED" &&
    monthlyVariableCostCents.status === "CALCULATED"
  ) {
    const totalCm = (monthlyRevenueCents.value ?? 0) - (monthlyVariableCostCents.value ?? 0);
    if (totalCm < 0 && activeCustomers > 0) {
      monthlyContributionMarginCents = {
        status: "NEGATIVE_UNIT_ECONOMICS",
        value: totalCm,
        reason: "Variable costs exceed revenues across active customer base",
      };
    } else {
      monthlyContributionMarginCents = { status: "CALCULATED", value: totalCm };
    }
  } else {
    monthlyContributionMarginCents = { status: "NOT_ENOUGH_DATA" };
  }
  // 5. Gross Margin Percentage
  let grossMarginPercent;
  if (monthlyPriceCents <= 0) {
    grossMarginPercent = {
      status: "NOT_ENOUGH_DATA",
      reason: "Cannot calculate gross margin with zero price",
    };
  } else {
    const cm = monthlyPriceCents - variableCostPerCustomerCents;
    const gmRatio = (cm / monthlyPriceCents) * 100;
    const roundedGm = Math.round(gmRatio * 100) / 100; // 2 decimal precision
    if (cm < 0) {
      grossMarginPercent = {
        status: "NEGATIVE_UNIT_ECONOMICS",
        value: roundedGm,
        reason: "Unit gross margin is negative",
      };
    } else {
      grossMarginPercent = { status: "CALCULATED", value: roundedGm };
    }
  }
  // 6. Monthly Operating Profit (Before Tax)
  let monthlyOperatingProfitCents;
  if (
    monthlyContributionMarginCents.status === "CALCULATED" ||
    monthlyContributionMarginCents.status === "NEGATIVE_UNIT_ECONOMICS"
  ) {
    const profit = (monthlyContributionMarginCents.value ?? 0) - monthlyFixedCostCents;
    monthlyOperatingProfitCents = { status: "CALCULATED", value: profit };
  } else {
    monthlyOperatingProfitCents = { status: "NOT_ENOUGH_DATA" };
  }
  // 7. Break-Even Customer Count
  let breakEvenCustomers;
  if (contributionMarginPerCustomerCents.status === "NEGATIVE_UNIT_ECONOMICS") {
    breakEvenCustomers = {
      status: "NEGATIVE_UNIT_ECONOMICS",
      reason: "Infinite break-even: variable cost exceeds revenue per customer",
    };
  } else if (
    contributionMarginPerCustomerCents.status !== "CALCULATED" ||
    (contributionMarginPerCustomerCents.value ?? 0) <= 0
  ) {
    breakEvenCustomers = {
      status: "NOT_ENOUGH_DATA",
      reason: "Zero or invalid contribution margin per customer",
    };
  } else if (monthlyFixedCostCents === 0) {
    breakEvenCustomers = { status: "CALCULATED", value: 0 };
  } else {
    const cmValue = contributionMarginPerCustomerCents.value ?? 1;
    const count = Math.ceil(monthlyFixedCostCents / cmValue);
    breakEvenCustomers = { status: "CALCULATED", value: count };
  }
  // 8. Customer Annual Cost
  let customerAnnualCostCents;
  if (monthlyPriceCents < 0 || onboardingPriceCents < 0) {
    customerAnnualCostCents = { status: "INVALID_ASSUMPTION", reason: "Negative price inputs" };
  } else {
    customerAnnualCostCents = {
      status: "CALCULATED",
      value: monthlyPriceCents * 12 + onboardingPriceCents,
    };
  }
  // 9. Customer Annual Benefit
  let customerAnnualBenefitCents;
  if (benefits.length === 0) {
    // Check fallback base calculation
    customerAnnualBenefitCents = {
      status: "NOT_ENOUGH_DATA",
      reason: "No quantified customer benefit drivers configured",
    };
  } else {
    const totalBenefit = benefits.reduce((acc, b) => acc + (b.annualValueCents || 0), 0);
    customerAnnualBenefitCents = { status: "CALCULATED", value: totalBenefit };
  }
  // 10. Customer Net Annual Benefit
  let customerNetAnnualBenefitCents;
  if (
    customerAnnualBenefitCents.status === "CALCULATED" &&
    customerAnnualCostCents.status === "CALCULATED"
  ) {
    const net = (customerAnnualBenefitCents.value ?? 0) - (customerAnnualCostCents.value ?? 0);
    customerNetAnnualBenefitCents = { status: "CALCULATED", value: net };
  } else {
    customerNetAnnualBenefitCents = { status: "NOT_ENOUGH_DATA" };
  }
  // 11. Customer ROI Percentage
  let customerRoiPercent;
  if (
    customerAnnualCostCents.status !== "CALCULATED" ||
    (customerAnnualCostCents.value ?? 0) <= 0
  ) {
    customerRoiPercent = {
      status: "INVALID_ASSUMPTION",
      reason: "Customer annual cost is zero or invalid",
    };
  } else if (customerNetAnnualBenefitCents.status !== "CALCULATED") {
    customerRoiPercent = { status: "NOT_ENOUGH_DATA", reason: "Customer benefit not quantified" };
  } else {
    const cost = customerAnnualCostCents.value ?? 1;
    const net = customerNetAnnualBenefitCents.value ?? 0;
    const roi = (net / cost) * 100;
    customerRoiPercent = { status: "CALCULATED", value: Math.round(roi * 100) / 100 };
  }
  // 12. Customer Payback Months
  let customerPaybackMonths;
  if (
    customerAnnualBenefitCents.status !== "CALCULATED" ||
    (customerAnnualBenefitCents.value ?? 0) <= 0
  ) {
    customerPaybackMonths = {
      status: "NOT_APPLICABLE",
      reason: "No positive customer annual benefit quantified",
    };
  } else if (
    customerAnnualCostCents.status !== "CALCULATED" ||
    (customerAnnualCostCents.value ?? 0) <= 0
  ) {
    customerPaybackMonths = { status: "CALCULATED", value: 0 };
  } else {
    const monthlyBenefit = (customerAnnualBenefitCents.value ?? 1) / 12;
    const cost = customerAnnualCostCents.value ?? 0;
    const payback = cost / monthlyBenefit;
    customerPaybackMonths = { status: "CALCULATED", value: Math.round(payback * 10) / 10 };
  }
  // 13. Provider CAC Payback Months
  let providerCacPaybackMonths;
  if (customerAcquisitionCostCents <= 0) {
    providerCacPaybackMonths = { status: "CALCULATED", value: 0 };
  } else if (
    contributionMarginPerCustomerCents.status !== "CALCULATED" ||
    (contributionMarginPerCustomerCents.value ?? 0) <= 0
  ) {
    providerCacPaybackMonths = {
      status: "NEGATIVE_UNIT_ECONOMICS",
      reason: "Cannot recover CAC with non-positive unit margin",
    };
  } else {
    const monthlyCm = contributionMarginPerCustomerCents.value ?? 1;
    const payback = customerAcquisitionCostCents / monthlyCm;
    providerCacPaybackMonths = { status: "CALCULATED", value: Math.round(payback * 10) / 10 };
  }
  return {
    monthlyRevenueCents,
    monthlyVariableCostCents,
    monthlyContributionMarginCents,
    contributionMarginPerCustomerCents,
    grossMarginPercent,
    monthlyOperatingProfitCents,
    breakEvenCustomers,
    customerAnnualCostCents,
    customerAnnualBenefitCents,
    customerNetAnnualBenefitCents,
    customerRoiPercent,
    customerPaybackMonths,
    providerCacPaybackMonths,
  };
}
//# sourceMappingURL=calculator.js.map
