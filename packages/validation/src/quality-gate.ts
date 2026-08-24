import {
  ClaimType,
  ClaimEvidenceLinkItem,
  EvidenceSignalItem,
  PublicationQualityStatus,
} from "@buildworth/shared";

export interface QualityGateConfig {
  version: string;
  minVerifiedSignalsForVerified: number;
  minIndependentSourcesForVerified: number;
  minSourceFamiliesForVerified: number;
  minConfidenceForVerified: number;
  maxStaleDaysForFastMoving: number; // 180 days (pricing, tech enablers)
  maxStaleDaysForStructuralPain: number; // 365 days
}

export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  version: "2.0.0",
  minVerifiedSignalsForVerified: 5,
  minIndependentSourcesForVerified: 3,
  minSourceFamiliesForVerified: 2,
  minConfidenceForVerified: 70,
  maxStaleDaysForFastMoving: 180,
  maxStaleDaysForStructuralPain: 365,
};

export const CRITICAL_CLAIMS: ClaimType[] = [
  "PAIN_EXISTENCE",
  "BUYER_IDENTITY",
  "BUYER_DEMAND",
  "WILLINGNESS_TO_PAY",
];

export interface QualityGateResult {
  status: PublicationQualityStatus;
  gateVersion: string;
  isEligibleForVerified: boolean;
  blockers: string[];
  warnings: string[];
  metrics: {
    totalSignals: number;
    verifiedSignals: number;
    independentSourceGroups: number;
    sourceFamilies: number;
    criticalClaimsCoveredCount: number;
    totalClaimsCoveredCount: number;
    hasSyntheticFixture: boolean;
    confidenceScore: number;
    staleSignalsCount: number;
  };
}

/**
 * Evaluates whether an opportunity qualifies for VERIFIED, PARTIALLY_VERIFIED, HYPOTHESIS, EVIDENCE_PENDING, or STALE.
 */
export function evaluatePublicationQuality(
  links: ClaimEvidenceLinkItem[],
  confidenceScore: number,
  isJobPending = false,
  config: QualityGateConfig = DEFAULT_QUALITY_GATE_CONFIG,
  now: Date = new Date(),
): QualityGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const verifiedLinks = links.filter((l) => {
    const s = l.signal;
    if (!s) return false;
    return (
      s.verificationStatus === "VERIFIED" &&
      s.evidenceOrigin !== "SYNTHETIC_FIXTURE" &&
      s.evidenceOrigin !== "LEGACY_UNCLASSIFIED"
    );
  });

  const verifiedSignals = verifiedLinks.map((l) => l.signal as EvidenceSignalItem);
  const hasSyntheticFixture = links.some((l) => l.signal?.evidenceOrigin === "SYNTHETIC_FIXTURE");

  if (hasSyntheticFixture) {
    blockers.push("Contains SYNTHETIC_FIXTURE evidence which cannot be counted toward publication");
  }

  // Group by independenceKey
  const uniqueIndependenceKeys = new Set(
    verifiedSignals.map((s) => s.independenceKey || `id:${s.id}`),
  );
  const uniqueFamilies = new Set(
    verifiedSignals.map((s) => s.sourceFamily || "COMMUNITY").filter(Boolean),
  );

  // Check claim coverage
  const coveredClaims = new Set(
    verifiedLinks.filter((l) => l.relationshipType === "SUPPORTS").map((l) => l.claimType),
  );

  const missingCriticalClaims = CRITICAL_CLAIMS.filter((c) => !coveredClaims.has(c));

  // Check staleness
  let staleCount = 0;
  for (const s of verifiedSignals) {
    if (s.publishedAt) {
      const ageDays = (now.getTime() - new Date(s.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      const isFastMoving =
        s.signalType === "PRICING" ||
        s.signalType === "TECHNOLOGY_ENABLER" ||
        s.signalType === "JOB_POSTING";
      const maxAge = isFastMoving
        ? config.maxStaleDaysForFastMoving
        : config.maxStaleDaysForStructuralPain;
      if (ageDays > maxAge) {
        staleCount++;
      }
    }
  }

  const isStale = verifiedSignals.length > 0 && staleCount / verifiedSignals.length > 0.6;

  // Gate Evaluations
  const hasEnoughVerifiedSignals = verifiedSignals.length >= config.minVerifiedSignalsForVerified;
  const hasEnoughIndependentSources =
    uniqueIndependenceKeys.size >= config.minIndependentSourcesForVerified;
  const hasEnoughFamilies = uniqueFamilies.size >= config.minSourceFamiliesForVerified;
  const hasCriticalClaims = missingCriticalClaims.length === 0;
  const hasConfidence = confidenceScore >= config.minConfidenceForVerified;

  if (!hasEnoughVerifiedSignals) {
    blockers.push(
      `Requires at least ${config.minVerifiedSignalsForVerified} verified signals (found ${verifiedSignals.length})`,
    );
  }
  if (!hasEnoughIndependentSources) {
    blockers.push(
      `Requires at least ${config.minIndependentSourcesForVerified} independent source groups (found ${uniqueIndependenceKeys.size})`,
    );
  }
  if (!hasEnoughFamilies) {
    blockers.push(
      `Requires at least ${config.minSourceFamiliesForVerified} distinct source families (found ${uniqueFamilies.size})`,
    );
  }
  if (!hasCriticalClaims) {
    blockers.push(
      `Missing verified evidence for critical claims: ${missingCriticalClaims.join(", ")}`,
    );
  }
  if (!hasConfidence) {
    blockers.push(
      `Evidence confidence ${confidenceScore}% is below required ${config.minConfidenceForVerified}%`,
    );
  }
  if (isStale) {
    blockers.push(`Over 60% of verified evidence exceeds the staleness threshold`);
  }

  let status: PublicationQualityStatus;

  if (hasSyntheticFixture || isStale) {
    status = isStale ? "STALE" : "HYPOTHESIS";
  } else if (
    hasEnoughVerifiedSignals &&
    hasEnoughIndependentSources &&
    hasEnoughFamilies &&
    hasCriticalClaims &&
    hasConfidence
  ) {
    status = "VERIFIED";
  } else if (
    verifiedSignals.length >= 2 &&
    uniqueIndependenceKeys.size >= 2 &&
    coveredClaims.has("PAIN_EXISTENCE") &&
    coveredClaims.has("BUYER_IDENTITY") &&
    confidenceScore >= 45
  ) {
    status = "PARTIALLY_VERIFIED";
  } else if (isJobPending) {
    status = "EVIDENCE_PENDING";
  } else {
    status = "HYPOTHESIS";
  }

  return {
    status,
    gateVersion: config.version,
    isEligibleForVerified: status === "VERIFIED",
    blockers,
    warnings,
    metrics: {
      totalSignals: links.length,
      verifiedSignals: verifiedSignals.length,
      independentSourceGroups: uniqueIndependenceKeys.size,
      sourceFamilies: uniqueFamilies.size,
      criticalClaimsCoveredCount: CRITICAL_CLAIMS.length - missingCriticalClaims.length,
      totalClaimsCoveredCount: coveredClaims.size,
      hasSyntheticFixture,
      confidenceScore,
      staleSignalsCount: staleCount,
    },
  };
}
