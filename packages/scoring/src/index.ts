import { calculateOpportunityScore } from "./opportunity-score.js";
import { calculateEvidenceConfidence } from "./confidence-score.js";
import { calculateNormalizedSubscores } from "./subscores.js";
import { ScoringDimensionInput, ConfidenceInput } from "./types.js";
import { ScorecardResult } from "@buildworth/shared";
import { APP_CONSTANTS } from "@buildworth/config";

export * from "./types.js";
export * from "./opportunity-score.js";
export * from "./confidence-score.js";
export * from "./subscores.js";

export function evaluateOpportunityScorecard(
  dimensionInputs: ScoringDimensionInput[],
  confidenceInput: ConfidenceInput,
  rubricVersion = APP_CONSTANTS.DEFAULT_SCORING_RUBRIC_VERSION,
): ScorecardResult {
  const { totalScore, dimensionResults } = calculateOpportunityScore(dimensionInputs);
  const confidenceScore = calculateEvidenceConfidence(confidenceInput);
  const subscores = calculateNormalizedSubscores(dimensionResults);

  const isHypothesisOnly =
    totalScore >= APP_CONSTANTS.HIGH_SCORE_THRESHOLD &&
    confidenceScore < APP_CONSTANTS.HYPOTHESIS_CONFIDENCE_THRESHOLD;

  return {
    opportunityScore: totalScore,
    evidenceConfidenceScore: confidenceScore,
    ...subscores,
    rubricVersion,
    calculatedAt: new Date().toISOString(),
    isHypothesisOnly,
    dimensions: dimensionResults,
  };
}
