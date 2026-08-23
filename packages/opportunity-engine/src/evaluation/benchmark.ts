export interface EvaluationMetricsInput {
  totalEvaluated: number;
  unsupportedClaimsCount: number;
  validBuyerDefinitionsCount: number;
  scoreDeviationSum: number;
  relevantEvidenceCount: number;
  totalEvidenceCount: number;
  duplicateOpportunityCount: number;
}

export interface EvaluationBenchmarkReport {
  unsupportedClaimRatePercent: number; // target < 2.0%
  buyerDefinitionQualityPercent: number; // target > 95.0%
  scoreCalibrationAvgError: number; // target < 5.0 points
  evidenceRelevancePercent: number; // target > 90.0%
  duplicateRatePercent: number; // target < 1.0%
  isAutoPublishPermitted: boolean;
  blockers: string[];
}

/**
 * Calculates benchmark quality metrics across a sample evaluation dataset.
 * Enforces safety thresholds before automatic publishing can be unlocked.
 */
export function calculateBenchmarkReport(input: EvaluationMetricsInput): EvaluationBenchmarkReport {
  const {
    totalEvaluated,
    unsupportedClaimsCount,
    validBuyerDefinitionsCount,
    scoreDeviationSum,
    relevantEvidenceCount,
    totalEvidenceCount,
    duplicateOpportunityCount,
  } = input;

  if (totalEvaluated < 50) {
    return {
      unsupportedClaimRatePercent: 0,
      buyerDefinitionQualityPercent: 0,
      scoreCalibrationAvgError: 0,
      evidenceRelevancePercent: 0,
      duplicateRatePercent: 0,
      isAutoPublishPermitted: false,
      blockers: [`Evaluation sample size too small (${totalEvaluated} / 100 minimum required).`],
    };
  }

  const unsupportedClaimRate = (unsupportedClaimsCount / totalEvaluated) * 100;
  const buyerQuality = (validBuyerDefinitionsCount / totalEvaluated) * 100;
  const scoreCalibError = scoreDeviationSum / totalEvaluated;
  const evidenceRelevance =
    totalEvidenceCount > 0 ? (relevantEvidenceCount / totalEvidenceCount) * 100 : 0;
  const duplicateRate = (duplicateOpportunityCount / totalEvaluated) * 100;

  const blockers: string[] = [];

  if (unsupportedClaimRate > 2.0) {
    blockers.push(
      `Unsupported claim rate too high: ${unsupportedClaimRate.toFixed(1)}% (Threshold: <= 2.0%)`,
    );
  }
  if (buyerQuality < 95.0) {
    blockers.push(
      `Buyer definition quality too low: ${buyerQuality.toFixed(1)}% (Threshold: >= 95.0%)`,
    );
  }
  if (scoreCalibError > 5.0) {
    blockers.push(
      `Score calibration error too high: ${scoreCalibError.toFixed(1)} pts (Threshold: <= 5.0 pts)`,
    );
  }
  if (evidenceRelevance < 90.0) {
    blockers.push(
      `Evidence relevance precision too low: ${evidenceRelevance.toFixed(1)}% (Threshold: >= 90.0%)`,
    );
  }
  if (duplicateRate > 1.0) {
    blockers.push(
      `Duplicate opportunity rate too high: ${duplicateRate.toFixed(1)}% (Threshold: <= 1.0%)`,
    );
  }

  return {
    unsupportedClaimRatePercent: Math.round(unsupportedClaimRate * 10) / 10,
    buyerDefinitionQualityPercent: Math.round(buyerQuality * 10) / 10,
    scoreCalibrationAvgError: Math.round(scoreCalibError * 10) / 10,
    evidenceRelevancePercent: Math.round(evidenceRelevance * 10) / 10,
    duplicateRatePercent: Math.round(duplicateRate * 10) / 10,
    isAutoPublishPermitted: blockers.length === 0 && totalEvaluated >= 100,
    blockers,
  };
}
