-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'REVIEWER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('PAIN', 'WORKAROUND', 'FEATURE_REQUEST', 'PURCHASE_INTENT', 'WILLINGNESS_TO_PAY', 'COMPETITOR_COMPLAINT', 'JOB_POSTING', 'PROCUREMENT', 'SEARCH_DEMAND', 'PRICING', 'TECHNOLOGY_ENABLER', 'MARKET_ACTIVITY', 'CONTRADICTING_EVIDENCE', 'PAIN_COMPLAINT', 'WORKAROUND_REQUEST', 'COMPETITOR_DISSATISFACTION', 'EMERGING_TECH', 'NOISE', 'PAIN_POINT', 'FEATURE_REQUEST_LEGACY', 'BUDGET_SIGNAL', 'COMPETITOR_CHURN');

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

-- CreateEnum
CREATE TYPE "DecisionRecommendation" AS ENUM ('BUILD_CANDIDATE', 'VALIDATE_FIRST', 'WATCH', 'WEAK_OPPORTUNITY', 'REJECT', 'UNASSESSED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('MARKET', 'BUYER', 'COMPETITION', 'TECHNICAL', 'DATA', 'SECURITY', 'PRIVACY', 'REGULATORY', 'FINANCIAL', 'DISTRIBUTION', 'OPERATIONS', 'DEPENDENCY');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'MITIGATING', 'RESOLVED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "AssumptionCategory" AS ENUM ('PROBLEM', 'BUYER', 'WILLINGNESS_TO_PAY', 'SOLUTION', 'FEASIBILITY', 'DISTRIBUTION', 'COST', 'REGULATORY');

-- CreateEnum
CREATE TYPE "AssumptionStatus" AS ENUM ('UNTESTED', 'TESTING', 'SUPPORTED', 'CONTRADICTED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ExperimentType" AS ENUM ('CUSTOMER_INTERVIEW', 'LANDING_PAGE', 'WAITLIST', 'PREORDER', 'PAID_PILOT', 'CONCIERGE_MVP', 'PROTOTYPE_TEST', 'PRICING_TEST', 'CHANNEL_TEST', 'TECHNICAL_SPIKE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('PLANNED', 'RUNNING', 'PASSED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SalesMotion" AS ENUM ('SELF_SERVICE', 'PRODUCT_LED', 'FOUNDER_LED', 'SALES_ASSISTED', 'ENTERPRISE_SALES', 'PARTNER_LED');

-- CreateEnum
CREATE TYPE "MvpCategory" AS ENUM ('MUST_HAVE', 'SHOULD_HAVE', 'LATER', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('CONSERVATIVE', 'BASE', 'UPSIDE');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('ONE_TIME_BUILD', 'MONTHLY_OPERATING');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('PRODUCT_DISCOVERY', 'UX_UI_DESIGN', 'FRONTEND_DEV', 'BACKEND_DEV', 'DATABASE_INFRA', 'INTEGRATIONS', 'AI_MODEL_WORK', 'TESTING_QA', 'SECURITY_COMPLIANCE', 'DEPLOYMENT_DEVOPS', 'CONTINGENCY', 'HOSTING', 'DATABASE', 'STORAGE', 'AI_APIS', 'THIRD_PARTY_APIS', 'EMAIL_NOTIFICATIONS', 'OBSERVABILITY', 'SUPPORT', 'MAINTENANCE', 'COMPLIANCE', 'OTHER_VARIABLE');

-- CreateEnum
CREATE TYPE "BenefitCategory" AS ENUM ('LABOR_TIME_SAVED', 'AVOIDED_LOSSES', 'AVOIDED_DOWNTIME', 'REDUCED_SOFTWARE_SPEND', 'INCREASED_REVENUE', 'REDUCED_RISK', 'FASTER_DELIVERY', 'COMPLIANCE_SAVINGS');

-- CreateEnum
CREATE TYPE "ProvenanceType" AS ENUM ('VERIFIED_EVIDENCE_BACKED', 'PARTIALLY_EVIDENCE_BACKED', 'ASSUMPTION', 'MODEL_ESTIMATE', 'LEGACY_UNCLASSIFIED', 'SYNTHETIC_FIXTURE', 'USER_PROVIDED');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('CALCULATED', 'NOT_ENOUGH_DATA', 'NOT_APPLICABLE', 'INVALID_ASSUMPTION', 'NEGATIVE_UNIT_ECONOMICS');

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
    "decisionRecommendation" "DecisionRecommendation" NOT NULL DEFAULT 'UNASSESSED',
    "decisionReasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryAdvantage" TEXT,
    "riskiestAssumption" TEXT,
    "cheapestExperiment" TEXT,
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

-- CreateTable
CREATE TABLE "opportunity_blueprints" (
    "id" TEXT NOT NULL,
    "opportunityRevisionId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "generationStatus" TEXT NOT NULL DEFAULT 'SYNTHESIZED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "promptVersion" TEXT,
    "calculationVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "decisionRuleVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "architectureSummary" TEXT,
    "gtmNarrative" JSONB,
    "first20Plan" JSONB,
    "reachableMarket" JSONB,

    CONSTRAINT "opportunity_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_customer_segments" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "segmentName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "companySizeRange" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "businessModel" TEXT NOT NULL,
    "endUserRole" TEXT NOT NULL,
    "economicBuyerRole" TEXT NOT NULL,
    "technicalApproverRole" TEXT,
    "procurementComplexity" TEXT NOT NULL,
    "budgetCategory" TEXT NOT NULL,
    "spendingBehavior" TEXT NOT NULL,
    "buyingTrigger" TEXT NOT NULL,
    "primaryObjection" TEXT NOT NULL,
    "acquisitionChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salesCycleMinDays" INTEGER NOT NULL,
    "salesCycleMaxDays" INTEGER NOT NULL,
    "salesMotion" "SalesMotion" NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "provenanceType" "ProvenanceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment_evidence_links" (
    "id" TEXT NOT NULL,
    "customerSegmentId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "customer_segment_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_mvp_features" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MvpCategory" NOT NULL,
    "userJourneyStep" TEXT,
    "requiredIntegrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredData" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptanceCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_mvp_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_competitors" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "competitorType" TEXT NOT NULL,
    "knownPricing" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recurringComplaints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "differentiationHypothesis" TEXT NOT NULL,
    "switchingCosts" TEXT NOT NULL,
    "provenanceType" "ProvenanceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_evidence_links" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "competitor_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_scenarios" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "scenarioType" "ScenarioType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "activeCustomers" INTEGER NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "onboardingPriceCents" INTEGER NOT NULL DEFAULT 0,
    "variableCostPerCustomerCents" INTEGER NOT NULL,
    "monthlyFixedCostCents" INTEGER NOT NULL,
    "customerAcquisitionCostCents" INTEGER NOT NULL,
    "deliveryTimeWeeks" INTEGER NOT NULL,
    "grossMarginPercent" DOUBLE PRECISION,
    "grossMarginStatus" "CalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "grossMarginReason" TEXT,
    "monthlyContributionMarginCents" INTEGER,
    "monthlyOperatingProfitCents" INTEGER,
    "breakEvenCustomers" INTEGER,
    "breakEvenStatus" "CalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "breakEvenReason" TEXT,
    "customerAnnualCostCents" INTEGER,
    "customerAnnualBenefitCents" INTEGER,
    "customerNetAnnualBenefitCents" INTEGER,
    "customerRoiPercent" DOUBLE PRECISION,
    "customerRoiStatus" "CalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "customerRoiReason" TEXT,
    "customerPaybackMonths" DOUBLE PRECISION,
    "customerPaybackStatus" "CalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "customerPaybackReason" TEXT,
    "providerCacPaybackMonths" DOUBLE PRECISION,
    "providerCacPaybackStatus" "CalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "providerCacPaybackReason" TEXT,
    "provenanceType" "ProvenanceType" NOT NULL,
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputHash" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_line_items" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "costType" "CostType" NOT NULL,
    "category" "CostCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scenarioType" "ScenarioType" NOT NULL DEFAULT 'BASE',
    "amountMinorCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "estimateMethod" TEXT NOT NULL,
    "provenanceType" "ProvenanceType" NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_evidence_links" (
    "id" TEXT NOT NULL,
    "costLineItemId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "cost_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_assumption_links" (
    "id" TEXT NOT NULL,
    "costLineItemId" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,

    CONSTRAINT "cost_assumption_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_drivers" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "category" "BenefitCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "affectedRole" TEXT NOT NULL,
    "unitQuantity" DOUBLE PRECISION NOT NULL,
    "unitValueCents" INTEGER NOT NULL,
    "frequencyPeriod" TEXT NOT NULL,
    "annualValueCents" INTEGER NOT NULL,
    "calculationDescription" TEXT NOT NULL,
    "provenanceType" "ProvenanceType" NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_evidence_links" (
    "id" TEXT NOT NULL,
    "benefitDriverId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "benefit_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_assumption_links" (
    "id" TEXT NOT NULL,
    "benefitDriverId" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,

    CONSTRAINT "benefit_assumption_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_risks" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "probabilityScore" INTEGER NOT NULL,
    "impactScore" INTEGER NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "mitigationStrategy" TEXT NOT NULL,
    "earlyWarningIndicator" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "provenanceType" "ProvenanceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_evidence_links" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "risk_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_assumptions" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "category" "AssumptionCategory" NOT NULL,
    "importanceScore" INTEGER NOT NULL,
    "uncertaintyScore" INTEGER NOT NULL,
    "testMethod" TEXT NOT NULL,
    "successThreshold" TEXT NOT NULL,
    "failureThreshold" TEXT NOT NULL,
    "status" "AssumptionStatus" NOT NULL DEFAULT 'UNTESTED',
    "provenanceType" "ProvenanceType" NOT NULL DEFAULT 'ASSUMPTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assumption_evidence_links" (
    "id" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "assumption_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_experiments" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "experimentType" "ExperimentType" NOT NULL,
    "targetParticipant" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL,
    "estimatedDurationDays" INTEGER NOT NULL,
    "acquisitionChannel" TEXT NOT NULL,
    "procedureSummary" TEXT NOT NULL,
    "successMetric" TEXT NOT NULL,
    "successThreshold" TEXT NOT NULL,
    "failureThreshold" TEXT NOT NULL,
    "killCriterion" TEXT NOT NULL,
    "nextActionOnSuccess" TEXT NOT NULL,
    "nextActionOnFailure" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'PLANNED',
    "orderPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_evidence_links" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "evidenceLinkId" TEXT NOT NULL,

    CONSTRAINT "experiment_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_evaluations" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "recommendation" "DecisionRecommendation" NOT NULL DEFAULT 'UNASSESSED',
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockingConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "opportunityScoreUsed" INTEGER NOT NULL,
    "evidenceConfidenceUsed" INTEGER NOT NULL,
    "publicationStatusUsed" "PublicationQualityStatus" NOT NULL,
    "economicsStatus" TEXT NOT NULL,
    "feasibilityStatus" TEXT NOT NULL,
    "criticalRiskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invalidatedAssumptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisionRuleVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "inputHash" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_evaluations_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_blueprints_opportunityRevisionId_key" ON "opportunity_blueprints"("opportunityRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segment_evidence_links_customerSegmentId_evidenceL_key" ON "customer_segment_evidence_links"("customerSegmentId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_evidence_links_competitorId_evidenceLinkId_key" ON "competitor_evidence_links"("competitorId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_scenarios_blueprintId_scenarioType_key" ON "financial_scenarios"("blueprintId", "scenarioType");

-- CreateIndex
CREATE UNIQUE INDEX "cost_evidence_links_costLineItemId_evidenceLinkId_key" ON "cost_evidence_links"("costLineItemId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_assumption_links_costLineItemId_assumptionId_key" ON "cost_assumption_links"("costLineItemId", "assumptionId");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_evidence_links_benefitDriverId_evidenceLinkId_key" ON "benefit_evidence_links"("benefitDriverId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_assumption_links_benefitDriverId_assumptionId_key" ON "benefit_assumption_links"("benefitDriverId", "assumptionId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_evidence_links_riskId_evidenceLinkId_key" ON "risk_evidence_links"("riskId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "assumption_evidence_links_assumptionId_evidenceLinkId_key" ON "assumption_evidence_links"("assumptionId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_evidence_links_experimentId_evidenceLinkId_key" ON "experiment_evidence_links"("experimentId", "evidenceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_evaluations_blueprintId_key" ON "decision_evaluations"("blueprintId");

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

-- AddForeignKey
ALTER TABLE "opportunity_blueprints" ADD CONSTRAINT "opportunity_blueprints_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_customer_segments" ADD CONSTRAINT "blueprint_customer_segments_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_evidence_links" ADD CONSTRAINT "customer_segment_evidence_links_customerSegmentId_fkey" FOREIGN KEY ("customerSegmentId") REFERENCES "blueprint_customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_evidence_links" ADD CONSTRAINT "customer_segment_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_mvp_features" ADD CONSTRAINT "blueprint_mvp_features_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_competitors" ADD CONSTRAINT "blueprint_competitors_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_evidence_links" ADD CONSTRAINT "competitor_evidence_links_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "blueprint_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_evidence_links" ADD CONSTRAINT "competitor_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_scenarios" ADD CONSTRAINT "financial_scenarios_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_evidence_links" ADD CONSTRAINT "cost_evidence_links_costLineItemId_fkey" FOREIGN KEY ("costLineItemId") REFERENCES "cost_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_evidence_links" ADD CONSTRAINT "cost_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_assumption_links" ADD CONSTRAINT "cost_assumption_links_costLineItemId_fkey" FOREIGN KEY ("costLineItemId") REFERENCES "cost_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_assumption_links" ADD CONSTRAINT "cost_assumption_links_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "blueprint_assumptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_drivers" ADD CONSTRAINT "benefit_drivers_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_evidence_links" ADD CONSTRAINT "benefit_evidence_links_benefitDriverId_fkey" FOREIGN KEY ("benefitDriverId") REFERENCES "benefit_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_evidence_links" ADD CONSTRAINT "benefit_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_assumption_links" ADD CONSTRAINT "benefit_assumption_links_benefitDriverId_fkey" FOREIGN KEY ("benefitDriverId") REFERENCES "benefit_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_assumption_links" ADD CONSTRAINT "benefit_assumption_links_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "blueprint_assumptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_risks" ADD CONSTRAINT "blueprint_risks_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evidence_links" ADD CONSTRAINT "risk_evidence_links_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "blueprint_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evidence_links" ADD CONSTRAINT "risk_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_assumptions" ADD CONSTRAINT "blueprint_assumptions_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumption_evidence_links" ADD CONSTRAINT "assumption_evidence_links_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "blueprint_assumptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumption_evidence_links" ADD CONSTRAINT "assumption_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_experiments" ADD CONSTRAINT "validation_experiments_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_evidence_links" ADD CONSTRAINT "experiment_evidence_links_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "validation_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_evidence_links" ADD CONSTRAINT "experiment_evidence_links_evidenceLinkId_fkey" FOREIGN KEY ("evidenceLinkId") REFERENCES "evidence_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evaluations" ADD CONSTRAINT "decision_evaluations_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

