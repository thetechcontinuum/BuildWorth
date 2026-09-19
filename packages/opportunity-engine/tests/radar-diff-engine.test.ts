import { describe, it, expect } from "vitest";
import { computeOpportunityRevisionDiff } from "../src/radar/diff-engine.js";
import { computeCanonicalDiffHash, canonicalizeSnapshot } from "../src/radar/canonical-input.js";
import { AuthoritativeRevisionSnapshot } from "../src/radar/types.js";

function createBaseSnapshot(
  overrides: Partial<AuthoritativeRevisionSnapshot> = {},
): AuthoritativeRevisionSnapshot {
  return {
    id: "rev-base-1",
    revisionNumber: 1,
    opportunityId: "opp-123",
    publicationQualityStatus: "HYPOTHESIS",
    evidenceConfidenceScore: 70,
    opportunityScore: 75,
    decisionRecommendation: "VALIDATE_FIRST",
    decisionReasonCodes: ["NEEDS_PRIMARY_EVIDENCE"],
    pricing: {
      baseMonthlyPriceCents: 4900,
      currency: "USD",
    },
    mvpCost: {
      minBuildMinorCents: 100000,
      maxBuildMinorCents: 200000,
      baseBuildMinorCents: 150000,
    },
    deliveryTimeWeeks: {
      minWeeks: 4,
      maxWeeks: 8,
      baseWeeks: 6,
    },
    competitors: [
      { name: "Acme Corp", competitorType: "DIRECT", knownPricing: "$50/mo" },
      { name: "Beta LLC", competitorType: "INDIRECT", knownPricing: null },
    ],
    risks: [
      {
        id: "r1",
        category: "MARKET",
        severity: "MEDIUM",
        status: "IDENTIFIED",
        description: "Long sales cycle",
      },
    ],
    evidenceSignals: [
      {
        id: "sig-1",
        signalType: "PAIN",
        purchaseIntent: false,
        spendingSignal: null,
        verificationStatus: "VERIFIED",
      },
    ],
    ...overrides,
  };
}

describe("Phase 4C Deterministic Radar Diff Engine", () => {
  it("produces zero changes and identical canonical hash for identical revisions", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", revisionNumber: 1 });
    const snap2 = createBaseSnapshot({ id: "rev-2", revisionNumber: 2 });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    expect(diff.items.length).toBe(0);
    expect(diff.overallSeverity).toBe("LOW");
    expect(diff.canonicalInputHash).toBeDefined();

    const hash1 = computeCanonicalDiffHash(snap1, snap2);
    const hash2 = computeCanonicalDiffHash(snap1, snap2);
    expect(hash1).toBe(hash2);
  });

  it("detects publication status change from HYPOTHESIS to VERIFIED (HIGH severity, POSITIVE direction)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", publicationQualityStatus: "HYPOTHESIS" });
    const snap2 = createBaseSnapshot({ id: "rev-2", publicationQualityStatus: "VERIFIED" });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "PUBLICATION_STATUS");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("HIGH");
    expect(item?.direction).toBe("POSITIVE");
    expect(item?.reasonCode).toBe("STATUS_CHANGED_VERIFIED");
  });

  it("detects publication status change from VERIFIED to STALE (CRITICAL severity, NEGATIVE direction)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", publicationQualityStatus: "VERIFIED" });
    const snap2 = createBaseSnapshot({ id: "rev-2", publicationQualityStatus: "STALE" });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "PUBLICATION_STATUS");
    expect(item?.severity).toBe("CRITICAL");
    expect(item?.direction).toBe("NEGATIVE");
  });

  it("detects evidence confidence score deltas (>= 5 points triggers event)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", evidenceConfidenceScore: 68 });
    const snap2 = createBaseSnapshot({ id: "rev-2", evidenceConfidenceScore: 84 }); // +16 delta -> HIGH severity

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "EVIDENCE_CONFIDENCE");
    expect(item?.severity).toBe("HIGH");
    expect(item?.direction).toBe("POSITIVE");
    expect(item?.numericDelta).toBe(16);
  });

  it("detects decision recommendation transition (VALIDATE_FIRST -> BUILD_CANDIDATE)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", decisionRecommendation: "VALIDATE_FIRST" });
    const snap2 = createBaseSnapshot({ id: "rev-2", decisionRecommendation: "BUILD_CANDIDATE" });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "DECISION_RECOMMENDATION");
    expect(item?.severity).toBe("HIGH");
    expect(item?.direction).toBe("POSITIVE");
    expect(item?.reasonCode).toBe("DECISION_BUILD_CANDIDATE");
  });

  it("detects decision recommendation demotion to REJECT (CRITICAL severity, NEGATIVE direction)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", decisionRecommendation: "BUILD_CANDIDATE" });
    const snap2 = createBaseSnapshot({ id: "rev-2", decisionRecommendation: "REJECT" });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "DECISION_RECOMMENDATION");
    expect(item?.severity).toBe("CRITICAL");
    expect(item?.direction).toBe("NEGATIVE");
  });

  it("detects newly verified willingness-to-pay signals (HIGH severity, POSITIVE direction)", () => {
    const snap1 = createBaseSnapshot({
      id: "rev-1",
      evidenceSignals: [
        { id: "sig-1", signalType: "PAIN", purchaseIntent: false, verificationStatus: "VERIFIED" },
      ],
    });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      evidenceSignals: [
        { id: "sig-1", signalType: "PAIN", purchaseIntent: false, verificationStatus: "VERIFIED" },
        {
          id: "sig-2",
          signalType: "WILLINGNESS_TO_PAY",
          purchaseIntent: true,
          spendingSignal: "$100/mo",
          verificationStatus: "VERIFIED",
        },
      ],
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "WILLINGNESS_TO_PAY");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("HIGH");
    expect(item?.evidenceSignalIds).toContain("sig-2");
  });

  it("detects pricing updates in integer cents", () => {
    const snap1 = createBaseSnapshot({
      id: "rev-1",
      pricing: { baseMonthlyPriceCents: 4900, currency: "USD" },
    });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      pricing: { baseMonthlyPriceCents: 7900, currency: "USD" },
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "PRICING");
    expect(item?.severity).toBe("MEDIUM");
    expect(item?.numericDelta).toBe(3000);
  });

  it("detects MVP cost estimate changes", () => {
    const snap1 = createBaseSnapshot({
      id: "rev-1",
      mvpCost: {
        minBuildMinorCents: 100000,
        maxBuildMinorCents: 200000,
        baseBuildMinorCents: 150000,
      },
    });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      mvpCost: {
        minBuildMinorCents: 150000,
        maxBuildMinorCents: 300000,
        baseBuildMinorCents: 220000,
      },
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "MVP_COST");
    expect(item).toBeDefined();
    expect(item?.direction).toBe("NEGATIVE");
  });

  it("detects delivery time changes", () => {
    const snap1 = createBaseSnapshot({
      id: "rev-1",
      deliveryTimeWeeks: { minWeeks: 4, maxWeeks: 8, baseWeeks: 6 },
    });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      deliveryTimeWeeks: { minWeeks: 8, maxWeeks: 16, baseWeeks: 12 },
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "DELIVERY_TIME");
    expect(item?.numericDelta).toBe(8);
  });

  it("detects competitor additions and removals with stable sorting", () => {
    const snap1 = createBaseSnapshot({
      id: "rev-1",
      competitors: [{ name: "Acme", competitorType: "DIRECT" }],
    });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      competitors: [
        { name: "Acme", competitorType: "DIRECT" },
        { name: "Zeta AI", competitorType: "DIRECT" },
      ],
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "COMPETITOR");
    expect(item?.reasonCode).toBe("COMPETITOR_ADDED");
    expect(item?.sanitizedSummary).toContain("Zeta AI");
  });

  it("detects critical risks added (CRITICAL severity, NEGATIVE direction) and mitigated (MEDIUM severity, POSITIVE direction)", () => {
    const snap1 = createBaseSnapshot({ id: "rev-1", risks: [] });
    const snap2 = createBaseSnapshot({
      id: "rev-2",
      risks: [
        {
          id: "r-crit",
          category: "REGULATORY",
          severity: "CRITICAL",
          status: "IDENTIFIED",
          description: "FDA compliance required",
        },
      ],
    });

    const diff = computeOpportunityRevisionDiff(snap1, snap2);
    const item = diff.items.find((i) => i.dimension === "CRITICAL_RISK");
    expect(item?.severity).toBe("CRITICAL");
    expect(item?.direction).toBe("NEGATIVE");
    expect(item?.reasonCode).toBe("CRITICAL_RISK_IDENTIFIED");

    // Mitigation
    const snap3 = createBaseSnapshot({
      id: "rev-3",
      risks: [
        {
          id: "r-crit",
          category: "REGULATORY",
          severity: "CRITICAL",
          status: "RESOLVED",
          description: "FDA compliance required",
        },
      ],
    });
    const diffMitigated = computeOpportunityRevisionDiff(snap2, snap3);
    const itemMitigated = diffMitigated.items.find((i) => i.dimension === "CRITICAL_RISK");
    expect(itemMitigated?.severity).toBe("MEDIUM");
    expect(itemMitigated?.direction).toBe("POSITIVE");
    expect(itemMitigated?.reasonCode).toBe("CRITICAL_RISK_MITIGATED");
  });

  it("guarantees stable array ordering and canonical hash reproducibility", () => {
    const snapA = createBaseSnapshot({
      competitors: [
        { name: "Beta", competitorType: "INDIRECT" },
        { name: "Alpha", competitorType: "DIRECT" },
      ],
      risks: [
        { category: "TECH", severity: "HIGH", status: "IDENTIFIED", description: "Latency risk" },
        { category: "MARKET", severity: "LOW", status: "IDENTIFIED", description: "Adoption risk" },
      ],
    });

    const snapB = createBaseSnapshot({
      competitors: [
        { name: "Alpha", competitorType: "DIRECT" },
        { name: "Beta", competitorType: "INDIRECT" },
      ],
      risks: [
        { category: "MARKET", severity: "LOW", status: "IDENTIFIED", description: "Adoption risk" },
        { category: "TECH", severity: "HIGH", status: "IDENTIFIED", description: "Latency risk" },
      ],
    });

    const hashA = computeCanonicalDiffHash(snapA, snapB);
    const hashB = computeCanonicalDiffHash(snapB, snapA);
    const canonicalA = canonicalizeSnapshot(snapA);
    const canonicalB = canonicalizeSnapshot(snapB);

    expect(canonicalA.competitors).toEqual(canonicalB.competitors);
    expect(canonicalA.risks).toEqual(canonicalB.risks);
  });
});
