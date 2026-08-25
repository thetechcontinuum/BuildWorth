"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateDecisionRecommendation = evaluateDecisionRecommendation;
/**
 * Deterministic Decision Recommendation Engine under Rule Rubric v1.0.0.
 * Precedence Order:
 * 1. REJECT: Negative unit economics in base scenario or critical assumption invalidated.
 * 2. WEAK_OPPORTUNITY: Structurally low Opportunity Score (< 55).
 * 3. WATCH: Stale evidence, timing dependency, or missing fresh evidence.
 * 4. VALIDATE_FIRST: Promising opportunity but missing critical buyer demand or WTP evidence.
 * 5. BUILD_CANDIDATE: Every single build gate passed (Verified publication status, 4/4 critical claims, healthy margin, 0 unresolved critical risks).
 */
function evaluateDecisionRecommendation(input) {
    const { opportunityScore, evidenceConfidence, publicationStatus, criticalClaimsCoveredCount, baseScenarioMetrics, risks, assumptions, buyerAccessibilityScore = 8, hasSufficientWtpEvidence = true, } = input;
    const reasonCodes = [];
    const blockingConditions = [];
    // Determine economics status
    const gmStatus = baseScenarioMetrics.grossMarginPercent.status;
    const beStatus = baseScenarioMetrics.breakEvenCustomers.status;
    const isNegativeEconomics = gmStatus === "NEGATIVE_UNIT_ECONOMICS" ||
        beStatus === "NEGATIVE_UNIT_ECONOMICS" ||
        (baseScenarioMetrics.contributionMarginPerCustomerCents.status === "NEGATIVE_UNIT_ECONOMICS");
    const economicsStatus = isNegativeEconomics
        ? "NEGATIVE_UNIT_ECONOMICS"
        : gmStatus === "CALCULATED" && (baseScenarioMetrics.grossMarginPercent.value ?? 0) >= 70
            ? "HEALTHY_HIGH_MARGIN"
            : "MODERATE_MARGIN";
    const feasibilityStatus = "PROVEN_MODERN_STACK";
    // Check Invalidated Critical Assumptions
    const invalidatedCritical = assumptions.filter((a) => a.importanceScore >= 4 && a.status === "INVALIDATED");
    const invalidatedAssumptionIds = invalidatedCritical.map((a) => a.id);
    // Check Unresolved Critical Risks (IDENTIFIED or MITIGATING are unresolved; only RESOLVED and ACCEPTED are permitted)
    const unresolvedCriticalRisks = risks.filter((r) => r.severity === "CRITICAL" && (r.status === "IDENTIFIED" || r.status === "MITIGATING"));
    const criticalRiskIds = unresolvedCriticalRisks.map((r) => r.id);
    // 1. REJECT CONDITIONS
    if (isNegativeEconomics) {
        reasonCodes.push("NEGATIVE_UNIT_ECONOMICS_BASE");
        blockingConditions.push("Variable delivery cost exceeds monthly customer pricing in base scenario");
        return {
            recommendation: "REJECT",
            reasonCodes,
            blockingConditions,
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    if (invalidatedCritical.length > 0) {
        reasonCodes.push("CRITICAL_ASSUMPTION_INVALIDATED");
        blockingConditions.push(`Critical assumption(s) invalidated: ${invalidatedCritical.map((a) => a.statement).join("; ")}`);
        return {
            recommendation: "REJECT",
            reasonCodes,
            blockingConditions,
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    // 2. WEAK OPPORTUNITY (Structurally Low Score)
    if (opportunityScore < 55) {
        reasonCodes.push("STRUCTURALLY_LOW_OPPORTUNITY_SCORE");
        blockingConditions.push(`Opportunity score (${opportunityScore}/100) falls below commercial viability floor`);
        return {
            recommendation: "WEAK_OPPORTUNITY",
            reasonCodes,
            blockingConditions,
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    // 3. EVALUATE BUILD GATES
    if (publicationStatus !== "VERIFIED") {
        blockingConditions.push("Publication quality status is not VERIFIED (currently HYPOTHESIS or EVIDENCE_PENDING)");
    }
    if (criticalClaimsCoveredCount < 4) {
        blockingConditions.push(`Critical market evidence coverage incomplete (${criticalClaimsCoveredCount}/4 verified)`);
    }
    if (evidenceConfidence < 75) {
        blockingConditions.push(`Evidence Confidence (${evidenceConfidence}%) below Build Candidate threshold (75%)`);
    }
    if (opportunityScore < 75) {
        blockingConditions.push(`Opportunity Score (${opportunityScore}/100) below Build Candidate threshold (75)`);
    }
    if (unresolvedCriticalRisks.length > 0) {
        blockingConditions.push(`Unresolved critical risk(s) exist: ${unresolvedCriticalRisks.map((r) => r.description).join("; ")}`);
    }
    if (buyerAccessibilityScore < 6) {
        blockingConditions.push("Buyer accessibility score is below threshold");
    }
    if (!hasSufficientWtpEvidence) {
        blockingConditions.push("Insufficient direct willingness-to-pay evidence");
    }
    // 4. STALE EVIDENCE CHECK
    if (publicationStatus === "STALE") {
        reasonCodes.push("EVIDENCE_REFRESH_REQUIRED");
        blockingConditions.push("Market evidence is stale and requires refreshing prior to capital commitment");
        return {
            recommendation: "WATCH",
            reasonCodes,
            blockingConditions,
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    // 5. BUILD_CANDIDATE (Only if ZERO blocking conditions exist)
    if (blockingConditions.length === 0) {
        reasonCodes.push("ALL_COMMERCIAL_AND_EVIDENCE_GATES_PASSED");
        return {
            recommendation: "BUILD_CANDIDATE",
            reasonCodes,
            blockingConditions: [],
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    // 6. VALIDATE_FIRST vs WATCH
    if (criticalClaimsCoveredCount < 4 || evidenceConfidence < 50 || !hasSufficientWtpEvidence) {
        reasonCodes.push("VALIDATION_REQUIRED_BEFORE_BUILD");
        return {
            recommendation: "VALIDATE_FIRST",
            reasonCodes,
            blockingConditions,
            economicsStatus,
            feasibilityStatus,
            criticalRiskIds,
            invalidatedAssumptionIds,
        };
    }
    reasonCodes.push("MONITOR_TIMING_AND_COMPETITIVE_LANDSCAPE");
    return {
        recommendation: "WATCH",
        reasonCodes,
        blockingConditions,
        economicsStatus,
        feasibilityStatus,
        criticalRiskIds,
        invalidatedAssumptionIds,
    };
}
//# sourceMappingURL=decision-engine.js.map