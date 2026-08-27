import { describe, it, expect } from "vitest";
import { executeIntelligencePipeline } from "../src/pipeline.js";
import { calculateEvidenceConfidence } from "@buildworth/scoring";
import { evaluatePublicationQuality } from "@buildworth/validation";
import { sanitizeToPlainText } from "@buildworth/shared";
import { EvidenceSignalItem, ClaimEvidenceLinkItem } from "@buildworth/shared";

describe("Phase 1 E2E Flow: Evidence Ingestion to Claim Attribution & Publication Quality Gate", () => {
  const verifiedSignals: EvidenceSignalItem[] = [
    {
      id: "sig-hn-1",
      sourceId: "src-hn",
      sourceTitle: "Hacker News",
      sourceFamily: "COMMUNITY",
      canonicalUrl: "https://news.ycombinator.com/item?id=39210044",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt:
        "Every quarter before the SOC2 Type II audit, we have to halt sprint work for 3 days taking screenshots.",
      independenceKey: "hn:story:39210044",
      independenceConfidence: 1.0,
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: true,
      spendingSignal: "$15k/yr audit software",
      desiredOutcome: "Automated git PR evidence collection",
      language: "en",
      signalType: "PAIN",
      isContradiction: false,
    },
    {
      id: "sig-reddit-1",
      sourceId: "src-reddit",
      sourceTitle: "Reddit DevOps",
      sourceFamily: "COMMUNITY",
      canonicalUrl: "https://reddit.com/r/devops/comments/1f92a10",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt:
        "Would pay $200/mo for a tool that just blocks console edits and collects evidence automatically.",
      independenceKey: "reddit:post:devops:1f92a10",
      independenceConfidence: 1.0,
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: true,
      spendingSignal: "$200/mo",
      desiredOutcome: "Automatic PR evidence",
      language: "en",
      signalType: "PURCHASE_INTENT",
      isContradiction: false,
    },
    {
      id: "sig-github-1",
      sourceId: "src-github",
      sourceTitle: "GitHub Issues",
      sourceFamily: "CODE_REPOSITORY",
      canonicalUrl: "https://github.com/vercel/next.js/discussions/50122",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt: "SOC2 compliance requirements require cryptographic commit signing in CI.",
      independenceKey: "github:repo:vercel/next.js",
      independenceConfidence: 1.0,
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: false,
      desiredOutcome: "Commit signature evidence",
      language: "en",
      signalType: "WORKAROUND",
      isContradiction: false,
    },
    {
      id: "sig-sec-1",
      sourceId: "src-sec",
      sourceTitle: "SEC Filing Form 10-K",
      sourceFamily: "REGULATORY_FILING",
      canonicalUrl: "https://sec.gov/edgar/data/12345/compliance-filing",
      credibilityTier: "TIER_1_PRIMARY",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt:
        "Enterprise procurement mandate: SOC2 Type II report mandatory for vendors.",
      independenceKey: "sec:filing:12345",
      independenceConfidence: 1.0,
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: true,
      desiredOutcome: "Vendor compliance verification",
      language: "en",
      signalType: "PROCUREMENT",
      isContradiction: false,
    },
    {
      id: "sig-contra-1",
      sourceId: "src-hn-contra",
      sourceTitle: "Hacker News",
      sourceFamily: "COMMUNITY",
      canonicalUrl: "https://news.ycombinator.com/item?id=38491099",
      credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
      evidenceOrigin: "COLLECTED",
      verificationStatus: "VERIFIED",
      verificationMethod: "AUTOMATED_SOURCE_VALIDATION",
      sanitizedExcerpt:
        "We just built a 50-line bash script that exports git log to S3 for SOC2 and it works fine.",
      independenceKey: "hn:story:38491099",
      independenceConfidence: 1.0,
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      publishedAtPrecision: "EXACT_TIMESTAMP",
      purchaseIntent: false,
      desiredOutcome: "Internal scripting workaround",
      language: "en",
      signalType: "CONTRADICTING_EVIDENCE",
      isContradiction: true,
    },
  ];

  const claimLinks: ClaimEvidenceLinkItem[] = [
    {
      id: "link-1",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "PAIN_EXISTENCE",
      claimIdentifier: "pain_existence",
      relationshipType: "SUPPORTS",
      supportStrength: "STRONG",
      explanation: "Direct practitioner pain regarding screenshot capture overhead.",
      relevanceScore: 0.95,
      signal: verifiedSignals[0],
    },
    {
      id: "link-2",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "WILLINGNESS_TO_PAY",
      claimIdentifier: "willingness_to_pay",
      relationshipType: "SUPPORTS",
      supportStrength: "STRONG",
      explanation: "Explicit $200/mo willingness to pay stated.",
      relevanceScore: 0.92,
      signal: verifiedSignals[1],
    },
    {
      id: "link-3",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "TECHNICAL_FEASIBILITY",
      claimIdentifier: "technical_feasibility",
      relationshipType: "SUPPORTS",
      supportStrength: "MODERATE",
      explanation: "Git commit signature verification in CI.",
      relevanceScore: 0.88,
      signal: verifiedSignals[2],
    },
    {
      id: "link-4",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "BUYER_DEMAND",
      claimIdentifier: "buyer_demand",
      relationshipType: "SUPPORTS",
      supportStrength: "STRONG",
      explanation: "SEC 10-K regulatory compliance requirement for procurement.",
      relevanceScore: 0.96,
      signal: verifiedSignals[3],
    },
    {
      id: "link-5",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "BUYER_IDENTITY",
      claimIdentifier: "buyer_identity",
      relationshipType: "SUPPORTS",
      supportStrength: "STRONG",
      explanation: "DevOps and VP of Engineering target role identification.",
      relevanceScore: 0.9,
      signal: verifiedSignals[0],
    },
    {
      id: "link-6",
      opportunityRevisionId: "rev-soc2-1",
      claimType: "CURRENT_WORKAROUND",
      claimIdentifier: "current_workaround",
      relationshipType: "CONTRADICTS",
      supportStrength: "MODERATE",
      explanation: "Simple bash script workaround reduces perceived willingness to pay.",
      relevanceScore: 0.85,
      signal: verifiedSignals[4],
    },
  ];

  it("1. Sanitization preserves faithful plain text without altering quotes", () => {
    const rawQuote =
      "<p>Every quarter before the SOC2 Type II audit, we have to halt sprint work for 3 days just taking screenshots.</p>";
    const cleaned = sanitizeToPlainText(rawQuote);
    expect(cleaned).toBe(
      "Every quarter before the SOC2 Type II audit, we have to halt sprint work for 3 days just taking screenshots.",
    );
  });

  it("2. Confidence engine calculates deterministic score with contradiction deduction", () => {
    const confidence = calculateEvidenceConfidence({
      evidenceLinks: claimLinks,
    });

    expect(confidence.score).toBeGreaterThan(70);
    expect(confidence.explanation.contradictionPenalty).toBeGreaterThan(0);
    expect(confidence.explanation.positiveComponents.sourceDiversityScore).toBeGreaterThan(10);
    expect(confidence.explanation.positiveComponents.familyDiversityScore).toBe(10);
    expect(confidence.explanation.positiveComponents.claimCoverageScore).toBeGreaterThan(10);
  });

  it("3. Publication quality gate promotes fully verified multi-source blueprint to VERIFIED", () => {
    const gate = evaluatePublicationQuality(claimLinks, 82, false);
    expect(gate.status).toBe("VERIFIED");
    expect(gate.isEligibleForVerified).toBe(true);
    expect(gate.metrics.verifiedSignals).toBe(6);
    expect(gate.metrics.criticalClaimsCoveredCount).toBe(4);
  });

  it("4. End-to-end pipeline synthesis produces blueprints with structured evidenceLinks", async () => {
    const pipelineResult = await executeIntelligencePipeline();
    expect(pipelineResult.opportunitiesSynthesized.length).toBeGreaterThan(0);
    const opp = pipelineResult.opportunitiesSynthesized[0];
    expect(opp.evidenceLinks).toBeDefined();
    expect(opp.scorecard).toBeDefined();
  });
});
