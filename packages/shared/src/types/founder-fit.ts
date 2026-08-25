export type ProficiencyLevel = "NONE" | "BASIC" | "WORKING" | "ADVANCED" | "EXPERT";

export type BudgetBand =
  | "UNDER_1K_USD"
  | "USD_1K_TO_5K"
  | "USD_5K_TO_20K"
  | "USD_20K_TO_50K"
  | "USD_50K_PLUS";

export type CapacityBand =
  | "UNDER_10_HOURS"
  | "HOURS_10_TO_20"
  | "HOURS_21_TO_35"
  | "HOURS_36_TO_40"
  | "OVER_40_HOURS";

export type TeamSizeBand =
  | "SOLO_FOUNDER"
  | "FOUNDER_PLUS_CONTRACTORS"
  | "SMALL_TEAM_2_TO_3"
  | "CORE_TEAM_4_PLUS";

export type RiskToleranceLevel = "LOW" | "MEDIUM" | "HIGH";

export type FundingPreference =
  | "BOOTSTRAP_ONLY"
  | "BOOTSTRAP_FIRST"
  | "OPEN_TO_FUNDING"
  | "VENTURE_SCALE";

export type FitRecommendationCategory =
  | "EXCELLENT_MATCH"
  | "STRONG_MATCH"
  | "POSSIBLE_MATCH"
  | "POSSIBLE_WITH_GAPS"
  | "CHALLENGING_MATCH"
  | "POOR_MATCH"
  | "BLOCKED"
  | "INSUFFICIENT_PROFILE_DATA";

export type HardBlockerCode =
  | "BUDGET_BELOW_MINIMUM"
  | "REQUIRED_SKILL_MISSING"
  | "CAPACITY_INSUFFICIENT"
  | "TEAM_SIZE_INSUFFICIENT"
  | "REGULATORY_RISK_REJECTED"
  | "TARGET_GEOGRAPHY_INACCESSIBLE"
  | "SALES_COMPLEXITY_REJECTED"
  | "REQUIRED_DATA_ACCESS_MISSING"
  | "FUNDING_MODEL_INCOMPATIBLE"
  | "SUPPORT_BURDEN_INCOMPATIBLE";

export interface SkillDefinitionData {
  key: string;
  displayName: string;
  category: string;
  description: string;
  aliases: string[];
  parentKey?: string;
  relatedKeys?: string[];
}

export interface FounderSkillInput {
  skillKey: string;
  proficiency: ProficiencyLevel;
  isPrimary?: boolean;
}

export interface FounderDomainExpertiseInput {
  industryOrDomain: string;
  yearsExperienceBand: string;
  workflowContext?: string;
}

export interface FounderDistributionAssetInput {
  assetType: string;
  audienceSizeBand?: string;
  description: string;
}

export interface FounderPreferenceInput {
  preferredIndustries: string[];
  excludedIndustries: string[];
  preferredBusinessModels: string[];
  targetGeographies: string[];
  preferredBuyerRoles: string[];
  preferredSalesMotion?: string;
}

export interface FounderConstraintInput {
  mvpBudgetBand: BudgetBand;
  budgetCurrency: string;
  availableHoursPerWeekBand: CapacityBand;
  teamSizeBand: TeamSizeBand;
  maxTimeToMvpWeeks?: number;
  technicalRiskTolerance: RiskToleranceLevel;
  regulatoryRiskTolerance: RiskToleranceLevel;
  salesComplexityTolerance: RiskToleranceLevel;
  operationalBurdenTolerance: RiskToleranceLevel;
  fundingPreference: FundingPreference;
}

export interface FounderProfileData {
  id?: string;
  userId: string;
  displayName?: string;
  preferredCurrency?: string;
  timezone?: string;
  skills: FounderSkillInput[];
  domainExpertise: FounderDomainExpertiseInput[];
  distributionAssets: FounderDistributionAssetInput[];
  preferences: FounderPreferenceInput;
  constraints: FounderConstraintInput;
}

export interface OpportunityRequiredSkillData {
  skillKey: string;
  minimumProficiency: ProficiencyLevel;
  preferredProficiency: ProficiencyLevel;
  importance: number; // 1-5
  isOutsourceable: boolean;
}

export interface OpportunityFounderRequirementsData {
  id?: string;
  blueprintId: string;
  schemaVersion: string;
  minimumBudgetBand: BudgetBand;
  minimumCapacityBand: CapacityBand;
  minimumTeamSizeBand: TeamSizeBand;
  maxExpectedDeliveryWeeks: number;
  requiredTechnicalRiskLevel: RiskToleranceLevel;
  requiredRegulatoryRiskLevel: RiskToleranceLevel;
  requiredSalesComplexityLevel: RiskToleranceLevel;
  targetBuyerRoles: string[];
  targetIndustries: string[];
  targetGeographies: string[];
  requiredSkills: OpportunityRequiredSkillData[];
}

export interface DimensionScoreBreakdown {
  name: string;
  score: number;
  maxScore: number;
  status: "CALCULATED" | "NOT_ENOUGH_PROFILE_DATA" | "NOT_ENOUGH_OPPORTUNITY_DATA" | "NOT_APPLICABLE";
  explanation: string;
  matchedRequirements: string[];
  missingRequirements: string[];
}

export interface HardBlockerDetail {
  code: HardBlockerCode;
  severity: "CRITICAL" | "HIGH";
  explanation: string;
  sourceRequirement: string;
  profileConstraint: string;
  isRemovable: boolean;
  suggestedMitigation?: string;
}

export interface FitStrength {
  title: string;
  description: string;
  category: "CAPABILITY" | "DOMAIN" | "DISTRIBUTION" | "RESOURCE";
}

export interface FitGap {
  title: string;
  description: string;
  severity: "CRITICAL" | "MODERATE" | "LOW";
  mitigationSuggestion: string;
}

export interface FounderFitEvaluationResult {
  founderFitScore: number; // 0-100
  fitConfidence: number; // 0-100
  recommendationCategory: FitRecommendationCategory;
  personalizedRank: number; // 0-100
  baseRank: number;
  penalties: Array<{ reason: string; penaltyPoints: number }>;
  dimensions: DimensionScoreBreakdown[];
  blockers: HardBlockerDetail[];
  strengths: FitStrength[];
  gaps: FitGap[];
  rubricVersion: string;
  rankingVersion: string;
  taxonomyVersion: string;
  inputHash: string;
  calculatedAt: string;
}
