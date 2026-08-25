import { ScoringDimensionInput, ConfidenceInput } from "./types.js";
import { ScoreDimensionResult, ScorecardResult } from "@buildworth/shared";
export declare const SCORING_RUBRIC_V1: readonly [{
    readonly key: "pain_evidence";
    readonly name: "Pain Evidence";
    readonly maxScore: 15;
}, {
    readonly key: "buyer_demand_wtp";
    readonly name: "Buyer Demand & Willingness to Pay";
    readonly maxScore: 15;
}, {
    readonly key: "technical_feasibility";
    readonly name: "Technical Feasibility";
    readonly maxScore: 15;
}, {
    readonly key: "economics";
    readonly name: "Cost-Benefit Economics";
    readonly maxScore: 15;
}, {
    readonly key: "market_attractiveness";
    readonly name: "Market Attractiveness";
    readonly maxScore: 10;
}, {
    readonly key: "buyer_accessibility";
    readonly name: "Buyer Accessibility";
    readonly maxScore: 10;
}, {
    readonly key: "competition_differentiation";
    readonly name: "Competition & Differentiation";
    readonly maxScore: 10;
}, {
    readonly key: "speed_to_validation";
    readonly name: "Speed to Validation";
    readonly maxScore: 5;
}, {
    readonly key: "defensibility";
    readonly name: "Defensibility";
    readonly maxScore: 5;
}];
/**
 * Calculates the Opportunity Score strictly summing to max 100 whole points.
 */
export declare function calculateOpportunityScore(dimensions: ScoringDimensionInput[]): {
    totalScore: number;
    dimensionResults: ScoreDimensionResult[];
};
/**
 * Complete evaluation of scorecard combining 9-dimension opportunity score and deterministic evidence confidence.
 */
export declare function evaluateOpportunityScorecard(dimensions: ScoringDimensionInput[], confidenceInput: ConfidenceInput): ScorecardResult;
//# sourceMappingURL=opportunity-score.d.ts.map