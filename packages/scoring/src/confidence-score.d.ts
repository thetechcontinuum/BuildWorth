import { ConfidenceInput, ConfidenceExplanation } from "./types.js";
export declare const CONFIDENCE_RUBRIC_VERSION = "2.0.0";
export interface EvidenceConfidenceCalculationResult {
    score: number;
    explanation: ConfidenceExplanation;
}
/**
 * Calculates deterministic Evidence Confidence (0 - 100) under Rubric v2.0.0.
 *
 * Positive Components (Max 100):
 * - Verified evidence volume: 15
 * - Independent source diversity: 15
 * - Source-family diversity: 10
 * - Source credibility: 15
 * - Direct buyer-intent evidence: 15
 * - Evidence recency: 10
 * - Key-claim coverage: 20
 *
 * Contradiction penalty: up to 20 points
 * finalConfidence = clamp(positiveScore - contradictionPenalty, 0, 100)
 */
export declare function calculateEvidenceConfidence(input: ConfidenceInput): EvidenceConfidenceCalculationResult;
//# sourceMappingURL=confidence-score.d.ts.map