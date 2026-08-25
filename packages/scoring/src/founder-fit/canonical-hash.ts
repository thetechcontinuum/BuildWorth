import crypto from "crypto";
import {
  FounderProfileData,
  OpportunityFounderRequirementsData,
} from "@buildworth/shared";
import { CalculateFitOptions } from "./calculator.js";

export interface CanonicalScoringPolicy {
  opportunityWeight: number;
  evidenceConfidenceWeight: number;
  founderFitWeight: number;
  hypothesisPenaltyPoints: number;
  stalePenaltyPoints: number;
  removableBlockerPenaltyPerItem: number;
  removableBlockerMaxPenalty: number;
  nonRemovableBlockerPenaltyPerItem: number;
  nonRemovableBlockerMaxPenalty: number;
  recommendationThresholds: {
    excellentMatchMinScore: number;
    excellentMatchMinConfidence: number;
    strongMatchMinScore: number;
    strongMatchMinConfidence: number;
    possibleMatchMinScore: number;
    challengingMatchMinScore: number;
    insufficientDataConfidenceThreshold: number;
  };
  dimensionMaxScores: {
    capabilityMatch: number;
    domainExpertiseMatch: number;
    budgetFit: number;
    timeCapacityFit: number;
    distributionAdvantage: number;
    buyerMarketAccess: number;
    teamResourceFit: number;
    riskConstraintFit: number;
  };
  precedenceRules: {
    nonRemovableBlockerForcesBlocked: boolean;
    removableBlockerForcesPossibleWithGaps: boolean;
    hypothesisRequiresPendingEvidencePenalty: boolean;
    excellentMatchRequiresVerifiedAndBuildCandidate: boolean;
  };
}

export const CANONICAL_DEFAULT_SCORING_POLICY: CanonicalScoringPolicy = {
  opportunityWeight: 0.40,
  evidenceConfidenceWeight: 0.25,
  founderFitWeight: 0.35,
  hypothesisPenaltyPoints: 10,
  stalePenaltyPoints: 5,
  removableBlockerPenaltyPerItem: 7,
  removableBlockerMaxPenalty: 21,
  nonRemovableBlockerPenaltyPerItem: 25,
  nonRemovableBlockerMaxPenalty: 50,
  recommendationThresholds: {
    excellentMatchMinScore: 85,
    excellentMatchMinConfidence: 75,
    strongMatchMinScore: 70,
    strongMatchMinConfidence: 60,
    possibleMatchMinScore: 55,
    challengingMatchMinScore: 35,
    insufficientDataConfidenceThreshold: 50,
  },
  dimensionMaxScores: {
    capabilityMatch: 20,
    domainExpertiseMatch: 15,
    budgetFit: 15,
    timeCapacityFit: 10,
    distributionAdvantage: 15,
    buyerMarketAccess: 10,
    teamResourceFit: 10,
    riskConstraintFit: 5,
  },
  precedenceRules: {
    nonRemovableBlockerForcesBlocked: true,
    removableBlockerForcesPossibleWithGaps: true,
    hypothesisRequiresPendingEvidencePenalty: true,
    excellentMatchRequiresVerifiedAndBuildCandidate: true,
  },
};

function canonicalize(val: any): any {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sortedObj: Record<string, any> = {};
  const keys = Object.keys(val).sort();
  for (const key of keys) {
    sortedObj[key] = canonicalize(val[key]);
  }
  return sortedObj;
}

export function computeScoringPolicyFingerprint(policy: CanonicalScoringPolicy = CANONICAL_DEFAULT_SCORING_POLICY): string {
  const json = JSON.stringify(canonicalize(policy));
  return crypto.createHash("sha256").update(json, "utf8").digest("hex");
}

export interface CanonicalFounderFitPayload {
  hashSchemaVersion: number;
  calculatorVersion: string;
  rubricVersion: string;
  rankingVersion: string;
  taxonomyVersion: string;
  scoringPolicyHash: string;
  profileRevisionId: string;
  profileRevisionInputHash: string;
  opportunityRevisionId: string;
  opportunityBlueprintId: string;
  requirementsSchemaVersion: string;
  opportunityScore: number;
  evidenceConfidence: number;
  publicationQualityStatus: string;
  canonicalDecisionRecommendation: string;
  profileInputs: {
    skills: Array<{ skillKey: string; proficiency: string; isPrimary: boolean }>;
    domainExpertise: Array<{ industryOrDomain: string; yearsExperienceBand: string }>;
    distributionAssets: Array<{ assetType: string; audienceSizeBand: string }>;
    preferences: {
      preferredIndustries: string[];
      excludedIndustries: string[];
      preferredBusinessModels: string[];
      targetGeographies: string[];
      preferredBuyerRoles: string[];
    };
    constraints: {
      mvpBudgetBand: string;
      budgetCurrency: string;
      availableHoursPerWeekBand: string;
      teamSizeBand: string;
      technicalRiskTolerance: string;
      regulatoryRiskTolerance: string;
      salesComplexityTolerance: string;
      operationalBurdenTolerance: string;
      fundingPreference: string;
    };
  };
  requirementsInputs: {
    minimumBudgetBand: string;
    minimumCapacityBand: string;
    minimumTeamSizeBand: string;
    maxExpectedDeliveryWeeks: number;
    requiredTechnicalRiskLevel: string;
    requiredRegulatoryRiskLevel: string;
    requiredSalesComplexityLevel: string;
    targetBuyerRoles: string[];
    targetIndustries: string[];
    targetGeographies: string[];
    requiredSkills: Array<{
      skillKey: string;
      minimumProficiency: string;
      preferredProficiency: string;
      importance: number;
      isOutsourceable: boolean;
    }>;
  };
}

export function buildCanonicalFounderFitPayload(
  profile: FounderProfileData,
  requirements: OpportunityFounderRequirementsData,
  options: CalculateFitOptions,
  versions: {
    hashSchemaVersion?: number;
    calculatorVersion?: string;
    rubricVersion?: string;
    rankingVersion?: string;
    taxonomyVersion?: string;
    scoringPolicyHash?: string;
    profileRevisionId?: string;
    profileRevisionInputHash?: string;
    opportunityRevisionId?: string;
  } = {}
): CanonicalFounderFitPayload {
  const sortedSkills = [...profile.skills]
    .map(s => ({
      skillKey: s.skillKey.toUpperCase(),
      proficiency: s.proficiency,
      isPrimary: !!s.isPrimary,
    }))
    .sort((a, b) => a.skillKey.localeCompare(b.skillKey));

  const sortedDomain = [...profile.domainExpertise]
    .map(d => ({
      industryOrDomain: d.industryOrDomain,
      yearsExperienceBand: d.yearsExperienceBand,
    }))
    .sort((a, b) => a.industryOrDomain.localeCompare(b.industryOrDomain));

  const sortedAssets = [...profile.distributionAssets]
    .map(a => ({
      assetType: a.assetType,
      audienceSizeBand: a.audienceSizeBand || "",
    }))
    .sort((a, b) => a.assetType.localeCompare(b.assetType));

  const sortedReqSkills = [...requirements.requiredSkills]
    .map(s => ({
      skillKey: s.skillKey.toUpperCase(),
      minimumProficiency: s.minimumProficiency,
      preferredProficiency: s.preferredProficiency,
      importance: s.importance,
      isOutsourceable: s.isOutsourceable,
    }))
    .sort((a, b) => a.skillKey.localeCompare(b.skillKey));

  const defaultProfileHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  return {
    hashSchemaVersion: versions.hashSchemaVersion ?? 1,
    calculatorVersion: versions.calculatorVersion ?? "2.0.1",
    rubricVersion: versions.rubricVersion ?? "2.0.0",
    rankingVersion: versions.rankingVersion ?? "2.0.0",
    taxonomyVersion: versions.taxonomyVersion ?? "1.0.0",
    scoringPolicyHash: versions.scoringPolicyHash ?? computeScoringPolicyFingerprint(),
    profileRevisionId: versions.profileRevisionId ?? profile.id ?? profile.userId ?? "prof-rev-default",
    profileRevisionInputHash: versions.profileRevisionInputHash ?? defaultProfileHash,
    opportunityRevisionId: versions.opportunityRevisionId ?? requirements.blueprintId ?? "opp-rev-default",
    opportunityBlueprintId: requirements.blueprintId,
    requirementsSchemaVersion: requirements.schemaVersion || "1.0.0",
    opportunityScore: Math.round(options.opportunityScore),
    evidenceConfidence: Math.round(options.evidenceConfidence),
    publicationQualityStatus: options.publicationQualityStatus,
    canonicalDecisionRecommendation: options.decisionRecommendation,
    profileInputs: {
      skills: sortedSkills,
      domainExpertise: sortedDomain,
      distributionAssets: sortedAssets,
      preferences: {
        preferredIndustries: [...profile.preferences.preferredIndustries].sort(),
        excludedIndustries: [...profile.preferences.excludedIndustries].sort(),
        preferredBusinessModels: [...profile.preferences.preferredBusinessModels].sort(),
        targetGeographies: [...profile.preferences.targetGeographies].sort(),
        preferredBuyerRoles: [...profile.preferences.preferredBuyerRoles].sort(),
      },
      constraints: {
        mvpBudgetBand: profile.constraints.mvpBudgetBand,
        budgetCurrency: profile.constraints.budgetCurrency || "USD",
        availableHoursPerWeekBand: profile.constraints.availableHoursPerWeekBand,
        teamSizeBand: profile.constraints.teamSizeBand,
        technicalRiskTolerance: profile.constraints.technicalRiskTolerance,
        regulatoryRiskTolerance: profile.constraints.regulatoryRiskTolerance,
        salesComplexityTolerance: profile.constraints.salesComplexityTolerance,
        operationalBurdenTolerance: profile.constraints.operationalBurdenTolerance,
        fundingPreference: profile.constraints.fundingPreference,
      },
    },
    requirementsInputs: {
      minimumBudgetBand: requirements.minimumBudgetBand,
      minimumCapacityBand: requirements.minimumCapacityBand,
      minimumTeamSizeBand: requirements.minimumTeamSizeBand,
      maxExpectedDeliveryWeeks: requirements.maxExpectedDeliveryWeeks,
      requiredTechnicalRiskLevel: requirements.requiredTechnicalRiskLevel,
      requiredRegulatoryRiskLevel: requirements.requiredRegulatoryRiskLevel,
      requiredSalesComplexityLevel: requirements.requiredSalesComplexityLevel,
      targetBuyerRoles: [...requirements.targetBuyerRoles].sort(),
      targetIndustries: [...requirements.targetIndustries].sort(),
      targetGeographies: [...requirements.targetGeographies].sort(),
      requiredSkills: sortedReqSkills,
    },
  };
}

export function computeCanonicalInputHash(payload: CanonicalFounderFitPayload): string {
  const canonicalObj = canonicalize(payload);
  const jsonStr = JSON.stringify(canonicalObj);
  return crypto.createHash("sha256").update(jsonStr, "utf8").digest("hex");
}
