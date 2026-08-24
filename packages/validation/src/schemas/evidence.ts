import { z } from "zod";

export const SignalTypeSchema = z.enum([
  "PAIN",
  "WORKAROUND",
  "FEATURE_REQUEST",
  "PURCHASE_INTENT",
  "WILLINGNESS_TO_PAY",
  "COMPETITOR_COMPLAINT",
  "JOB_POSTING",
  "PROCUREMENT",
  "SEARCH_DEMAND",
  "PRICING",
  "TECHNOLOGY_ENABLER",
  "MARKET_ACTIVITY",
  "CONTRADICTING_EVIDENCE",
  "PAIN_COMPLAINT",
  "WORKAROUND_REQUEST",
  "COMPETITOR_DISSATISFACTION",
  "EMERGING_TECH",
  "NOISE",
]);

export const VerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "VERIFIED",
  "REJECTED",
  "STALE",
  "INACCESSIBLE",
]);

export const VerificationMethodSchema = z.enum([
  "AUTOMATED_SOURCE_VALIDATION",
  "HUMAN_REVIEW",
  "TRUSTED_API",
  "IMPORTED_VERIFIED_DATASET",
]);

export const EvidenceOriginSchema = z.enum([
  "COLLECTED",
  "HUMAN_SUBMITTED",
  "IMPORTED",
  "SYNTHETIC_FIXTURE",
  "LEGACY_UNCLASSIFIED",
]);

export const SourceCredibilityTierSchema = z.enum([
  "TIER_1_PRIMARY",
  "TIER_2_CREDIBLE_PUBLIC",
  "TIER_3_SECONDARY",
]);

export const SourcePolicyStatusSchema = z.enum([
  "UNKNOWN",
  "REVIEW_REQUIRED",
  "ALLOWED",
  "ALLOWED_WITH_RESTRICTIONS",
  "BLOCKED",
]);

export const RelationshipTypeSchema = z.enum(["SUPPORTS", "CONTRADICTS"]);

export const SupportStrengthSchema = z.enum(["WEAK", "MODERATE", "STRONG"]);

export const DatePrecisionSchema = z.enum(["EXACT_TIMESTAMP", "DAY", "MONTH", "UNKNOWN"]);

export const PublicationQualityStatusSchema = z.enum([
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "HYPOTHESIS",
  "EVIDENCE_PENDING",
  "STALE",
]);

export const ClaimTypeSchema = z.enum([
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
]);

export const EvidenceSignalItemSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().nullable().optional(),
    sourceName: z.string().optional(),
    sourceType: z.string().optional(),
    sourceFamily: z.string().nullable().optional(),
    credibilityTier: SourceCredibilityTierSchema.nullable().optional(),
    policyStatus: SourcePolicyStatusSchema.optional(),

    signalType: SignalTypeSchema,
    evidenceOrigin: EvidenceOriginSchema,

    originalUrl: z.string().url().nullable().optional(),
    canonicalUrl: z.string().url().nullable().optional(),
    sourceTitle: z.string().nullable().optional(),
    authorOrg: z.string().nullable().optional(),

    publishedAt: z.union([z.date(), z.string()]).nullable().optional(),
    publishedAtPrecision: DatePrecisionSchema.default("UNKNOWN"),
    collectedAt: z.union([z.date(), z.string()]),
    language: z.string().default("en"),

    sanitizedExcerpt: z.string().max(1000),
    problemSummary: z.string(),
    actorRole: z.string().nullable().optional(),
    workflowContext: z.string().nullable().optional(),

    purchaseIntent: z.boolean().default(false),
    spendingSignal: z.string().nullable().optional(),
    desiredOutcome: z.string().nullable().optional(),

    evidenceQuality: z.number().min(0).max(1).default(0.8),
    recencyScore: z.number().min(0).max(1).default(1.0),
    credibilityScore: z.number().min(0).max(1).default(0.8),
    contentFingerprint: z.string().nullable().optional(),
    duplicateGroupKey: z.string().nullable().optional(),
    independenceKey: z.string().nullable().optional(),
    independenceMethod: z.string().nullable().optional(),
    independenceConfidence: z.number().min(0).max(1).default(1.0),

    verificationStatus: VerificationStatusSchema.default("UNVERIFIED"),
    verificationMethod: VerificationMethodSchema.nullable().optional(),
    verifiedAt: z.union([z.date(), z.string()]).nullable().optional(),
    verifiedBy: z.string().nullable().optional(),
    verificationNotes: z.string().nullable().optional(),
    lastAccessibilityCheckAt: z.union([z.date(), z.string()]).nullable().optional(),
  })
  .refine(
    (data) => {
      // If publishedAt is null/undefined, publishedAtPrecision MUST be UNKNOWN
      if (!data.publishedAt && data.publishedAtPrecision !== "UNKNOWN") {
        return false;
      }
      return true;
    },
    {
      message: "If publishedAt is null, publishedAtPrecision must be UNKNOWN",
      path: ["publishedAtPrecision"],
    },
  );

export const ClaimEvidenceLinkItemSchema = z.object({
  id: z.string().min(1),
  opportunityRevisionId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  normalizedSignalId: z.string().min(1),
  signal: EvidenceSignalItemSchema.optional(),
  claimType: ClaimTypeSchema,
  claimIdentifier: z.string().min(1),
  claimSnippet: z.string(),
  relationshipType: RelationshipTypeSchema.default("SUPPORTS"),
  supportStrength: SupportStrengthSchema.default("MODERATE"),
  explanation: z.string().nullable().optional(),
  relevanceScore: z.number().min(0).max(1).default(1.0),
});
