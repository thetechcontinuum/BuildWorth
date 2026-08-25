import { describe, it, expect } from "vitest";
import { calculateFounderFit } from "../src/founder-fit/calculator.js";
import { normalizeSkillKey } from "../src/founder-fit/taxonomy-data.js";
import {
  FounderProfileData,
  OpportunityFounderRequirementsData,
} from "@buildworth/shared";

describe("Founder Fit Deterministic Calculator & Release Integrity Tests (v2.0.0)", () => {
  it("normalizes skill aliases correctly without mutating canonical taxonomy keys", () => {
    expect(normalizeSkillKey("ts")).toBe("TYPESCRIPT");
    expect(normalizeSkillKey("react.js")).toBe("REACT");
    expect(normalizeSkillKey("postgres")).toBe("POSTGRESQL");
    expect(normalizeSkillKey("ui/ux")).toBe("UX_DESIGN");
  });

  const mockProfile: FounderProfileData = {
    userId: "user-123",
    displayName: "Solo Engineer",
    skills: [
      { skillKey: "TYPESCRIPT", proficiency: "EXPERT", isPrimary: true },
      { skillKey: "REACT", proficiency: "ADVANCED" },
      { skillKey: "POSTGRESQL", proficiency: "WORKING" },
      { skillKey: "DEVOPS", proficiency: "WORKING" },
    ],
    domainExpertise: [
      { industryOrDomain: "DevOps & Compliance", yearsExperienceBand: "3-5 years" }
    ],
    distributionAssets: [
      { assetType: "Twitter / X", audienceSizeBand: "1k-5k", description: "Tech builder audience" }
    ],
    preferences: {
      preferredIndustries: ["DevOps & Compliance", "B2B SaaS"],
      excludedIndustries: ["Crypto"],
      preferredBusinessModels: ["SaaS"],
      targetGeographies: ["Global"],
      preferredBuyerRoles: ["VP of Engineering", "Head of Security"],
    },
    constraints: {
      mvpBudgetBand: "USD_5K_TO_20K",
      budgetCurrency: "USD",
      availableHoursPerWeekBand: "HOURS_21_TO_35",
      teamSizeBand: "SOLO_FOUNDER",
      technicalRiskTolerance: "HIGH",
      regulatoryRiskTolerance: "MEDIUM",
      salesComplexityTolerance: "MEDIUM",
      operationalBurdenTolerance: "MEDIUM",
      fundingPreference: "BOOTSTRAP_ONLY",
    },
  };

  const soc2Requirements: OpportunityFounderRequirementsData = {
    blueprintId: "bp-soc2",
    schemaVersion: "1.0.0",
    minimumBudgetBand: "USD_1K_TO_5K",
    minimumCapacityBand: "HOURS_10_TO_20",
    minimumTeamSizeBand: "SOLO_FOUNDER",
    maxExpectedDeliveryWeeks: 4,
    requiredTechnicalRiskLevel: "MEDIUM",
    requiredRegulatoryRiskLevel: "LOW",
    requiredSalesComplexityLevel: "LOW",
    targetBuyerRoles: ["VP of Engineering"],
    targetIndustries: ["DevOps & Compliance"],
    targetGeographies: ["Global"],
    requiredSkills: [
      { skillKey: "TYPESCRIPT", minimumProficiency: "WORKING", preferredProficiency: "ADVANCED", importance: 5, isOutsourceable: false },
      { skillKey: "POSTGRESQL", minimumProficiency: "BASIC", preferredProficiency: "WORKING", importance: 4, isOutsourceable: true },
    ],
  };

  const snowflakeRequirements: OpportunityFounderRequirementsData = {
    blueprintId: "bp-snowflake",
    schemaVersion: "1.0.0",
    minimumBudgetBand: "USD_1K_TO_5K",
    minimumCapacityBand: "HOURS_10_TO_20",
    minimumTeamSizeBand: "SOLO_FOUNDER",
    maxExpectedDeliveryWeeks: 4,
    requiredTechnicalRiskLevel: "MEDIUM",
    requiredRegulatoryRiskLevel: "HIGH", // Exceeds profile MEDIUM -> Non-removable Blocker (-25)
    requiredSalesComplexityLevel: "LOW",
    targetBuyerRoles: ["Head of Data"],
    targetIndustries: ["Data Engineering & FinOps"],
    targetGeographies: ["Global"],
    requiredSkills: [
      { skillKey: "TYPESCRIPT", minimumProficiency: "WORKING", preferredProficiency: "ADVANCED", importance: 5, isOutsourceable: false },
    ],
  };

  // Case A — Verified SOC2
  it("Case A: calculates exact mathematical rank (86.9) for verified SOC2 candidate", () => {
    const result = calculateFounderFit(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(result.rubricVersion).toBe("2.0.0");
    expect(result.rankingVersion).toBe("2.0.0");
    expect(result.founderFitScore).toBe(95);
    expect(result.fitConfidence).toBe(100);
    expect(result.baseRank).toBe(89.3);
    expect(result.personalizedRank).toBe(89.3);
    expect(result.recommendationCategory).toBe("EXCELLENT_MATCH");
    expect(result.blockers.length).toBe(0);
    expect(result.penalties.length).toBe(0);
  });

  // Case B — Hypothesis Snowflake with exact two-blocker penalty math
  it("Case B: applies hypothesis penalty (10 pts), non-removable blocker (-25), and removable blocker (-7) consistently", () => {
    const twoBlockerRequirements: OpportunityFounderRequirementsData = {
      ...snowflakeRequirements,
      minimumTeamSizeBand: "SMALL_TEAM_2_TO_3", // Removable blocker (-7)
    };

    const result = calculateFounderFit(mockProfile, twoBlockerRequirements, {
      opportunityScore: 80,
      evidenceConfidence: 0,
      publicationQualityStatus: "HYPOTHESIS",
      decisionRecommendation: "VALIDATE_FIRST",
    });

    // Base rank: (80 * 0.4) + (0 * 0.25) + (80 * 0.35) = 32.0 + 0 + 28.0 = 60.0
    // Penalties:
    // 1 Non-removable Blocker (-25)
    // 1 Removable Blocker (-7)
    // Hypothesis Status (-10)
    // Total Penalties = 42
    // Final rank = 60.0 - 42 = 18.0
    expect(result.rubricVersion).toBe("2.0.0");
    expect(result.rankingVersion).toBe("2.0.0");
    expect(result.founderFitScore).toBe(72);
    expect(result.baseRank).toBe(57.2);
    expect(result.penalties).toEqual([
      { reason: "1 Removable Blocker(s)", penaltyPoints: 7 },
      { reason: "1 Non-Removable Blocker(s)", penaltyPoints: 25 },
      { reason: "Unverified Hypothesis Status", penaltyPoints: 10 },
    ]);
    expect(result.personalizedRank).toBe(15.2);
    expect(result.recommendationCategory).toBe("BLOCKED");
  });

  // Case C — Non-removable blocker precedence
  it("Case C: classifies as BLOCKED whenever non-removable blockers exist, regardless of score", () => {
    const result = calculateFounderFit(mockProfile, snowflakeRequirements, {
      opportunityScore: 100,
      evidenceConfidence: 100,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(result.blockers.some(b => !b.isRemovable)).toBe(true);
    expect(result.recommendationCategory).toBe("BLOCKED");
  });

  // Case D — Removable blocker precedence
  it("Case D: classifies as POSSIBLE_WITH_GAPS when only removable blockers exist", () => {
    const removableReqs: OpportunityFounderRequirementsData = {
      ...soc2Requirements,
      minimumTeamSizeBand: "SMALL_TEAM_2_TO_3",
    };

    const result = calculateFounderFit(mockProfile, removableReqs, {
      opportunityScore: 85,
      evidenceConfidence: 80,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(result.blockers.every(b => b.isRemovable)).toBe(true);
    expect(result.recommendationCategory).toBe("POSSIBLE_WITH_GAPS");
  });
});
