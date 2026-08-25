-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('NONE', 'BASIC', 'WORKING', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "BudgetBand" AS ENUM ('UNDER_1K_USD', 'USD_1K_TO_5K', 'USD_5K_TO_20K', 'USD_20K_TO_50K', 'USD_50K_PLUS');

-- CreateEnum
CREATE TYPE "CapacityBand" AS ENUM ('UNDER_10_HOURS', 'HOURS_10_TO_20', 'HOURS_21_TO_35', 'HOURS_36_TO_40', 'OVER_40_HOURS');

-- CreateEnum
CREATE TYPE "TeamSizeBand" AS ENUM ('SOLO_FOUNDER', 'FOUNDER_PLUS_CONTRACTORS', 'SMALL_TEAM_2_TO_3', 'CORE_TEAM_4_PLUS');

-- CreateEnum
CREATE TYPE "RiskToleranceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FundingPreference" AS ENUM ('BOOTSTRAP_ONLY', 'BOOTSTRAP_FIRST', 'OPEN_TO_FUNDING', 'VENTURE_SCALE');

-- CreateEnum
CREATE TYPE "FitRecommendationCategory" AS ENUM ('EXCELLENT_MATCH', 'STRONG_MATCH', 'POSSIBLE_MATCH', 'CHALLENGING_MATCH', 'POOR_MATCH', 'INSUFFICIENT_PROFILE_DATA');

-- CreateEnum
CREATE TYPE "HardBlockerCode" AS ENUM ('BUDGET_BELOW_MINIMUM', 'REQUIRED_SKILL_MISSING', 'CAPACITY_INSUFFICIENT', 'TEAM_SIZE_INSUFFICIENT', 'REGULATORY_RISK_REJECTED', 'TARGET_GEOGRAPHY_INACCESSIBLE', 'SALES_COMPLEXITY_REJECTED', 'REQUIRED_DATA_ACCESS_MISSING', 'FUNDING_MODEL_INCOMPATIBLE', 'SUPPORT_BURDEN_INCOMPATIBLE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "skill_taxonomy_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_taxonomy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_definitions" (
    "id" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_aliases" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentProfileRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "founder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_profile_revisions" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_profile_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_skills" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "proficiency" "ProficiencyLevel" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_domain_expertise" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "industryOrDomain" TEXT NOT NULL,
    "yearsExperienceBand" TEXT NOT NULL,
    "workflowContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_domain_expertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_distribution_assets" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "audienceSizeBand" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_distribution_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_preferences" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "preferredIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredBusinessModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetGeographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredBuyerRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSalesMotion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_constraints" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "mvpBudgetBand" "BudgetBand" NOT NULL DEFAULT 'UNDER_1K_USD',
    "budgetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "availableHoursPerWeekBand" "CapacityBand" NOT NULL DEFAULT 'HOURS_10_TO_20',
    "teamSizeBand" "TeamSizeBand" NOT NULL DEFAULT 'SOLO_FOUNDER',
    "maxTimeToMvpWeeks" INTEGER,
    "technicalRiskTolerance" "RiskToleranceLevel" NOT NULL DEFAULT 'MEDIUM',
    "regulatoryRiskTolerance" "RiskToleranceLevel" NOT NULL DEFAULT 'LOW',
    "salesComplexityTolerance" "RiskToleranceLevel" NOT NULL DEFAULT 'LOW',
    "operationalBurdenTolerance" "RiskToleranceLevel" NOT NULL DEFAULT 'MEDIUM',
    "fundingPreference" "FundingPreference" NOT NULL DEFAULT 'BOOTSTRAP_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_founder_requirements" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "minimumBudgetBand" "BudgetBand" NOT NULL DEFAULT 'UNDER_1K_USD',
    "minimumCapacityBand" "CapacityBand" NOT NULL DEFAULT 'HOURS_10_TO_20',
    "minimumTeamSizeBand" "TeamSizeBand" NOT NULL DEFAULT 'SOLO_FOUNDER',
    "maxExpectedDeliveryWeeks" INTEGER NOT NULL DEFAULT 4,
    "requiredTechnicalRiskLevel" "RiskToleranceLevel" NOT NULL DEFAULT 'MEDIUM',
    "requiredRegulatoryRiskLevel" "RiskToleranceLevel" NOT NULL DEFAULT 'LOW',
    "requiredSalesComplexityLevel" "RiskToleranceLevel" NOT NULL DEFAULT 'LOW',
    "targetBuyerRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetGeographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_founder_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_required_skills" (
    "id" TEXT NOT NULL,
    "requirementsId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "minimumProficiency" "ProficiencyLevel" NOT NULL DEFAULT 'BASIC',
    "preferredProficiency" "ProficiencyLevel" NOT NULL DEFAULT 'WORKING',
    "importance" INTEGER NOT NULL DEFAULT 3,
    "isOutsourceable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_required_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_fit_evaluations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "opportunityRevisionId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "requirementsId" TEXT NOT NULL,
    "founderFitScore" INTEGER NOT NULL,
    "fitConfidence" INTEGER NOT NULL,
    "recommendationCategory" "FitRecommendationCategory" NOT NULL,
    "personalizedRank" DOUBLE PRECISION NOT NULL,
    "baseRank" DOUBLE PRECISION NOT NULL,
    "totalPenaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "rubricVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "rankingVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "taxonomyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "inputHash" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_fit_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_fit_dimensions" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "matchedRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_fit_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_fit_blockers" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "blockerCode" "HardBlockerCode" NOT NULL,
    "severity" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "sourceRequirement" TEXT NOT NULL,
    "profileConstraint" TEXT NOT NULL,
    "isRemovable" BOOLEAN NOT NULL DEFAULT false,
    "suggestedMitigation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_fit_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_fit_strengths" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_fit_strengths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_fit_gaps" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "mitigationSuggestion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_fit_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "skill_taxonomy_versions_version_key" ON "skill_taxonomy_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "skill_definitions_key_key" ON "skill_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "skill_aliases_alias_key" ON "skill_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "founder_profiles_userId_key" ON "founder_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "founder_profile_revisions_profileId_revisionNumber_key" ON "founder_profile_revisions"("profileId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "founder_skills_profileRevisionId_skillKey_key" ON "founder_skills"("profileRevisionId", "skillKey");

-- CreateIndex
CREATE UNIQUE INDEX "founder_preferences_profileRevisionId_key" ON "founder_preferences"("profileRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "founder_constraints_profileRevisionId_key" ON "founder_constraints"("profileRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_founder_requirements_blueprintId_key" ON "opportunity_founder_requirements"("blueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_required_skills_requirementsId_skillKey_key" ON "opportunity_required_skills"("requirementsId", "skillKey");

-- CreateIndex
CREATE UNIQUE INDEX "founder_fit_evaluations_profileRevisionId_opportunityRevisi_key" ON "founder_fit_evaluations"("profileRevisionId", "opportunityRevisionId", "rubricVersion", "rankingVersion");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_definitions" ADD CONSTRAINT "skill_definitions_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "skill_taxonomy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skill_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_profiles" ADD CONSTRAINT "founder_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_profile_revisions" ADD CONSTRAINT "founder_profile_revisions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "founder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_skills" ADD CONSTRAINT "founder_skills_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_skills" ADD CONSTRAINT "founder_skills_skillKey_fkey" FOREIGN KEY ("skillKey") REFERENCES "skill_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_domain_expertise" ADD CONSTRAINT "founder_domain_expertise_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_distribution_assets" ADD CONSTRAINT "founder_distribution_assets_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_preferences" ADD CONSTRAINT "founder_preferences_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_constraints" ADD CONSTRAINT "founder_constraints_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_founder_requirements" ADD CONSTRAINT "opportunity_founder_requirements_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_required_skills" ADD CONSTRAINT "opportunity_required_skills_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "opportunity_founder_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_required_skills" ADD CONSTRAINT "opportunity_required_skills_skillKey_fkey" FOREIGN KEY ("skillKey") REFERENCES "skill_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_evaluations" ADD CONSTRAINT "founder_fit_evaluations_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_evaluations" ADD CONSTRAINT "founder_fit_evaluations_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "opportunity_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_evaluations" ADD CONSTRAINT "founder_fit_evaluations_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "opportunity_founder_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_dimensions" ADD CONSTRAINT "founder_fit_dimensions_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "founder_fit_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_blockers" ADD CONSTRAINT "founder_fit_blockers_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "founder_fit_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_strengths" ADD CONSTRAINT "founder_fit_strengths_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "founder_fit_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_fit_gaps" ADD CONSTRAINT "founder_fit_gaps_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "founder_fit_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "founder_fit_evaluations" ADD CONSTRAINT "founder_fit_evaluations_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
