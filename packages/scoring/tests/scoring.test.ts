import { describe, it, expect } from "vitest";
import {
  evaluateOpportunityScorecard,
  calculateEvidenceConfidence,
  ClaimEvidenceLinkItem,
  EvidenceSignalItem,
} from "../src/index.js";

describe("Scoring Engine Rubric v2.0.0", () => {
  const mockSignal = (overrides: Partial<EvidenceSignalItem> = {}): EvidenceSignalItem => ({
    id: "sig-" + Math.random().toString(36).slice(2, 7),
    sourceName: "Hacker News",
    sourceType: "HACKERNEWS_API",
    sourceFamily: "FORUM",
    credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
    signalType: "PAIN",
    evidenceOrigin: "COLLECTED",
    publishedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
    publishedAtPrecision: "EXACT_TIMESTAMP",
    collectedAt: new Date(),
    language: "en",
    sanitizedExcerpt: "Recurring problem in our CI/CD pipeline",
    problemSummary: "Pipeline screenshot capture burden",
    purchaseIntent: false,
    evidenceQuality: 0.9,
    recencyScore: 1.0,
    credibilityScore: 0.8,
    independenceKey: "hn:story:12345",
    independenceConfidence: 1.0,
    verificationStatus: "VERIFIED",
    verificationMethod: "TRUSTED_API",
    ...overrides,
  });

  const mockLink = (
    claimType: ClaimEvidenceLinkItem["claimType"],
    signal: EvidenceSignalItem,
    relationshipType: "SUPPORTS" | "CONTRADICTS" = "SUPPORTS",
  ): ClaimEvidenceLinkItem => ({
    id: "link-" + Math.random().toString(36).slice(2, 7),
    normalizedSignalId: signal.id,
    signal,
    claimType,
    claimIdentifier: claimType.toLowerCase(),
    claimSnippet: "Claim supported by signal",
    relationshipType,
    supportStrength: "STRONG",
    relevanceScore: 0.95,
  });

  it("calculates 0 confidence when no verified evidence exists", () => {
    const res = calculateEvidenceConfidence({ evidenceLinks: [] });
    expect(res.score).toBe(0);
    expect(res.explanation.weakestEvidenceArea).toContain("No verified evidence");
  });

  it("excludes SYNTHETIC_FIXTURE and LEGACY_UNCLASSIFIED from confidence", () => {
    const syntheticSignal = mockSignal({ evidenceOrigin: "SYNTHETIC_FIXTURE" });
    const legacySignal = mockSignal({ evidenceOrigin: "LEGACY_UNCLASSIFIED" });

    const res = calculateEvidenceConfidence({
      evidenceLinks: [
        mockLink("PAIN_EXISTENCE", syntheticSignal),
        mockLink("BUYER_DEMAND", legacySignal),
      ],
    });

    expect(res.score).toBe(0);
  });

  it("rewards direct buyer intent, multiple independent sources, and key claim coverage", () => {
    const sig1 = mockSignal({
      id: "sig-1",
      sourceFamily: "FORUM",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      independenceKey: "hn:story:101",
      signalType: "PAIN",
    });
    const sig2 = mockSignal({
      id: "sig-2",
      sourceFamily: "CODE_HOST",
      credibilityTier: "TIER_1_PRIMARY",
      independenceKey: "github:issue:202",
      signalType: "BUYER_IDENTITY" as any,
    });
    const sig3 = mockSignal({
      id: "sig-3",
      sourceFamily: "COMMUNITY",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      independenceKey: "reddit:post:303",
      signalType: "WILLINGNESS_TO_PAY",
      purchaseIntent: true,
      spendingSignal: "$199/mo",
    });
    const sig4 = mockSignal({
      id: "sig-4",
      sourceFamily: "PROCUREMENT",
      credibilityTier: "TIER_1_PRIMARY",
      independenceKey: "procure:rfp:404",
      signalType: "PURCHASE_INTENT",
      purchaseIntent: true,
      spendingSignal: "$15k annual",
    });

    const links = [
      mockLink("PAIN_EXISTENCE", sig1),
      mockLink("BUYER_IDENTITY", sig2),
      mockLink("BUYER_DEMAND", sig3),
      mockLink("WILLINGNESS_TO_PAY", sig4),
      mockLink("TECHNICAL_FEASIBILITY", sig2),
    ];

    const res = calculateEvidenceConfidence({ evidenceLinks: links });
    expect(res.score).toBeGreaterThanOrEqual(70);
    expect(res.explanation.positiveComponents.directBuyerIntentScore).toBeGreaterThanOrEqual(10);
    expect(res.explanation.positiveComponents.claimCoverageScore).toBeGreaterThanOrEqual(12);
  });

  it("applies contradiction penalty for contradictory evidence", () => {
    const sigSupport = mockSignal({
      id: "sig-sup-1",
      independenceKey: "group:1",
      signalType: "PAIN",
    });
    const sigContra = mockSignal({
      id: "sig-con-1",
      independenceKey: "group:2",
      signalType: "CONTRADICTING_EVIDENCE",
      sanitizedExcerpt: "We built an internal script in 1 hour and would never pay for SaaS",
    });

    const supportingLinks = [
      mockLink("PAIN_EXISTENCE", sigSupport, "SUPPORTS"),
      mockLink("BUYER_DEMAND", sigSupport, "SUPPORTS"),
    ];

    const mixedLinks = [
      ...supportingLinks,
      mockLink("WILLINGNESS_TO_PAY", sigContra, "CONTRADICTS"),
    ];

    const supportOnlyRes = calculateEvidenceConfidence({ evidenceLinks: supportingLinks });
    const mixedRes = calculateEvidenceConfidence({ evidenceLinks: mixedLinks });

    expect(mixedRes.explanation.contradictionPenalty).toBeGreaterThan(0);
    expect(mixedRes.score).toBeLessThan(supportOnlyRes.score);
  });

  it("applies penalty for unknown publication dates", () => {
    const knownDateSignal = mockSignal({
      id: "sig-known",
      publishedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      publishedAtPrecision: "EXACT_TIMESTAMP",
    });

    const unknownDateSignal = mockSignal({
      id: "sig-unknown",
      publishedAt: null,
      publishedAtPrecision: "UNKNOWN",
    });

    const knownRes = calculateEvidenceConfidence({
      evidenceLinks: [mockLink("PAIN_EXISTENCE", knownDateSignal)],
    });
    const unknownRes = calculateEvidenceConfidence({
      evidenceLinks: [mockLink("PAIN_EXISTENCE", unknownDateSignal)],
    });

    expect(knownRes.explanation.positiveComponents.recencyScore).toBeGreaterThan(
      unknownRes.explanation.positiveComponents.recencyScore,
    );
  });
});
