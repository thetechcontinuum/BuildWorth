"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENCE_RUBRIC_VERSION = void 0;
exports.calculateEvidenceConfidence = calculateEvidenceConfidence;
exports.CONFIDENCE_RUBRIC_VERSION = "2.0.0";
const CRITICAL_CLAIMS = [
    "PAIN_EXISTENCE",
    "BUYER_IDENTITY",
    "BUYER_DEMAND",
    "WILLINGNESS_TO_PAY",
];
const ALL_CLAIMS = [
    "PAIN_EXISTENCE",
    "PAIN_SEVERITY",
    "PAIN_FREQUENCY",
    "CURRENT_WORKAROUND",
    "BUYER_IDENTITY",
    "BUYER_DEMAND",
    "WILLINGNESS_TO_PAY",
    "MARKET_ATTRACTIVENESS",
    "COMPETITOR_GAP",
    "TECHNICAL_FEASIBILITY",
    "MVP_COST",
    "CUSTOMER_BENEFIT",
    "PLAUSIBLE_PRICING",
    "GO_TO_MARKET_ACCESSIBILITY",
];
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
function calculateEvidenceConfidence(input) {
    const { evidenceLinks = [], now = new Date() } = input;
    // Filter for genuine verified signals (exclude SYNTHETIC_FIXTURE and LEGACY_UNCLASSIFIED)
    const validLinks = evidenceLinks.filter((link) => {
        const s = link.signal;
        if (!s)
            return false;
        return (s.verificationStatus === "VERIFIED" &&
            s.evidenceOrigin !== "SYNTHETIC_FIXTURE" &&
            s.evidenceOrigin !== "LEGACY_UNCLASSIFIED");
    });
    if (validLinks.length === 0) {
        return {
            score: 0,
            explanation: {
                rubricVersion: exports.CONFIDENCE_RUBRIC_VERSION,
                score: 0,
                positiveComponents: {
                    evidenceVolumeScore: 0,
                    sourceDiversityScore: 0,
                    familyDiversityScore: 0,
                    sourceCredibilityScore: 0,
                    directBuyerIntentScore: 0,
                    recencyScore: 0,
                    claimCoverageScore: 0,
                },
                contradictionPenalty: 0,
                strongestEvidenceArea: "None",
                weakestEvidenceArea: "No verified evidence available",
                missingEvidenceAreas: [...ALL_CLAIMS],
                contradictoryEvidenceNotes: [],
                recalculatedAt: now,
            },
        };
    }
    // Deduplicate signals by independenceKey
    const signalMap = new Map();
    for (const l of validLinks) {
        if (l.signal && !signalMap.has(l.signal.id)) {
            signalMap.set(l.signal.id, l.signal);
        }
    }
    const uniqueSignals = Array.from(signalMap.values());
    // 1. Verified Evidence Volume (Max 15)
    // Scaling: 1 signal -> 4pts, 5 signals -> 10pts, 15+ signals -> 15pts
    const nVerified = uniqueSignals.length;
    const evidenceVolumeScore = Math.min(15, Math.round(15 * (Math.log(1 + nVerified) / Math.log(1 + 15))));
    // 2. Independent Source Diversity (Max 15)
    // Group by independenceKey
    const uniqueSourceGroups = new Set(uniqueSignals.map((s) => s.independenceKey || `id:${s.id}`));
    const nGroups = uniqueSourceGroups.size;
    const sourceDiversityScore = Math.min(15, Math.round(nGroups * 3.75)); // 4 groups -> 15pts
    // 3. Source-Family Diversity (Max 10)
    const uniqueFamilies = new Set(uniqueSignals.map((s) => s.sourceFamily || "COMMUNITY").filter(Boolean));
    const nFamilies = uniqueFamilies.size;
    const familyDiversityScore = nFamilies >= 3 ? 10 : nFamilies === 2 ? 7 : 3;
    // 4. Source Credibility Tier Distribution (Max 15)
    // Tier 1 = 1.0, Tier 2 = 0.75, Tier 3 = 0.40
    let totalCredibilityWeight = 0;
    for (const s of uniqueSignals) {
        if (s.credibilityTier === "TIER_1_PRIMARY") {
            totalCredibilityWeight += 1.0;
        }
        else if (s.credibilityTier === "TIER_2_CREDIBLE_PUBLIC") {
            totalCredibilityWeight += 0.75;
        }
        else if (s.credibilityTier === "TIER_3_SECONDARY") {
            totalCredibilityWeight += 0.4;
        }
        else {
            totalCredibilityWeight += 0.5;
        }
    }
    const avgCredibility = totalCredibilityWeight / uniqueSignals.length;
    const sourceCredibilityScore = Math.min(15, Math.round(15 * avgCredibility));
    // 5. Direct Buyer Intent Evidence (Max 15)
    // Must be verified and explicitly typed as PURCHASE_INTENT, WILLINGNESS_TO_PAY, or PROCUREMENT
    const buyerIntentSignals = uniqueSignals.filter((s) => s.signalType === "PURCHASE_INTENT" ||
        s.signalType === "WILLINGNESS_TO_PAY" ||
        s.signalType === "PROCUREMENT" ||
        (s.purchaseIntent === true && Boolean(s.spendingSignal)));
    const directBuyerIntentScore = Math.min(15, buyerIntentSignals.length * 5); // 3 signals -> 15pts
    // 6. Evidence Recency (Max 10)
    // Weighted average recency with fallback penalty for unknown dates
    let totalRecencyWeight = 0;
    for (const s of uniqueSignals) {
        if (!s.publishedAt || s.publishedAtPrecision === "UNKNOWN") {
            totalRecencyWeight += 0.3; // 70% penalty for unknown pub date
        }
        else {
            const pubDate = new Date(s.publishedAt);
            const ageDays = Math.max(0, (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
            if (ageDays <= 90)
                totalRecencyWeight += 1.0;
            else if (ageDays <= 180)
                totalRecencyWeight += 0.75;
            else if (ageDays <= 365)
                totalRecencyWeight += 0.4;
            else
                totalRecencyWeight += 0.15;
        }
    }
    const avgRecency = totalRecencyWeight / uniqueSignals.length;
    const recencyScore = Math.min(10, Math.round(10 * avgRecency));
    // 7. Key-Claim Coverage (Max 20)
    // 4 Critical claims: 3pts each (max 12)
    // Remaining 10 secondary claims: 0.8pts each (max 8)
    const coveredSupportingClaims = new Set();
    for (const l of validLinks) {
        if (l.relationshipType === "SUPPORTS") {
            coveredSupportingClaims.add(l.claimType);
        }
    }
    let criticalClaimScore = 0;
    for (const c of CRITICAL_CLAIMS) {
        if (coveredSupportingClaims.has(c)) {
            criticalClaimScore += 3;
        }
    }
    let secondaryClaimScore = 0;
    for (const c of ALL_CLAIMS) {
        if (!CRITICAL_CLAIMS.includes(c) && coveredSupportingClaims.has(c)) {
            secondaryClaimScore += 0.8;
        }
    }
    const claimCoverageScore = Math.min(20, Math.round(criticalClaimScore + secondaryClaimScore));
    const totalPositive = evidenceVolumeScore +
        sourceDiversityScore +
        familyDiversityScore +
        sourceCredibilityScore +
        directBuyerIntentScore +
        recencyScore +
        claimCoverageScore;
    // Contradiction Penalty (Max 20 pts deduction)
    // Evaluated on deduplicated independent evidence groups
    const supportingLinks = validLinks.filter((l) => l.relationshipType === "SUPPORTS");
    const contradictingLinks = validLinks.filter((l) => l.relationshipType === "CONTRADICTS");
    const contradictingGroups = new Set(contradictingLinks.map((l) => l.signal?.independenceKey || `id:${l.normalizedSignalId}`));
    const supportingGroups = new Set(supportingLinks.map((l) => l.signal?.independenceKey || `id:${l.normalizedSignalId}`));
    const totalGroups = supportingGroups.size + contradictingGroups.size;
    let contradictionPenalty = 0;
    if (totalGroups > 0 && contradictingGroups.size > 0) {
        const contradictionRatio = contradictingGroups.size / totalGroups;
        contradictionPenalty = Math.min(20, Math.round(20 * contradictionRatio));
    }
    const finalScore = Math.min(100, Math.max(0, totalPositive - contradictionPenalty));
    // Explanatory areas
    const missingClaims = ALL_CLAIMS.filter((c) => !coveredSupportingClaims.has(c));
    let strongestArea = "General Problem Space";
    if (buyerIntentSignals.length >= 2)
        strongestArea = "Direct Buyer Intent & WTP";
    else if (coveredSupportingClaims.has("PAIN_EXISTENCE") &&
        coveredSupportingClaims.has("PAIN_SEVERITY"))
        strongestArea = "Pain & Problem Severity";
    let weakestArea = "Claim Coverage";
    if (missingClaims.some((c) => CRITICAL_CLAIMS.includes(c))) {
        weakestArea = `Missing Critical Claims: ${missingClaims.filter((c) => CRITICAL_CLAIMS.includes(c)).join(", ")}`;
    }
    else if (contradictingGroups.size > 0) {
        weakestArea = `Contradictory market signals (${contradictingGroups.size} sources)`;
    }
    const contradictionNotes = contradictingLinks.map((l) => l.explanation || `Contradicts ${l.claimType} with ${l.supportStrength} strength`);
    return {
        score: finalScore,
        explanation: {
            rubricVersion: exports.CONFIDENCE_RUBRIC_VERSION,
            score: finalScore,
            positiveComponents: {
                evidenceVolumeScore,
                sourceDiversityScore,
                familyDiversityScore,
                sourceCredibilityScore,
                directBuyerIntentScore,
                recencyScore,
                claimCoverageScore,
            },
            contradictionPenalty,
            strongestEvidenceArea: strongestArea,
            weakestEvidenceArea: weakestArea,
            missingEvidenceAreas: missingClaims,
            contradictoryEvidenceNotes: contradictionNotes,
            recalculatedAt: now,
        },
    };
}
//# sourceMappingURL=confidence-score.js.map