export type CalculationStatus =
  | "CALCULATED"
  | "NOT_ENOUGH_DATA"
  | "NOT_APPLICABLE"
  | "INVALID_ASSUMPTION"
  | "NEGATIVE_UNIT_ECONOMICS";

export interface TaggedCalculationResult<T = number> {
  status: CalculationStatus;
  value?: T;
  reason?: string;
}

export type ScenarioType = "CONSERVATIVE" | "BASE" | "UPSIDE";
export type CostType = "ONE_TIME_BUILD" | "MONTHLY_OPERATING";

export type CostCategory =
  | "PRODUCT_DISCOVERY"
  | "UX_UI_DESIGN"
  | "FRONTEND_DEV"
  | "BACKEND_DEV"
  | "DATABASE_INFRA"
  | "INTEGRATIONS"
  | "AI_MODEL_WORK"
  | "TESTING_QA"
  | "SECURITY_COMPLIANCE"
  | "DEPLOYMENT_DEVOPS"
  | "CONTINGENCY"
  | "HOSTING"
  | "DATABASE"
  | "STORAGE"
  | "AI_APIS"
  | "THIRD_PARTY_APIS"
  | "EMAIL_NOTIFICATIONS"
  | "OBSERVABILITY"
  | "SUPPORT"
  | "MAINTENANCE"
  | "COMPLIANCE"
  | "OTHER_VARIABLE";

export type BenefitCategory =
  | "LABOR_TIME_SAVED"
  | "AVOIDED_LOSSES"
  | "AVOIDED_DOWNTIME"
  | "REDUCED_SOFTWARE_SPEND"
  | "INCREASED_REVENUE"
  | "REDUCED_RISK"
  | "FASTER_DELIVERY"
  | "COMPLIANCE_SAVINGS";

export type FrequencyPeriod = "ONE_TIME" | "MONTHLY" | "ANNUAL" | "PER_INCIDENT";

export interface FinancialMetricOutputs {
  monthlyRevenueCents: TaggedCalculationResult<number>;
  monthlyVariableCostCents: TaggedCalculationResult<number>;
  monthlyContributionMarginCents: TaggedCalculationResult<number>;
  contributionMarginPerCustomerCents: TaggedCalculationResult<number>;
  grossMarginPercent: TaggedCalculationResult<number>;
  monthlyOperatingProfitCents: TaggedCalculationResult<number>;
  breakEvenCustomers: TaggedCalculationResult<number>;
  customerAnnualCostCents: TaggedCalculationResult<number>;
  customerAnnualBenefitCents: TaggedCalculationResult<number>;
  customerNetAnnualBenefitCents: TaggedCalculationResult<number>;
  customerRoiPercent: TaggedCalculationResult<number>;
  customerPaybackMonths: TaggedCalculationResult<number>;
  providerCacPaybackMonths: TaggedCalculationResult<number>;
}

export interface FinancialScenarioInput {
  scenarioType: ScenarioType;
  currency: string;
  activeCustomers: number;
  monthlyPriceCents: number;
  onboardingPriceCents: number;
  variableCostPerCustomerCents: number;
  monthlyFixedCostCents: number;
  customerAcquisitionCostCents: number;
  deliveryTimeWeeks: number;
  assumptions?: string[];
  evidenceIds?: string[];
}
