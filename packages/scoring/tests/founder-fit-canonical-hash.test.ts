import { describe, it, expect } from "vitest";
import { calculateFounderFit } from "../src/founder-fit/calculator.js";
import {
  buildCanonicalFounderFitPayload,
  computeCanonicalInputHash,
  computeScoringPolicyFingerprint,
} from "../src/founder-fit/canonical-hash.js";
import {
  FounderProfileData,
  OpportunityFounderRequirementsData,
} from "@buildworth/shared";

describe("Founder Fit Deterministic Calculator & Canonical SHA-256 Input Hash Tests (v2.0.1)", () => {
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

  it("1. Identical canonical inputs produce the exact same hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    const h1 = computeCanonicalInputHash(p1);
    const h2 = computeCanonicalInputHash(p2);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("2. Different object key order produces the exact same hash", () => {
    const p = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    const scrambled: any = {
      calculatorVersion: p.calculatorVersion,
      scoringPolicyHash: p.scoringPolicyHash,
      hashSchemaVersion: p.hashSchemaVersion,
      opportunityScore: p.opportunityScore,
      rubricVersion: p.rubricVersion,
      profileInputs: p.profileInputs,
      rankingVersion: p.rankingVersion,
      taxonomyVersion: p.taxonomyVersion,
      profileRevisionId: p.profileRevisionId,
      profileRevisionInputHash: p.profileRevisionInputHash,
      opportunityRevisionId: p.opportunityRevisionId,
      opportunityBlueprintId: p.opportunityBlueprintId,
      requirementsSchemaVersion: p.requirementsSchemaVersion,
      evidenceConfidence: p.evidenceConfidence,
      publicationQualityStatus: p.publicationQualityStatus,
      canonicalDecisionRecommendation: p.canonicalDecisionRecommendation,
      requirementsInputs: p.requirementsInputs,
    };

    expect(computeCanonicalInputHash(scrambled)).toBe(computeCanonicalInputHash(p));
  });

  it("3. Different ordering of logically unordered skills produces the exact same hash", () => {
    const profileReordered: FounderProfileData = {
      ...mockProfile,
      skills: [
        { skillKey: "DEVOPS", proficiency: "WORKING" },
        { skillKey: "TYPESCRIPT", proficiency: "EXPERT", isPrimary: true },
        { skillKey: "REACT", proficiency: "ADVANCED" },
        { skillKey: "POSTGRESQL", proficiency: "WORKING" },
      ],
    };

    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(profileReordered, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(computeCanonicalInputHash(p1)).toBe(computeCanonicalInputHash(p2));
  });

  it("4. Changing profile revision changes the hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { profileRevisionId: "rev-1" });

    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { profileRevisionId: "rev-2" });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("5. Changing opportunity revision changes the hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { opportunityRevisionId: "opp-rev-1" });

    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { opportunityRevisionId: "opp-rev-2" });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("6. Changing one proficiency level changes the hash", () => {
    const profileModified: FounderProfileData = {
      ...mockProfile,
      skills: [
        { skillKey: "TYPESCRIPT", proficiency: "ADVANCED", isPrimary: true }, // changed from EXPERT
        { skillKey: "REACT", proficiency: "ADVANCED" },
        { skillKey: "POSTGRESQL", proficiency: "WORKING" },
        { skillKey: "DEVOPS", proficiency: "WORKING" },
      ],
    };

    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(profileModified, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("7. Changing evidence confidence changes the hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 50,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("8. Changing requirements constraints changes the hash", () => {
    const reqModified: OpportunityFounderRequirementsData = {
      ...soc2Requirements,
      requiredRegulatoryRiskLevel: "HIGH",
    };

    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(mockProfile, reqModified, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("9. Changing rubric or ranking version changes the hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { rubricVersion: "2.0.0" });

    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, { rubricVersion: "2.1.0" });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("10. Two different input sets that produce identical final scores still produce different hashes", () => {
    const profileA: FounderProfileData = {
      ...mockProfile,
      constraints: {
        ...mockProfile.constraints,
        mvpBudgetBand: "USD_5K_TO_20K",
      },
    };
    const profileB: FounderProfileData = {
      ...mockProfile,
      constraints: {
        ...mockProfile.constraints,
        mvpBudgetBand: "USD_20K_TO_50K",
      },
    };

    const resA = calculateFounderFit(profileA, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const resB = calculateFounderFit(profileB, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });

    expect(resA.founderFitScore).toBe(resB.founderFitScore);
    expect(resA.personalizedRank).toBe(resB.personalizedRank);
    expect(resA.inputHash).not.toBe(resB.inputHash);
  });

  it("11. Hash output matches /^[a-f0-9]{64}$/", () => {
    const res = calculateFounderFit(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    expect(res.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.inputHash.length).toBe(64);
  });

  it("12. Raw email, session token and sensitive data are absent from the canonical payload", () => {
    const payload = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain("verified.founder@buildworth.io");
    expect(json).not.toContain("buildworth_session");
    expect(json).not.toContain("auth=verified");
    expect(json).not.toContain("sessionToken");
  });

  it("13. Changing scoring policy parameters changes the canonical input hash", () => {
    const p1 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const p2 = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    }, {
      scoringPolicyHash: "1111111111111111111111111111111111111111111111111111111111111111",
    });

    expect(computeCanonicalInputHash(p1)).not.toBe(computeCanonicalInputHash(p2));
  });

  it("14. profileRevisionInputHash, scoringPolicyHash, and inputHash are all valid 64-char hex strings", () => {
    const p = buildCanonicalFounderFitPayload(mockProfile, soc2Requirements, {
      opportunityScore: 89,
      evidenceConfidence: 82,
      publicationQualityStatus: "VERIFIED",
      decisionRecommendation: "BUILD_CANDIDATE",
    });
    const hash = computeCanonicalInputHash(p);

    expect(p.profileRevisionInputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(p.scoringPolicyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
