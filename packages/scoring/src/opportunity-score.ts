import { ScoringDimensionInput } from "./types.js";
import { ScoreDimensionResult } from "@buildworth/shared";

export const SCORING_RUBRIC_V1 = [
  { key: "pain_evidence", name: "Pain Evidence", maxScore: 15 },
  { key: "buyer_demand_wtp", name: "Buyer Demand & Willingness to Pay", maxScore: 15 },
  { key: "technical_feasibility", name: "Technical Feasibility", maxScore: 15 },
  { key: "economics", name: "Cost-Benefit Economics", maxScore: 15 },
  { key: "market_attractiveness", name: "Market Attractiveness", maxScore: 10 },
  { key: "buyer_accessibility", name: "Buyer Accessibility", maxScore: 10 },
  { key: "competition_differentiation", name: "Competition & Differentiation", maxScore: 10 },
  { key: "speed_to_validation", name: "Speed to Validation", maxScore: 5 },
  { key: "defensibility", name: "Defensibility", maxScore: 5 },
] as const;

/**
 * Calculates the Opportunity Score strictly summing to max 100 whole points.
 */
export function calculateOpportunityScore(dimensions: ScoringDimensionInput[]): {
  totalScore: number;
  dimensionResults: ScoreDimensionResult[];
} {
  let total = 0;
  const dimensionResults: ScoreDimensionResult[] = [];

  for (const rubricDim of SCORING_RUBRIC_V1) {
    const input = dimensions.find((d) => d.key === rubricDim.key);
    const raw = input ? Math.min(Math.max(0, input.rawScore), rubricDim.maxScore) : 0;
    const clampedScore = Math.round(raw);
    total += clampedScore;

    dimensionResults.push({
      dimensionKey: rubricDim.key,
      name: rubricDim.name,
      score: clampedScore,
      maxScore: rubricDim.maxScore,
      explanation: input?.explanation || "Evaluation based on market signal rubric.",
      evidenceIds: input?.evidenceIds || [],
      assumptions: input?.assumptions || [],
    });
  }

  return {
    totalScore: Math.min(100, Math.max(0, Math.round(total))),
    dimensionResults,
  };
}
