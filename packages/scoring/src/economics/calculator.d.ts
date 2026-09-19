import {
  FinancialScenarioInput,
  FinancialMetricOutputs,
  CostLineItemData,
  BenefitDriverData,
} from "@buildworth/shared";
/**
 * Calculates deterministic unit economics and financial metrics under v1.0.0 rules.
 * All monetary inputs and outputs operate strictly on integer minor units (cents).
 * No raw floats are stored for money.
 */
export declare function calculateScenarioMetrics(
  input: FinancialScenarioInput,
  _costs?: CostLineItemData[],
  benefits?: BenefitDriverData[],
): FinancialMetricOutputs;
//# sourceMappingURL=calculator.d.ts.map
