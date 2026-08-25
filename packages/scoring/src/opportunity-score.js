"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORING_RUBRIC_V1 = void 0;
exports.calculateOpportunityScore = calculateOpportunityScore;
exports.evaluateOpportunityScorecard = evaluateOpportunityScorecard;
const confidence_score_js_1 = require("./confidence-score.js");
const subscores_js_1 = require("./subscores.js");
exports.SCORING_RUBRIC_V1 = [
    { key: "pain_evidence", name: "Pain Evidence", maxScore: 15 },
    { key: "buyer_demand_wtp", name: "Buyer Demand & Willingness to Pay", maxScore: 15 },
    { key: "technical_feasibility", name: "Technical Feasibility", maxScore: 15 },
    { key: "economics", name: "Cost-Benefit Economics", maxScore: 15 },
    { key: "market_attractiveness", name: "Market Attractiveness", maxScore: 10 },
    { key: "buyer_accessibility", name: "Buyer Accessibility", maxScore: 10 },
    { key: "competition_differentiation", name: "Competition & Differentiation", maxScore: 10 },
    { key: "speed_to_validation", name: "Speed to Validation", maxScore: 5 },
    { key: "defensibility", name: "Defensibility", maxScore: 5 },
];
/**
 * Calculates the Opportunity Score strictly summing to max 100 whole points.
 */
function calculateOpportunityScore(dimensions) {
    let total = 0;
    const dimensionResults = [];
    for (const rubricDim of exports.SCORING_RUBRIC_V1) {
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
/**
 * Complete evaluation of scorecard combining 9-dimension opportunity score and deterministic evidence confidence.
 */
function evaluateOpportunityScorecard(dimensions, confidenceInput) {
    const { totalScore, dimensionResults } = calculateOpportunityScore(dimensions);
    const confidenceResult = (0, confidence_score_js_1.calculateEvidenceConfidence)(confidenceInput);
    const subscores = (0, subscores_js_1.calculateNormalizedSubscores)(dimensionResults);
    const isHypothesisOnly = confidenceResult.score < 50;
    return {
        opportunityScore: totalScore,
        evidenceConfidenceScore: confidenceResult.score,
        isHypothesisOnly,
        dimensions: dimensionResults,
        rubricVersion: "2.0.0",
        calculatedAt: new Date().toISOString(),
        ...subscores,
    };
}
//# sourceMappingURL=opportunity-score.js.map