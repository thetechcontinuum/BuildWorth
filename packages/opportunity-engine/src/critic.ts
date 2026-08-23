export interface CriticEvaluationResult {
  isApproved: boolean;
  scoreAdjustment: number;
  unsupportedClaims: string[];
  identifiedContradictions: string[];
  criticalRisks: string[];
  recommendation: "PUBLISH" | "MANUAL_REVIEW" | "REJECT";
}

export interface OpportunityToReview {
  title: string;
  problemStatement: string;
  proposedProduct: string;
  economicBuyer: string;
  supportingEvidenceCount: number;
  hasDirectBuyerIntent: boolean;
  majorRisks: string[];
}

/**
 * Adversarial Critic Step that inspects generated opportunities for logical fallacies,
 * lack of evidence corroboration, and ungrounded claims.
 */
export function critiqueOpportunity(opportunity: OpportunityToReview): CriticEvaluationResult {
  const unsupportedClaims: string[] = [];
  const identifiedContradictions: string[] = [];
  const criticalRisks: string[] = [];
  let scoreAdjustment = 0;

  // Rule 1: Zero or single evidence cannot be directly published
  if (opportunity.supportingEvidenceCount < 2) {
    unsupportedClaims.push(
      "Insufficient independent evidence sources (less than 2 verified signals).",
    );
    scoreAdjustment -= 10;
  }

  // Rule 2: Check buyer definition specificity
  if (
    !opportunity.economicBuyer ||
    opportunity.economicBuyer.toLowerCase().includes("anyone") ||
    opportunity.economicBuyer.toLowerCase().includes("everyone")
  ) {
    identifiedContradictions.push("Overly broad economic buyer defined; lacks title specificity.");
    scoreAdjustment -= 15;
  }

  // Rule 3: Check risk awareness
  if (!opportunity.majorRisks || opportunity.majorRisks.length === 0) {
    criticalRisks.push("No major risks or incumbent responses documented.");
    scoreAdjustment -= 5;
  }

  const isApproved = unsupportedClaims.length === 0 && identifiedContradictions.length === 0;

  let recommendation: "PUBLISH" | "MANUAL_REVIEW" | "REJECT" = "MANUAL_REVIEW";
  if (!isApproved && scoreAdjustment <= -20) {
    recommendation = "REJECT";
  } else if (isApproved && opportunity.hasDirectBuyerIntent) {
    recommendation = "MANUAL_REVIEW"; // Default in MVP is always manual review
  }

  return {
    isApproved,
    scoreAdjustment,
    unsupportedClaims,
    identifiedContradictions,
    criticalRisks,
    recommendation,
  };
}
