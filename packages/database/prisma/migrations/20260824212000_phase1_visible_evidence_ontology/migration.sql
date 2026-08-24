-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'REVIEWER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('PAIN', 'WORKAROUND', 'FEATURE_REQUEST', 'PURCHASE_INTENT', 'WILLINGNESS_TO_PAY', 'COMPETITOR_COMPLAINT', 'JOB_POSTING', 'PROCUREMENT', 'SEARCH_DEMAND', 'PRICING', 'TECHNOLOGY_ENABLER', 'MARKET_ACTIVITY', 'CONTRADICTING_EVIDENCE', 'PAIN_COMPLAINT', 'WORKAROUND_REQUEST', 'COMPETITOR_DISSATISFACTION', 'EMERGING_TECH', 'NOISE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED', 'STALE', 'INACCESSIBLE');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('AUTOMATED_SOURCE_VALIDATION', 'HUMAN_REVIEW', 'TRUSTED_API', 'IMPORTED_VERIFIED_DATASET');

-- CreateEnum
CREATE TYPE "EvidenceOrigin" AS ENUM ('COLLECTED', 'HUMAN_SUBMITTED', 'IMPORTED', 'SYNTHETIC_FIXTURE', 'LEGACY_UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "SourceCredibilityTier" AS ENUM ('TIER_1_PRIMARY', 'TIER_2_CREDIBLE_PUBLIC', 'TIER_3_SECONDARY');

-- CreateEnum
CREATE TYPE "SourcePolicyStatus" AS ENUM ('UNKNOWN', 'REVIEW_REQUIRED', 'ALLOWED', 'ALLOWED_WITH_RESTRICTIONS', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('SUPPORTS', 'CONTRADICTS');

-- CreateEnum
CREATE TYPE "SupportStrength" AS ENUM ('WEAK', 'MODERATE', 'STRONG');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('EXACT_TIMESTAMP', 'DAY', 'MONTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PublicationQualityStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'HYPOTHESIS', 'EVIDENCE_PENDING', 'STALE');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('PAIN_EXISTENCE', 'PAIN_SEVERITY', 'PAIN_FREQUENCY', 'CURRENT_WORKAROUND', 'BUYER_IDENTITY', 'BUYER_DEMAND', 'WILLINGNESS_TO_PAY', 'MARKET_ATTRACTIVENESS', 'COMPETITOR_GAP', 'TECHNICAL_FEASIBILITY', 'MVP_COST', 'CUSTOMER_BENEFIT', 'PLAUSIBLE_PRICING', 'GO_TO_MARKET_ACCESSIBILITY');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('B2B', 'B2C', 'PROSUMER', 'INTERNAL_TOOL');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'OCCASIONAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceFamily" TEXT DEFAULT 'COMMUNITY',
    "baseUrl" TEXT,
    "adapterType" TEXT NOT NULL,
    "accessMethod" TEXT NOT NULL,
    "credibilityTier" "SourceCredibilityTier",
    "policyStatus" "SourcePolicyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "policyReviewedAt" TIMESTAMP(3),
    "policyReviewedBy" TEXT,
    "policyNotes" TEXT,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "termsNotes" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT true,
    "permittedExcerptLength" INTEGER NOT NULL DEFAULT 280,
    "storageRestrictions" TEXT,
    "lastSuccessfulCollection" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signalsIngested" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_signals" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRunId" TEXT,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorFingerprint" TEXT,
    "title" TEXT,
    "rawContent" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_signals" (
    "id" TEXT NOT NULL,
    "rawSignalId" TEXT,
    "sourceId" TEXT,
    "signalType" "SignalType" NOT NULL DEFAULT 'PAIN',
    "evidenceOrigin" "EvidenceOrigin" DEFAULT 'LEGACY_UNCLASSIFIED',
    "originalUrl" TEXT,
    "canonicalUrl" TEXT,
    "sourceTitle" TEXT,
    "authorOrg" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedAtPrecision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sanitizedExcerpt" TEXT NOT NULL,
    "problemSummary" TEXT NOT NULL,
    "actorRole" TEXT,
    "workflowContext" TEXT,
    "severityScore" INTEGER NOT NULL DEFAULT 1,
    "frequencyScore" INTEGER NOT NULL DEFAULT 1,
    "intentToPayScore" INTEGER NOT NULL DEFAULT 0,
    "extractedEntities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "purchaseIntent" BOOLEAN NOT NULL DEFAULT false,
    "spendingSignal" TEXT,
    "desiredOutcome" TEXT,
    "evidenceQuality" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "recencyScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "credibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "contentFingerprint" TEXT,
    "duplicateGroupKey" TEXT,
    "independenceKey" TEXT,
    "independenceMethod" TEXT,
    "independenceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "independenceOverride" TEXT,
    "independenceOverrideReason" TEXT,
    "independenceOverriddenAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationMethod" "VerificationMethod",
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationNotes" TEXT,
    "lastAccessibilityCheckAt" TIMESTAMP(3),
    "metadata" JSONB,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "normalized_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_clusters" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "vertical" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_members" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "normalizedSignalId" TEXT NOT NULL,
    "distanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cluster_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "oneSentenceSummary" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "jobsToBeDone" TEXT[],
    "proposedProduct" TEXT NOT NULL,
    "narrowMvpScope" TEXT[],
    "targetCustomerSegments" TEXT[],
    "economicBuyer" TEXT NOT NULL,
    "endUser" TEXT NOT NULL,
    "buyingTrigger" TEXT NOT NULL,
    "existingWorkflow" TEXT NOT NULL,
    "painSeverity" "Severity" NOT NULL,
    "painFrequency" "Frequency" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "customerType" "CustomerType" NOT NULL DEFAULT 'B2B',
    "industry" TEXT NOT NULL,
    "publicationQualityStatus" "PublicationQualityStatus" NOT NULL DEFAULT 'HYPOTHESIS',
    "isDemoFixture" BOOLEAN NOT NULL DEFAULT false,
    "currentRevisionId" TEXT,
    "estimatedMvpCostMinCents" INTEGER NOT NULL,
    "estimatedMvpCostMaxCents" INTEGER NOT NULL,
    "estimatedTimeToMvpMinWeeks" INTEGER NOT NULL,
    "estimatedTimeToMvpMaxWeeks" INTEGER NOT NULL,
    "estimatedMonthlyOpCostMinCents" INTEGER NOT NULL,
    "estimatedMonthlyOpCostMaxCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recommendedNextExperiment" TEXT NOT NULL,
    "majorAssumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "majorRisks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problemClusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_revisions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "reasonForChange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL,
    "opportunityRevisionId" TEXT,
    "opportunityId" TEXT,
    "normalizedSignalId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL DEFAULT 'PAIN_EXISTENCE',
    "claimIdentifier" TEXT NOT NULL DEFAULT 'pain_existence',
    "claimSnippet" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL DEFAULT 'SUPPORTS',
    "supportStrength" "SupportStrength" NOT NULL DEFAULT 'MODERATE',
    "explanation" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecards" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "evidenceConfidenceScore" INTEGER NOT NULL,
    "demandScore" INTEGER NOT NULL,
    "feasibilityScore" INTEGER NOT NULL,
    "economicsScore" INTEGER NOT NULL,
    "competitionScore" INTEGER NOT NULL,
    "goMarketScore" INTEGER NOT NULL,
    "rubricVersion" TEXT NOT NULL DEFAULT '2.0.0',
    "isHypothesisOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_dimensions" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "score_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_overrides" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "originalScore" INTEGER NOT NULL,
    "overriddenScore" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_opportunities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "opportunityRevisionId" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "verificationMethod" TEXT,
    "confidenceRubricVersion" TEXT,
    "publicationGateVersion" TEXT,
    "evidenceIdsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previousConfidence" INTEGER,
    "newConfidence" INTEGER,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_spend_ledger_records" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costMinorUnits" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_spend_ledger_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switches" (
    "id" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kill_switches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sources_key_key" ON "sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "raw_signals_contentHash_key" ON "raw_signals"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "normalized_signals_rawSignalId_key" ON "normalized_signals"("rawSignalId");

-- CreateIndex
CREATE INDEX "normalized_signals_sourceId_idx" ON "normalized_signals"("sourceId");

-- CreateIndex
CREATE INDEX "normalized_signals_publishedAt_idx" ON "normalized_signals"("publishedAt");

-- CreateIndex
CREATE INDEX "normalized_signals_verificationStatus_idx" ON "normalized_signals"("verificationStatus");

-- CreateIndex
CREATE INDEX "normalized_signals_signalType_idx" ON "normalized_signals"("signalType");

-- CreateIndex
CREATE INDEX "normalized_signals_contentFingerprint_idx" ON "normalized_signals"("contentFingerprint");

-- CreateIndex
CREATE INDEX "normalized_signals_duplicateGroupKey_idx" ON "normalized_signals"("duplicateGroupKey");

-- CreateIndex
CREATE INDEX "normalized_signals_independenceKey_idx" ON "normalized_signals"("independenceKey");

-- CreateIndex
CREATE INDEX "normalized_signals_canonicalUrl_idx" ON "normalized_signals"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_members_clusterId_normalizedSignalId_key" ON "cluster_members"("clusterId", "normalizedSignalId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_slug_key" ON "opportunities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_currentRevisionId_key" ON "opportunities"("currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_revisions_opportunityId_revisionNumber_key" ON "opportunity_revisions"("opportunityId", "revisionNumber");

-- CreateIndex
CREATE INDEX "evidence_links_opportunityRevisionId_idx" ON "evidence_links"("opportunityRevisionId");

-- CreateIndex
CREATE INDEX "evidence_links_opportunityId_idx" ON "evidence_links"("opportunityId");

-- CreateIndex
CREATE INDEX "evidence_links_normalizedSignalId_idx" ON "evidence_links"("normalizedSignalId");

-- CreateIndex
CREATE INDEX "evidence_links_claimIdentifier_idx" ON "evidence_links"("claimIdentifier");

-- CreateIndex
CREATE INDEX "evidence_links_relationshipType_idx" ON "evidence_links"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_links_opportunityRevisionId_normalizedSignalId_cla_key" ON "evidence_links"("opportunityRevisionId", "normalizedSignalId", "claimIdentifier", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "saved_opportunities_userId_opportunityId_key" ON "saved_opportunities"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_evidenceId_idx" ON "audit_logs"("evidenceId");

-- CreateIndex
CREATE INDEX "audit_logs_opportunityRevisionId_idx" ON "audit_logs"("opportunityRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "kill_switches_subsystem_key" ON "kill_switches"("subsystem");

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_signals" ADD CONSTRAINT "raw_signals_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_signals" ADD CONSTRAINT "raw_signals_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_signals" ADD CONSTRAINT "normalized_signals_rawSignalId_fkey" FOREIGN KEY ("rawSignalId") REFERENCES "raw_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_signals" ADD CONSTRAINT "normalized_signals_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "problem_clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_normalizedSignalId_fkey" FOREIGN KEY ("normalizedSignalId") REFERENCES "normalized_signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_problemClusterId_fkey" FOREIGN KEY ("problemClusterId") REFERENCES "problem_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_revisions" ADD CONSTRAINT "opportunity_revisions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_normalizedSignalId_fkey" FOREIGN KEY ("normalizedSignalId") REFERENCES "normalized_signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_dimensions" ADD CONSTRAINT "score_dimensions_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "scorecards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_overrides" ADD CONSTRAINT "score_overrides_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_overrides" ADD CONSTRAINT "score_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

