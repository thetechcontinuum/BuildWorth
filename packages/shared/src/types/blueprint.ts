import { PublicationQualityStatus } from "./evidence.js";
import {
  CostCategory,
  BenefitCategory,
  ScenarioType,
  CostType,
  FrequencyPeriod,
  FinancialMetricOutputs,
} from "./economics.js";

export type DecisionRecommendation =
  "BUILD_CANDIDATE" | "VALIDATE_FIRST" | "WATCH" | "WEAK_OPPORTUNITY" | "REJECT" | "UNASSESSED";

export type RiskCategory =
  | "MARKET"
  | "BUYER"
  | "COMPETITION"
  | "TECHNICAL"
  | "DATA"
  | "SECURITY"
  | "PRIVACY"
  | "REGULATORY"
  | "FINANCIAL"
  | "DISTRIBUTION"
  | "OPERATIONS"
  | "DEPENDENCY";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskStatus = "IDENTIFIED" | "MITIGATING" | "RESOLVED" | "ACCEPTED";

export type AssumptionCategory =
  | "PROBLEM"
  | "BUYER"
  | "WILLINGNESS_TO_PAY"
  | "SOLUTION"
  | "FEASIBILITY"
  | "DISTRIBUTION"
  | "COST"
  | "REGULATORY";

export type AssumptionStatus =
  "UNTESTED" | "TESTING" | "SUPPORTED" | "CONTRADICTED" | "INVALIDATED";

export type ExperimentType =
  | "CUSTOMER_INTERVIEW"
  | "LANDING_PAGE"
  | "WAITLIST"
  | "PREORDER"
  | "PAID_PILOT"
  | "CONCIERGE_MVP"
  | "PROTOTYPE_TEST"
  | "PRICING_TEST"
  | "CHANNEL_TEST"
  | "TECHNICAL_SPIKE";

export type ExperimentStatus = "PLANNED" | "RUNNING" | "PASSED" | "FAILED" | "ABANDONED";
export type SalesMotion =
  | "SELF_SERVICE"
  | "PRODUCT_LED"
  | "FOUNDER_LED"
  | "SALES_ASSISTED"
  | "ENTERPRISE_SALES"
  | "PARTNER_LED";

export type MvpCategory = "MUST_HAVE" | "SHOULD_HAVE" | "LATER" | "OUT_OF_SCOPE";
export type ProvenanceType =
  | "VERIFIED_EVIDENCE_BACKED"
  | "PARTIALLY_EVIDENCE_BACKED"
  | "ASSUMPTION"
  | "MODEL_ESTIMATE"
  | "LEGACY_UNCLASSIFIED"
  | "SYNTHETIC_FIXTURE"
  | "USER_PROVIDED";

export interface DecisionEvaluationResult {
  recommendation: DecisionRecommendation;
  reasonCodes: string[];
  blockingConditions: string[];
  opportunityScoreUsed: number;
  evidenceConfidenceUsed: number;
  publicationStatusUsed: PublicationQualityStatus;
  economicsStatus: string;
  feasibilityStatus: string;
  criticalRiskIds: string[];
  invalidatedAssumptionIds: string[];
  decisionRuleVersion: string;
  inputHash: string;
  evaluatedAt: string;
}

export interface CustomerSegmentItem {
  id: string;
  segmentName: string;
  industry: string;
  companySizeRange: string;
  geography: string;
  businessModel: string;
  endUserRole: string;
  economicBuyerRole: string;
  technicalApproverRole?: string | null;
  procurementComplexity: string;
  budgetCategory: string;
  spendingBehavior: string;
  buyingTrigger: string;
  primaryObjection: string;
  acquisitionChannels: string[];
  salesCycleMinDays: number;
  salesCycleMaxDays: number;
  salesMotion: SalesMotion;
  confidenceScore: number;
  provenanceType: ProvenanceType;
  evidenceLinkIds: string[];
}

export interface MvpFeatureItem {
  id: string;
  featureName: string;
  description: string;
  category: MvpCategory;
  userJourneyStep?: string | null;
  requiredIntegrations: string[];
  requiredData: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  orderIndex: number;
}

export interface CompetitorItem {
  id: string;
  name: string;
  competitorType: string;
  knownPricing?: string | null;
  strengths: string[];
  recurringComplaints: string[];
  differentiationHypothesis: string;
  switchingCosts: string;
  provenanceType: ProvenanceType;
  evidenceLinkIds: string[];
}

export interface CostLineItemData {
  id: string;
  costType: CostType;
  category: CostCategory;
  title: string;
  description?: string | null;
  scenarioType: ScenarioType;
  amountMinorCents: number;
  currency: string;
  estimateMethod: string;
  provenanceType: ProvenanceType;
  evidenceLinkIds: string[];
  assumptionIds: string[];
  confidenceScore: number;
}

export interface BenefitDriverData {
  id: string;
  category: BenefitCategory;
  title: string;
  affectedRole: string;
  unitQuantity: number;
  unitValueCents: number;
  frequencyPeriod: FrequencyPeriod;
  annualValueCents: number;
  calculationDescription: string;
  provenanceType: ProvenanceType;
  evidenceLinkIds: string[];
  assumptionIds: string[];
  confidenceScore: number;
}

export interface RiskItem {
  id: string;
  category: RiskCategory;
  description: string;
  probabilityScore: number;
  impactScore: number;
  severity: RiskSeverity;
  mitigationStrategy: string;
  earlyWarningIndicator?: string | null;
  status: RiskStatus;
  evidenceLinkIds: string[];
  provenanceType: ProvenanceType;
}

export interface AssumptionItem {
  id: string;
  statement: string;
  category: AssumptionCategory;
  importanceScore: number;
  uncertaintyScore: number;
  testMethod: string;
  successThreshold: string;
  failureThreshold: string;
  status: AssumptionStatus;
  evidenceLinkIds: string[];
  provenanceType: ProvenanceType;
}

export interface ValidationExperimentItem {
  id: string;
  hypothesis: string;
  experimentType: ExperimentType;
  targetParticipant: string;
  sampleSize: number;
  estimatedCostCents: number;
  estimatedDurationDays: number;
  acquisitionChannel: string;
  procedureSummary: string;
  successMetric: string;
  successThreshold: string;
  failureThreshold: string;
  killCriterion: string;
  nextActionOnSuccess: string;
  nextActionOnFailure: string;
  status: ExperimentStatus;
  orderPriority: number;
  evidenceGeneratedIds: string[];
}

export interface FullVentureBlueprint {
  id: string;
  opportunityRevisionId: string;
  schemaVersion: string;
  generationStatus: string;
  generatedAt: string;
  calculationVersion: string;
  decisionRuleVersion: string;
  inputHash: string;

  architectureSummary?: string | null;
  gtmNarrative?: {
    initialWedge: string;
    leadSource: string;
    outreachApproach: string;
    proofRequired: string;
    initialOffer: string;
    pilotStructure: string;
    objectionPlaybook: { objection: string; responseHypothesis: string }[];
  } | null;
  first20Plan?: {
    stage1_5: { icp: string; channel: string; offer: string; metric: string };
    stage6_10: { referralMechanisms: string; caseStudyProof: string; pricingTest: string };
    stage11_15: { repeatableChannel: string; salesMaterials: string; activationMetric: string };
    stage16_20: { channelComparison: string; retentionCheck: string; scaleDecision: string };
  } | null;
  reachableMarket?: {
    method: string;
    inputValues: Record<string, any>;
    assumptions: string[];
    lowerBoundCents: number;
    baseCaseCents: number;
    upperBoundCents: number;
    confidence: number;
  } | null;

  customerSegments: CustomerSegmentItem[];
  mvpFeatures: MvpFeatureItem[];
  competitors: CompetitorItem[];
  financialScenarios: (FinancialMetricOutputs & {
    scenarioType: ScenarioType;
    currency: string;
    activeCustomers: number;
    monthlyPriceCents: number;
    onboardingPriceCents: number;
    variableCostPerCustomerCents: number;
    monthlyFixedCostCents: number;
    customerAcquisitionCostCents: number;
    deliveryTimeWeeks: number;
  })[];
  costLineItems: CostLineItemData[];
  benefitDrivers: BenefitDriverData[];
  risks: RiskItem[];
  assumptions: AssumptionItem[];
  validationExperiments: ValidationExperimentItem[];
  decisionEvaluation: DecisionEvaluationResult;
}
