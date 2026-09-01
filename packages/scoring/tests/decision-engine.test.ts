import { describe, it, expect } from "vitest";
import { evaluateDecisionRecommendation } from "../src/decision-engine.js";
import { calculateScenarioMetrics } from "../src/economics/calculator.js";

describe("Deterministic Decision Recommendation Engine v1.0.0", () => {
  const healthyMetrics = calculateScenarioMetrics({
    scenarioType: "BASE",
    currency: "USD",
    activeCustomers: 50,
    monthlyPriceCents: 19900,
    onboardingPriceCents: 0,
    variableCostPerCustomerCents: 1500,
    monthlyFixedCostCents: 200000,
    customerAcquisitionCostCents: 45000,
    deliveryTimeWeeks: 6,
  });

  it("produces BUILD_CANDIDATE when all build gates and evidence requirements pass", () => {
    const res = evaluateDecisionRecommendation({
      opportunityScore: 88,
      evidenceConfidence: 84,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
      buyerAccessibilityScore: 8,
      hasSufficientWtpEvidence: true,
    });

    expect(res.recommendation).toBe("BUILD_CANDIDATE");
    expect(res.blockingConditions).toHaveLength(0);
  });

  it("strictly produces REJECT when base scenario has negative unit economics", () => {
    const negativeMetrics = calculateScenarioMetrics({
      scenarioType: "BASE",
      currency: "USD",
      activeCustomers: 20,
      monthlyPriceCents: 2000,
      onboardingPriceCents: 0,
      variableCostPerCustomerCents: 4000, // Negative unit economics
      monthlyFixedCostCents: 100000,
      customerAcquisitionCostCents: 10000,
      deliveryTimeWeeks: 4,
    });

    const res = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 85,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: negativeMetrics,
      risks: [],
      assumptions: [],
    });

    expect(res.recommendation).toBe("REJECT");
    expect(res.reasonCodes).toContain("NEGATIVE_UNIT_ECONOMICS_BASE");
  });

  it("strictly produces REJECT when a critical assumption is INVALIDATED", () => {
    const res = evaluateDecisionRecommendation({
      opportunityScore: 85,
      evidenceConfidence: 80,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [
        {
          id: "as-1",
          statement: "Buyers have corporate credit card spend authority up to $200/mo",
          category: "WILLINGNESS_TO_PAY",
          importanceScore: 5,
          uncertaintyScore: 1,
          testMethod: "Discovery calls",
          successThreshold: ">50%",
          failureThreshold: "<20%",
          status: "INVALIDATED",
          evidenceLinkIds: [],
          provenanceType: "ASSUMPTION",
        },
      ],
    });

    expect(res.recommendation).toBe("REJECT");
    expect(res.reasonCodes).toContain("CRITICAL_ASSUMPTION_INVALIDATED");
  });

  it("never outputs BUILD_CANDIDATE for HYPOTHESIS status and requires VALIDATE_FIRST", () => {
    const res = evaluateDecisionRecommendation({
      opportunityScore: 82,
      evidenceConfidence: 0,
      publicationStatus: "HYPOTHESIS",
      criticalClaimsCoveredCount: 0,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
    });

    expect(res.recommendation).toBe("VALIDATE_FIRST");
    expect(res.blockingConditions.length).toBeGreaterThan(0);
  });

  it("produces WATCH with EVIDENCE_REFRESH_REQUIRED when publication status is STALE", () => {
    const res = evaluateDecisionRecommendation({
      opportunityScore: 80,
      evidenceConfidence: 75,
      publicationStatus: "STALE",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
    });

    expect(res.recommendation).toBe("WATCH");
    expect(res.reasonCodes).toContain("EVIDENCE_REFRESH_REQUIRED");
  });

  it("blocks BUILD_CANDIDATE when any single mandatory gate is missing", () => {
    // 1. Missing publication status (HYPOTHESIS)
    const res1 = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 90,
      publicationStatus: "HYPOTHESIS",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
    });
    expect(res1.recommendation).not.toBe("BUILD_CANDIDATE");
    expect(res1.blockingConditions.some((c) => c.includes("Publication quality status"))).toBe(
      true,
    );

    // 2. Missing critical claim coverage (<4)
    const res2 = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 90,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 3, // only 3
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
    });
    expect(res2.recommendation).not.toBe("BUILD_CANDIDATE");
    expect(res2.blockingConditions.some((c) => c.includes("coverage incomplete"))).toBe(true);

    // 3. Unresolved critical risk (IDENTIFIED or MITIGATING)
    const res3 = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 90,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [
        {
          id: "r-crit",
          category: "SECURITY",
          description: "Cloud API policy lock-out",
          probabilityScore: 4,
          impactScore: 5,
          severity: "CRITICAL",
          mitigationStrategy: "Negotiate enterprise partner tier",
          status: "IDENTIFIED", // Unresolved!
          evidenceLinkIds: [],
          provenanceType: "MODEL_ESTIMATE",
        },
      ],
      assumptions: [],
    });
    expect(res3.recommendation).not.toBe("BUILD_CANDIDATE");
    expect(res3.blockingConditions.some((c) => c.includes("Unresolved critical risk"))).toBe(true);

    // 4. Low buyer accessibility (<6)
    const res4 = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 90,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
      buyerAccessibilityScore: 4, // low
    });
    expect(res4.recommendation).not.toBe("BUILD_CANDIDATE");
    expect(res4.blockingConditions.some((c) => c.includes("Buyer accessibility"))).toBe(true);

    // 5. Missing WTP evidence
    const res5 = evaluateDecisionRecommendation({
      opportunityScore: 90,
      evidenceConfidence: 90,
      publicationStatus: "VERIFIED",
      criticalClaimsCoveredCount: 4,
      baseScenarioMetrics: healthyMetrics,
      risks: [],
      assumptions: [],
      hasSufficientWtpEvidence: false,
    });
    expect(res5.recommendation).not.toBe("BUILD_CANDIDATE");
    expect(res5.blockingConditions.some((c) => c.includes("willingness-to-pay"))).toBe(true);
  });
});
