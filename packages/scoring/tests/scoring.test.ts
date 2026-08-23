import { describe, it, expect } from "vitest";
import { evaluateOpportunityScorecard, calculateEvidenceConfidence } from "../src/index.js";

describe("Scoring Engine", () => {
  it("calculates 100-point opportunity score accurately", () => {
    const dimensionInputs = [
      {
        key: "pain_evidence",
        name: "Pain Evidence",
        maxScore: 15,
        rawScore: 14,
        explanation: "High pain",
        evidenceIds: ["ev-1"],
        assumptions: [],
      },
      {
        key: "buyer_demand_wtp",
        name: "Buyer Demand",
        maxScore: 15,
        rawScore: 13,
        explanation: "Active WTP",
        evidenceIds: ["ev-2"],
        assumptions: [],
      },
      {
        key: "technical_feasibility",
        name: "Feasibility",
        maxScore: 15,
        rawScore: 15,
        explanation: "Standard Next.js stack",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "economics",
        name: "Economics",
        maxScore: 15,
        rawScore: 14,
        explanation: "90% gross margin",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "market_attractiveness",
        name: "Market",
        maxScore: 10,
        rawScore: 9,
        explanation: "Growing market",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "buyer_accessibility",
        name: "Accessibility",
        maxScore: 10,
        rawScore: 8,
        explanation: "DevOps communities",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "competition_differentiation",
        name: "Competition",
        maxScore: 10,
        rawScore: 8,
        explanation: "Clear differentiation",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "speed_to_validation",
        name: "Speed",
        maxScore: 5,
        rawScore: 5,
        explanation: "14-day test",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "defensibility",
        name: "Defensibility",
        maxScore: 5,
        rawScore: 4,
        explanation: "Workflow lock-in",
        evidenceIds: [],
        assumptions: [],
      },
    ];

    const confidenceSignals = [
      {
        id: "sig-1",
        sourceType: "GITHUB",
        sourceCredibilityWeight: 0.9,
        isDirectBuyerIntent: true,
        publishedAt: new Date(),
        extractedUserCount: 15,
      },
      {
        id: "sig-2",
        sourceType: "REDDIT",
        sourceCredibilityWeight: 0.8,
        isDirectBuyerIntent: true,
        publishedAt: new Date(),
        extractedUserCount: 12,
      },
      {
        id: "sig-3",
        sourceType: "HACKERNEWS",
        sourceCredibilityWeight: 0.85,
        isDirectBuyerIntent: false,
        publishedAt: new Date(),
        extractedUserCount: 8,
      },
      {
        id: "sig-4",
        sourceType: "PRODUCTHUNT",
        sourceCredibilityWeight: 0.75,
        isDirectBuyerIntent: true,
        publishedAt: new Date(),
        extractedUserCount: 20,
      },
    ];

    const result = evaluateOpportunityScorecard(dimensionInputs, { signals: confidenceSignals });

    expect(result.opportunityScore).toBe(90);
    expect(result.evidenceConfidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.isHypothesisOnly).toBe(false);
    expect(result.demandScore).toBe(90);
    expect(result.feasibilityScore).toBe(100);
  });

  it("flags high opportunity score with low confidence as hypothesis only", () => {
    const dimensionInputs = [
      {
        key: "pain_evidence",
        name: "Pain Evidence",
        maxScore: 15,
        rawScore: 15,
        explanation: "High pain",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "buyer_demand_wtp",
        name: "Buyer Demand",
        maxScore: 15,
        rawScore: 15,
        explanation: "High demand",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "technical_feasibility",
        name: "Feasibility",
        maxScore: 15,
        rawScore: 15,
        explanation: "",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "economics",
        name: "Economics",
        maxScore: 15,
        rawScore: 15,
        explanation: "",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "market_attractiveness",
        name: "Market",
        maxScore: 10,
        rawScore: 10,
        explanation: "",
        evidenceIds: [],
        assumptions: [],
      },
      {
        key: "buyer_accessibility",
        name: "Accessibility",
        maxScore: 10,
        rawScore: 10,
        explanation: "",
        evidenceIds: [],
        assumptions: [],
      },
    ];

    // Only 1 anonymous weak signal
    const weakSignals = [
      {
        id: "sig-weak",
        sourceType: "ANONYMOUS",
        sourceCredibilityWeight: 0.2,
        isDirectBuyerIntent: false,
        publishedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000),
        extractedUserCount: 1,
      },
    ];

    const result = evaluateOpportunityScorecard(dimensionInputs, { signals: weakSignals });
    expect(result.opportunityScore).toBeGreaterThanOrEqual(70);
    expect(result.evidenceConfidenceScore).toBeLessThan(50);
    expect(result.isHypothesisOnly).toBe(true);
  });
});
