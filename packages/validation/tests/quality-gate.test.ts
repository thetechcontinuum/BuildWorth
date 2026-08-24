import { describe, it, expect } from "vitest";
import { evaluatePublicationQuality, DEFAULT_QUALITY_GATE_CONFIG } from "../src/quality-gate.js";
import { ClaimEvidenceLinkItem, EvidenceSignalItem } from "@buildworth/shared";

describe("Publication Quality Gate", () => {
  const mockSignal = (overrides: Partial<EvidenceSignalItem> = {}): EvidenceSignalItem => ({
    id: "sig-" + Math.random().toString(36).slice(2, 7),
    sourceFamily: "FORUM",
    signalType: "PAIN",
    evidenceOrigin: "COLLECTED",
    publishedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
    publishedAtPrecision: "EXACT_TIMESTAMP",
    collectedAt: new Date(),
    language: "en",
    sanitizedExcerpt: "High frequency pain",
    problemSummary: "Problem summary",
    purchaseIntent: false,
    evidenceQuality: 0.9,
    recencyScore: 1.0,
    credibilityScore: 0.8,
    independenceKey: "group:1",
    independenceConfidence: 1.0,
    verificationStatus: "VERIFIED",
    ...overrides,
  });

  const mockLink = (
    claimType: ClaimEvidenceLinkItem["claimType"],
    signal: EvidenceSignalItem,
  ): ClaimEvidenceLinkItem => ({
    id: "link-" + Math.random().toString(36).slice(2, 7),
    normalizedSignalId: signal.id,
    signal,
    claimType,
    claimIdentifier: claimType.toLowerCase(),
    claimSnippet: "Snippet",
    relationshipType: "SUPPORTS",
    supportStrength: "STRONG",
    relevanceScore: 1.0,
  });

  it("classifies opportunities with no evidence as HYPOTHESIS", () => {
    const res = evaluatePublicationQuality([], 0);
    expect(res.status).toBe("HYPOTHESIS");
    expect(res.isEligibleForVerified).toBe(false);
  });

  it("blocks SYNTHETIC_FIXTURE from achieving VERIFIED status", () => {
    const syntheticSignal = mockSignal({
      evidenceOrigin: "SYNTHETIC_FIXTURE",
      verificationStatus: "VERIFIED",
    });

    const links = [
      mockLink("PAIN_EXISTENCE", syntheticSignal),
      mockLink("BUYER_IDENTITY", syntheticSignal),
      mockLink("BUYER_DEMAND", syntheticSignal),
      mockLink("WILLINGNESS_TO_PAY", syntheticSignal),
    ];

    const res = evaluatePublicationQuality(links, 85);
    expect(res.status).toBe("HYPOTHESIS");
    expect(res.isEligibleForVerified).toBe(false);
    expect(res.blockers.some((b) => b.includes("SYNTHETIC_FIXTURE"))).toBe(true);
  });

  it("classifies opportunities meeting all criteria as VERIFIED", () => {
    const sig1 = mockSignal({
      id: "s1",
      sourceFamily: "FORUM",
      independenceKey: "k1",
      signalType: "PAIN",
    });
    const sig2 = mockSignal({
      id: "s2",
      sourceFamily: "CODE_HOST",
      independenceKey: "k2",
      signalType: "FEATURE_REQUEST",
    });
    const sig3 = mockSignal({
      id: "s3",
      sourceFamily: "COMMUNITY",
      independenceKey: "k3",
      signalType: "PURCHASE_INTENT",
      purchaseIntent: true,
    });
    const sig4 = mockSignal({
      id: "s4",
      sourceFamily: "COMMUNITY",
      independenceKey: "k4",
      signalType: "WILLINGNESS_TO_PAY",
    });
    const sig5 = mockSignal({
      id: "s5",
      sourceFamily: "FORUM",
      independenceKey: "k5",
      signalType: "COMPETITOR_COMPLAINT",
    });

    const links = [
      mockLink("PAIN_EXISTENCE", sig1),
      mockLink("BUYER_IDENTITY", sig2),
      mockLink("BUYER_DEMAND", sig3),
      mockLink("WILLINGNESS_TO_PAY", sig4),
      mockLink("COMPETITOR_GAP", sig5),
    ];

    const res = evaluatePublicationQuality(links, 75);
    expect(res.status).toBe("VERIFIED");
    expect(res.isEligibleForVerified).toBe(true);
    expect(res.blockers.length).toBe(0);
  });

  it("flags STALE status when >60% of evidence is older than threshold", () => {
    const staleSignal = mockSignal({
      publishedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000), // > 365 days
    });

    const links = [
      mockLink("PAIN_EXISTENCE", staleSignal),
      mockLink("BUYER_IDENTITY", staleSignal),
    ];

    const res = evaluatePublicationQuality(links, 60);
    expect(res.status).toBe("STALE");
  });
});
