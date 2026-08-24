export type SignalType =
  | "PAIN"
  | "WORKAROUND"
  | "FEATURE_REQUEST"
  | "PURCHASE_INTENT"
  | "WILLINGNESS_TO_PAY"
  | "COMPETITOR_COMPLAINT"
  | "JOB_POSTING"
  | "PROCUREMENT"
  | "SEARCH_DEMAND"
  | "PRICING"
  | "TECHNOLOGY_ENABLER"
  | "MARKET_ACTIVITY"
  | "CONTRADICTING_EVIDENCE"
  | "PAIN_COMPLAINT"
  | "WORKAROUND_REQUEST"
  | "COMPETITOR_DISSATISFACTION"
  | "EMERGING_TECH"
  | "NOISE";

export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED" | "STALE" | "INACCESSIBLE";

export type VerificationMethod =
  "AUTOMATED_SOURCE_VALIDATION" | "HUMAN_REVIEW" | "TRUSTED_API" | "IMPORTED_VERIFIED_DATASET";

export type EvidenceOrigin =
  "COLLECTED" | "HUMAN_SUBMITTED" | "IMPORTED" | "SYNTHETIC_FIXTURE" | "LEGACY_UNCLASSIFIED";

export type SourceCredibilityTier =
  "TIER_1_PRIMARY" | "TIER_2_CREDIBLE_PUBLIC" | "TIER_3_SECONDARY";

export type SourcePolicyStatus =
  "UNKNOWN" | "REVIEW_REQUIRED" | "ALLOWED" | "ALLOWED_WITH_RESTRICTIONS" | "BLOCKED";

export type RelationshipType = "SUPPORTS" | "CONTRADICTS";

export type SupportStrength = "WEAK" | "MODERATE" | "STRONG";

export type DatePrecision = "EXACT_TIMESTAMP" | "DAY" | "MONTH" | "UNKNOWN";

export type PublicationQualityStatus =
  "VERIFIED" | "PARTIALLY_VERIFIED" | "HYPOTHESIS" | "EVIDENCE_PENDING" | "STALE";

export type ClaimType =
  | "PAIN_EXISTENCE"
  | "PAIN_SEVERITY"
  | "PAIN_FREQUENCY"
  | "CURRENT_WORKAROUND"
  | "BUYER_IDENTITY"
  | "BUYER_DEMAND"
  | "WILLINGNESS_TO_PAY"
  | "MARKET_ATTRACTIVENESS"
  | "COMPETITOR_GAP"
  | "TECHNICAL_FEASIBILITY"
  | "MVP_COST"
  | "CUSTOMER_BENEFIT"
  | "PLAUSIBLE_PRICING"
  | "GO_TO_MARKET_ACCESSIBILITY";

export interface EvidenceSignalItem {
  id: string;
  sourceId?: string | null;
  sourceName?: string;
  sourceType?: string;
  sourceFamily?: string | null;
  credibilityTier?: SourceCredibilityTier | null;
  policyStatus?: SourcePolicyStatus;

  signalType: SignalType;
  evidenceOrigin: EvidenceOrigin;

  originalUrl?: string | null;
  canonicalUrl?: string | null;
  sourceTitle?: string | null;
  authorOrg?: string | null;

  publishedAt?: Date | string | null;
  publishedAtPrecision: DatePrecision;
  collectedAt: Date | string;
  language: string;

  sanitizedExcerpt: string;
  problemSummary: string;
  actorRole?: string | null;
  workflowContext?: string | null;

  purchaseIntent: boolean;
  spendingSignal?: string | null;
  desiredOutcome?: string | null;

  evidenceQuality: number;
  recencyScore: number;
  credibilityScore: number;
  contentFingerprint?: string | null;
  duplicateGroupKey?: string | null;
  independenceKey?: string | null;
  independenceMethod?: string | null;
  independenceConfidence: number;

  verificationStatus: VerificationStatus;
  verificationMethod?: VerificationMethod | null;
  verifiedAt?: Date | string | null;
  verifiedBy?: string | null;
  verificationNotes?: string | null;
  lastAccessibilityCheckAt?: Date | string | null;
}

export interface ClaimEvidenceLinkItem {
  id: string;
  opportunityRevisionId?: string | null;
  opportunityId?: string | null;
  normalizedSignalId: string;
  signal?: EvidenceSignalItem;
  claimType: ClaimType;
  claimIdentifier: string;
  claimSnippet: string;
  relationshipType: RelationshipType;
  supportStrength: SupportStrength;
  explanation?: string | null;
  relevanceScore: number;
}

export interface ClaimCoverageItem {
  claimType: ClaimType;
  claimIdentifier: string;
  claimLabel: string;
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  independentSourceCount: number;
  isCriticalClaim: boolean;
  hasVerifiedSupport: boolean;
  primaryStrength: SupportStrength;
  evidenceLinkIds: string[];
}

export interface EvidenceSummary {
  totalSignalsCount: number;
  verifiedSignalsCount: number;
  unverifiedSignalsCount: number;
  rejectedSignalsCount: number;
  independentSourceGroupsCount: number;
  sourceFamiliesCount: number;
  supportingCount: number;
  contradictingCount: number;
  directBuyerIntentCount: number;
  newestEvidenceDate?: Date | string | null;
  oldestEvidenceDate?: Date | string | null;
  lastRefreshedAt?: Date | string | null;
  publicationQualityStatus: PublicationQualityStatus;
  isDemoFixture: boolean;
  claimsCoverage: Record<ClaimType, ClaimCoverageItem>;
}

export interface ConfidenceExplanation {
  rubricVersion: string;
  score: number; // 0 - 100
  positiveComponents: {
    evidenceVolumeScore: number; // Max 15
    sourceDiversityScore: number; // Max 15
    familyDiversityScore: number; // Max 10
    sourceCredibilityScore: number; // Max 15
    directBuyerIntentScore: number; // Max 15
    recencyScore: number; // Max 10
    claimCoverageScore: number; // Max 20
  };
  contradictionPenalty: number; // 0 - 20
  strongestEvidenceArea: string;
  weakestEvidenceArea: string;
  missingEvidenceAreas: string[];
  contradictoryEvidenceNotes: string[];
  recalculatedAt: Date | string;
}
