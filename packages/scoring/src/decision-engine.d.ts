import {
  DecisionRecommendation,
  PublicationQualityStatus,
  FinancialMetricOutputs,
  RiskItem,
  AssumptionItem,
} from "@buildworth/shared";
export interface DecisionEngineInput {
  opportunityScore: number;
  evidenceConfidence: number;
  publicationStatus: PublicationQualityStatus;
  criticalClaimsCoveredCount: number;
  baseScenarioMetrics: FinancialMetricOutputs;
  risks: RiskItem[];
  assumptions: AssumptionItem[];
  buyerAccessibilityScore?: number;
  hasSufficientWtpEvidence?: boolean;
}
/**
 * Deterministic Decision Recommendation Engine under Rule Rubric v1.0.0.
 * Precedence Order:
 * 1. REJECT: Negative unit economics in base scenario or critical assumption invalidated.
 * 2. WEAK_OPPORTUNITY: Structurally low Opportunity Score (< 55).
 * 3. WATCH: Stale evidence, timing dependency, or missing fresh evidence.
 * 4. VALIDATE_FIRST: Promising opportunity but missing critical buyer demand or WTP evidence.
 * 5. BUILD_CANDIDATE: Every single build gate passed (Verified publication status, 4/4 critical claims, healthy margin, 0 unresolved critical risks).
 */
export declare function evaluateDecisionRecommendation(input: DecisionEngineInput): {
  recommendation: DecisionRecommendation;
  reasonCodes: string[];
  blockingConditions: string[];
  economicsStatus: string;
  feasibilityStatus: string;
  criticalRiskIds: string[];
  invalidatedAssumptionIds: string[];
};
//# sourceMappingURL=decision-engine.d.ts.map
