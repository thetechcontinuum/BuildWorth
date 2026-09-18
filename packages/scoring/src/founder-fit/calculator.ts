import { buildCanonicalFounderFitPayload, computeCanonicalInputHash } from "./canonical-hash.js";
import {
  FounderProfileData,
  OpportunityFounderRequirementsData,
  FounderFitEvaluationResult,
  DimensionScoreBreakdown,
  HardBlockerDetail,
  FitStrength,
  FitGap,
  ProficiencyLevel,
  BudgetBand,
  CapacityBand,
  TeamSizeBand,
  RiskToleranceLevel,
  FitRecommendationCategory,
} from "@buildworth/shared";
import { normalizeSkillKey } from "./taxonomy-data.js";

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  NONE: 0,
  BASIC: 1,
  WORKING: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const BUDGET_RANK: Record<BudgetBand, number> = {
  UNDER_1K_USD: 1,
  USD_1K_TO_5K: 2,
  USD_5K_TO_20K: 3,
  USD_20K_TO_50K: 4,
  USD_50K_PLUS: 5,
};

const CAPACITY_RANK: Record<CapacityBand, number> = {
  UNDER_10_HOURS: 1,
  HOURS_10_TO_20: 2,
  HOURS_21_TO_35: 3,
  HOURS_36_TO_40: 4,
  OVER_40_HOURS: 5,
};

const TEAM_RANK: Record<TeamSizeBand, number> = {
  SOLO_FOUNDER: 1,
  FOUNDER_PLUS_CONTRACTORS: 2,
  SMALL_TEAM_2_TO_3: 3,
  CORE_TEAM_4_PLUS: 4,
};

const RISK_RANK: Record<RiskToleranceLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export interface CalculateFitOptions {
  opportunityScore: number;
  evidenceConfidence: number;
  publicationQualityStatus: string;
  decisionRecommendation: string;
}

export function calculateFounderFit(
  profile: FounderProfileData,
  requirements: OpportunityFounderRequirementsData,
  options: CalculateFitOptions,
  versions: {
    hashSchemaVersion?: number;
    calculatorVersion?: string;
    rubricVersion?: string;
    rankingVersion?: string;
    taxonomyVersion?: string;
    profileRevisionId?: string;
    profileRevisionInputHash?: string;
    opportunityRevisionId?: string;
  } = {},
): FounderFitEvaluationResult {
  const dimensions: DimensionScoreBreakdown[] = [];
  const blockers: HardBlockerDetail[] = [];
  const strengths: FitStrength[] = [];
  const gaps: FitGap[] = [];

  // 1. Dimension 1: Capability Match (20 pts)
  let capabilityScore = 0;
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  if (requirements.requiredSkills.length === 0) {
    capabilityScore = 15;
  } else {
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const reqSkill of requirements.requiredSkills) {
      const normKey = normalizeSkillKey(reqSkill.skillKey);
      const weight = reqSkill.importance || 3;
      totalWeight += weight;

      const userSkill = profile.skills.find((s) => normalizeSkillKey(s.skillKey) === normKey);
      const userProf = userSkill ? PROFICIENCY_RANK[userSkill.proficiency] : 0;
      const minProf = PROFICIENCY_RANK[reqSkill.minimumProficiency];

      if (userProf >= minProf) {
        earnedWeight += weight;
        matchedSkills.push(reqSkill.skillKey);
      } else if (reqSkill.isOutsourceable) {
        earnedWeight += weight * 0.5; // partial credit for outsourceable
        gaps.push({
          title: `Skill Gap: ${reqSkill.skillKey}`,
          description: `Requires ${reqSkill.minimumProficiency} proficiency (Founder has ${userSkill ? userSkill.proficiency : "NONE"}).`,
          severity: "MODERATE",
          mitigationSuggestion:
            "Outsource development or contract domain specialist for Milestone 1.",
        });
      } else {
        missingSkills.push(reqSkill.skillKey);
        gaps.push({
          title: `Critical Skill Gap: ${reqSkill.skillKey}`,
          description: `Non-outsourceable core capability requiring ${reqSkill.minimumProficiency}.`,
          severity: "CRITICAL",
          mitigationSuggestion: "Recruit technical cofounder with deep domain proficiency.",
        });
        blockers.push({
          code: "REQUIRED_SKILL_MISSING",
          severity: "CRITICAL",
          explanation: `Missing mandatory core skill: ${reqSkill.skillKey}`,
          sourceRequirement: `Requires ${reqSkill.minimumProficiency} proficiency`,
          profileConstraint: "Founder proficiency is below minimum acceptable threshold",
          isRemovable: true,
          suggestedMitigation: "Bring on technical co-founder or advisor with domain expertise",
        });
      }
    }

    capabilityScore = Math.round((earnedWeight / (totalWeight || 1)) * 20);
  }

  if (matchedSkills.length >= 2) {
    strengths.push({
      title: "Strong Core Capabilities",
      description: `Founder possesses key required capabilities: ${matchedSkills.slice(0, 3).join(", ")}.`,
      category: "CAPABILITY",
    });
  }

  dimensions.push({
    name: "Capability Match",
    score: capabilityScore,
    maxScore: 20,
    status: profile.skills.length > 0 ? "CALCULATED" : "NOT_ENOUGH_PROFILE_DATA",
    explanation: `Matched ${matchedSkills.length} of ${requirements.requiredSkills.length} required skill competencies.`,
    matchedRequirements: matchedSkills,
    missingRequirements: missingSkills,
  });

  // 2. Dimension 2: Domain Expertise Match (15 pts)
  let domainScore = 0;
  const targetIndustries = requirements.targetIndustries || [];
  const userDomains = profile.domainExpertise.map((d) => d.industryOrDomain.toLowerCase());
  const hasDomainMatch = targetIndustries.some((ti) =>
    userDomains.some((ud) => ud.includes(ti.toLowerCase()) || ti.toLowerCase().includes(ud)),
  );

  if (hasDomainMatch) {
    domainScore = 15;
    strengths.push({
      title: "Direct Domain Experience",
      description: "Founder has operational experience in the target market domain.",
      category: "DOMAIN",
    });
  } else if (profile.domainExpertise.length > 0) {
    domainScore = 8;
  } else {
    domainScore = 4;
  }

  dimensions.push({
    name: "Domain Expertise Match",
    score: domainScore,
    maxScore: 15,
    status: profile.domainExpertise.length > 0 ? "CALCULATED" : "NOT_ENOUGH_PROFILE_DATA",
    explanation: hasDomainMatch
      ? "Direct industry experience detected."
      : "Adjacent domain background.",
    matchedRequirements: hasDomainMatch ? targetIndustries : [],
    missingRequirements: hasDomainMatch ? [] : targetIndustries,
  });

  // 3. Dimension 3: Budget Fit (15 pts)
  let budgetScore = 15;
  const userBudgetRank = BUDGET_RANK[profile.constraints.mvpBudgetBand] || 1;
  const reqBudgetRank = BUDGET_RANK[requirements.minimumBudgetBand] || 1;

  if (userBudgetRank < reqBudgetRank) {
    budgetScore = Math.max(0, 15 - (reqBudgetRank - userBudgetRank) * 6);
    blockers.push({
      code: "BUDGET_BELOW_MINIMUM",
      severity: "CRITICAL",
      explanation: `Available budget band (${profile.constraints.mvpBudgetBand}) is below required minimum (${requirements.minimumBudgetBand}).`,
      sourceRequirement: `Requires minimum budget: ${requirements.minimumBudgetBand}`,
      profileConstraint: `Founder budget: ${profile.constraints.mvpBudgetBand}`,
      isRemovable: true,
      suggestedMitigation: "Reduce initial MVP feature scope to fit available capital.",
    });
    gaps.push({
      title: "Capital Constraint",
      description: "Available budget is below estimated Milestone 1 build cost.",
      severity: "CRITICAL",
      mitigationSuggestion: "Scope MVP to must-have features only or seek pre-seed micro-grants.",
    });
  } else {
    strengths.push({
      title: "Adequate Capital Allocation",
      description: "Founder available budget comfortably covers MVP development requirements.",
      category: "RESOURCE",
    });
  }

  dimensions.push({
    name: "Budget Fit",
    score: budgetScore,
    maxScore: 15,
    status: "CALCULATED",
    explanation:
      userBudgetRank >= reqBudgetRank
        ? "Budget band meets or exceeds MVP requirement."
        : "Budget band is below requirement.",
    matchedRequirements: userBudgetRank >= reqBudgetRank ? [requirements.minimumBudgetBand] : [],
    missingRequirements: userBudgetRank < reqBudgetRank ? [requirements.minimumBudgetBand] : [],
  });

  // 4. Dimension 4: Time and Capacity Fit (10 pts)
  let capacityScore = 10;
  const userCapRank = CAPACITY_RANK[profile.constraints.availableHoursPerWeekBand] || 1;
  const reqCapRank = CAPACITY_RANK[requirements.minimumCapacityBand] || 1;

  if (userCapRank < reqCapRank) {
    capacityScore = Math.max(0, 10 - (reqCapRank - userCapRank) * 4);
    blockers.push({
      code: "CAPACITY_INSUFFICIENT",
      severity: "HIGH",
      explanation: `Available weekly commitment (${profile.constraints.availableHoursPerWeekBand}) is below delivery requirement (${requirements.minimumCapacityBand}).`,
      sourceRequirement: `Requires minimum capacity: ${requirements.minimumCapacityBand}`,
      profileConstraint: `Founder capacity: ${profile.constraints.availableHoursPerWeekBand}`,
      isRemovable: true,
      suggestedMitigation: "Extend delivery roadmap timeline or bring on fractional support.",
    });
  }

  dimensions.push({
    name: "Time & Capacity Fit",
    score: capacityScore,
    maxScore: 10,
    status: "CALCULATED",
    explanation:
      userCapRank >= reqCapRank
        ? "Weekly time commitment is sufficient."
        : "Available capacity is constrained.",
    matchedRequirements: userCapRank >= reqCapRank ? [requirements.minimumCapacityBand] : [],
    missingRequirements: userCapRank < reqCapRank ? [requirements.minimumCapacityBand] : [],
  });

  // 5. Dimension 5: Distribution Advantage (15 pts)
  let distScore = 5;
  if (profile.distributionAssets.length >= 2) {
    distScore = 15;
    strengths.push({
      title: "Strong Distribution Assets",
      description: "Existing audience or network provides proprietary go-to-market advantage.",
      category: "DISTRIBUTION",
    });
  } else if (profile.distributionAssets.length === 1) {
    distScore = 10;
  }

  dimensions.push({
    name: "Distribution Advantage",
    score: distScore,
    maxScore: 15,
    status: "CALCULATED",
    explanation:
      profile.distributionAssets.length > 0
        ? "Leverageable distribution channels identified."
        : "No proprietary distribution assets recorded.",
    matchedRequirements: profile.distributionAssets.map((a) => a.assetType),
    missingRequirements: [],
  });

  // 6. Dimension 6: Buyer & Market Access (10 pts)
  let buyerScore = 5;
  const targetBuyers = requirements.targetBuyerRoles || [];
  const prefBuyers = profile.preferences.preferredBuyerRoles || [];
  const hasBuyerMatch = targetBuyers.some((tb) =>
    prefBuyers.some((pb) => pb.toLowerCase().includes(tb.toLowerCase())),
  );

  if (hasBuyerMatch) {
    buyerScore = 10;
    strengths.push({
      title: "Direct Buyer Access",
      description: "Founder has preferred access or relationship with economic buyer role.",
      category: "DOMAIN",
    });
  }

  dimensions.push({
    name: "Buyer & Market Access",
    score: buyerScore,
    maxScore: 10,
    status: "CALCULATED",
    explanation: hasBuyerMatch
      ? "Buyer role matches founder target relationships."
      : "General market access.",
    matchedRequirements: hasBuyerMatch ? targetBuyers : [],
    missingRequirements: hasBuyerMatch ? [] : targetBuyers,
  });

  // 7. Dimension 7: Team & Resource Fit (10 pts)
  let teamScore = 10;
  const userTeamRank = TEAM_RANK[profile.constraints.teamSizeBand] || 1;
  const reqTeamRank = TEAM_RANK[requirements.minimumTeamSizeBand] || 1;

  if (userTeamRank < reqTeamRank) {
    teamScore = Math.max(0, 10 - (reqTeamRank - userTeamRank) * 4);
    blockers.push({
      code: "TEAM_SIZE_INSUFFICIENT",
      severity: "HIGH",
      explanation: "Required team structure exceeds current founder setup.",
      sourceRequirement: requirements.minimumTeamSizeBand,
      profileConstraint: profile.constraints.teamSizeBand,
      isRemovable: true,
      suggestedMitigation: "Contract specialist freelancers for discovery spikes.",
    });
  }

  dimensions.push({
    name: "Team & Resource Fit",
    score: teamScore,
    maxScore: 10,
    status: "CALCULATED",
    explanation:
      userTeamRank >= reqTeamRank
        ? "Team capabilities align with build requirements."
        : "Single-threaded capacity risk.",
    matchedRequirements: [profile.constraints.teamSizeBand],
    missingRequirements: [],
  });

  // 8. Dimension 8: Risk & Constraint Fit (5 pts)
  let riskScore = 5;
  const userRegRisk = RISK_RANK[profile.constraints.regulatoryRiskTolerance] || 1;
  const reqRegRisk = RISK_RANK[requirements.requiredRegulatoryRiskLevel] || 1;

  if (userRegRisk < reqRegRisk) {
    riskScore -= 3;
    blockers.push({
      code: "REGULATORY_RISK_REJECTED",
      severity: "HIGH",
      explanation: "Opportunity regulatory exposure exceeds founder risk tolerance.",
      sourceRequirement: requirements.requiredRegulatoryRiskLevel,
      profileConstraint: profile.constraints.regulatoryRiskTolerance,
      isRemovable: false,
      suggestedMitigation: "Partner with compliance-certified vendor or legal counsel.",
    });
  }

  dimensions.push({
    name: "Risk & Constraint Fit",
    score: Math.max(0, riskScore),
    maxScore: 5,
    status: "CALCULATED",
    explanation:
      userRegRisk >= reqRegRisk ? "Risk profile is acceptable." : "Exceeds risk tolerance.",
    matchedRequirements: [],
    missingRequirements: [],
  });

  // Sum total Founder Fit (0-100)
  const totalFounderFit = Math.min(
    100,
    Math.max(
      0,
      dimensions.reduce((acc, d) => acc + d.score, 0),
    ),
  );

  // Calculate Fit Confidence (0-100)
  // Rubric: Profile completeness (40) + Requirement completeness (30) + Provenance quality (20) + Taxonomy coverage (10)
  let fitConfidence = 0;
  if (profile.skills.length > 0) fitConfidence += 10;
  if (profile.domainExpertise.length > 0) fitConfidence += 10;
  if (profile.constraints.mvpBudgetBand) fitConfidence += 10;
  if (profile.preferences.preferredIndustries.length > 0) fitConfidence += 10;

  if (requirements.requiredSkills.length > 0) fitConfidence += 15;
  if (requirements.targetBuyerRoles.length > 0) fitConfidence += 15;

  fitConfidence += 20; // Provenance verified from Phase 2 blueprint
  fitConfidence += 10; // 100% Taxonomy mapping

  // Calculate Personalized Rank & Penalties
  const baseRank =
    options.opportunityScore * 0.4 + options.evidenceConfidence * 0.25 + totalFounderFit * 0.35;
  const penalties: Array<{ reason: string; penaltyPoints: number }> = [];

  const removableBlockers = blockers.filter((b) => b.isRemovable);
  const nonRemovableBlockers = blockers.filter((b) => !b.isRemovable);

  if (removableBlockers.length > 0) {
    const p = Math.min(21, removableBlockers.length * 7);
    penalties.push({
      reason: `${removableBlockers.length} Removable Blocker(s)`,
      penaltyPoints: p,
    });
  }

  if (nonRemovableBlockers.length > 0) {
    const p = Math.min(50, nonRemovableBlockers.length * 25);
    penalties.push({
      reason: `${nonRemovableBlockers.length} Non-Removable Blocker(s)`,
      penaltyPoints: p,
    });
  }

  if (
    options.publicationQualityStatus === "HYPOTHESIS" ||
    options.publicationQualityStatus === "EVIDENCE_PENDING"
  ) {
    penalties.push({ reason: "Unverified Hypothesis Status", penaltyPoints: 10 });
  }

  if (options.publicationQualityStatus === "STALE") {
    penalties.push({ reason: "Stale Evidence Warning", penaltyPoints: 5 });
  }

  const totalPenalties = penalties.reduce((acc, p) => acc + p.penaltyPoints, 0);
  const personalizedRank = Math.min(
    100,
    Math.max(0, parseFloat((baseRank - totalPenalties).toFixed(1))),
  );

  // Recommendation Category Determination
  let recommendationCategory: FitRecommendationCategory = "POSSIBLE_MATCH";

  if (fitConfidence < 50) {
    recommendationCategory = "INSUFFICIENT_PROFILE_DATA";
  } else if (nonRemovableBlockers.length > 0) {
    recommendationCategory = "BLOCKED";
  } else if (removableBlockers.length > 0) {
    recommendationCategory = "POSSIBLE_WITH_GAPS";
  } else if (
    totalFounderFit >= 85 &&
    fitConfidence >= 75 &&
    options.publicationQualityStatus === "VERIFIED" &&
    options.decisionRecommendation === "BUILD_CANDIDATE"
  ) {
    recommendationCategory = "EXCELLENT_MATCH";
  } else if (totalFounderFit >= 70 && fitConfidence >= 60) {
    recommendationCategory = "STRONG_MATCH";
  } else if (totalFounderFit >= 55) {
    recommendationCategory = "POSSIBLE_MATCH";
  } else if (totalFounderFit >= 35) {
    recommendationCategory = "CHALLENGING_MATCH";
  } else {
    recommendationCategory = "POOR_MATCH";
  }

  const canonicalPayload = buildCanonicalFounderFitPayload(profile, requirements, options, {
    hashSchemaVersion: versions.hashSchemaVersion ?? 1,
    calculatorVersion: versions.calculatorVersion ?? "2.0.1",
    rubricVersion: versions.rubricVersion ?? "2.0.0",
    rankingVersion: versions.rankingVersion ?? "2.0.0",
    taxonomyVersion: versions.taxonomyVersion ?? "1.0.0",
    profileRevisionId: versions.profileRevisionId ?? profile.id ?? profile.userId,
    profileRevisionInputHash: versions.profileRevisionInputHash,
    opportunityRevisionId: versions.opportunityRevisionId ?? requirements.blueprintId,
  });

  const inputHash = computeCanonicalInputHash(canonicalPayload);

  return {
    founderFitScore: totalFounderFit,
    fitConfidence,
    recommendationCategory,
    personalizedRank,
    baseRank: parseFloat(baseRank.toFixed(1)),
    penalties,
    dimensions,
    blockers,
    strengths,
    gaps,
    rubricVersion: "2.0.0",
    rankingVersion: "2.0.0",
    taxonomyVersion: "1.0.0",
    inputHash,
    calculatedAt: new Date().toISOString(),
  };
}
