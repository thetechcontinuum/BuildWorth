import { describe, it, expect } from "vitest";
import {
  buildCanonicalFounderFitPayload,
  computeCanonicalInputHash,
  computeScoringPolicyFingerprint,
} from "../src/founder-fit/canonical-hash.js";
import { FounderProfileData, OpportunityFounderRequirementsData } from "@buildworth/shared";

describe("Founder Fit Non-Vacuous Evaluation Audit & Defect Cycle Proof", () => {
  const mockProfile: FounderProfileData = {
    userId: "user-audit-1",
    displayName: "Audit Founder",
    skills: [
      { skillKey: "TYPESCRIPT", proficiency: "EXPERT", isPrimary: true },
      { skillKey: "REACT", proficiency: "ADVANCED" },
    ],
    domainExpertise: [
      { industryOrDomain: "DevOps & Compliance", yearsExperienceBand: "3-5 years" },
    ],
    distributionAssets: [{ assetType: "Twitter / X", audienceSizeBand: "1k-5k" }],
    preferences: {
      preferredIndustries: ["DevOps & Compliance"],
      excludedIndustries: ["Crypto"],
      preferredBusinessModels: ["SaaS"],
      targetGeographies: ["Global"],
      preferredBuyerRoles: ["VP of Engineering"],
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

  const mockRequirements: OpportunityFounderRequirementsData = {
    blueprintId: "bp-soc2-audit",
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
      {
        skillKey: "TYPESCRIPT",
        minimumProficiency: "WORKING",
        preferredProficiency: "ADVANCED",
        importance: 5,
        isOutsourceable: false,
      },
    ],
  };

  function auditEvaluationRecords(evaluations: any[]): { exitCode: number; defects: string[] } {
    if (evaluations.length === 0) {
      return { exitCode: 1, defects: ["Strict Audit Failed: Zero evaluation records found."] };
    }

    const defects: string[] = [];

    for (const ev of evaluations) {
      // 1. Format check
      if (!/^[a-f0-9]{64}$/.test(ev.inputHash)) {
        defects.push(`[MALFORMED HASH] ${ev.inputHash}`);
      }

      // 2. Version check
      if (
        ev.rubricVersion !== "2.0.0" ||
        ev.rankingVersion !== "2.0.0" ||
        ev.calculatorVersion !== "2.0.1"
      ) {
        defects.push(
          `[OBSOLETE VERSION] Rubric: ${ev.rubricVersion}, Ranking: ${ev.rankingVersion}`,
        );
      }

      // 3. Hash recalculation verification
      if (ev.profile && ev.requirements) {
        const canonicalPayload = buildCanonicalFounderFitPayload(
          ev.profile,
          ev.requirements,
          ev.options,
          {
            rubricVersion: ev.rubricVersion,
            rankingVersion: ev.rankingVersion,
            calculatorVersion: ev.calculatorVersion,
            profileRevisionId: ev.profileRevisionId,
            profileRevisionInputHash: ev.profileRevisionInputHash,
            opportunityRevisionId: ev.opportunityRevisionId,
          },
        );

        const expectedHash = computeCanonicalInputHash(canonicalPayload);
        if (ev.inputHash !== expectedHash) {
          defects.push(`[HASH MISMATCH] Stored: ${ev.inputHash} != Expected: ${expectedHash}`);
        }
      }
    }

    return {
      exitCode: defects.length > 0 ? 1 : 0,
      defects,
    };
  }

  const baseOptions = {
    opportunityScore: 89,
    evidenceConfidence: 82,
    publicationQualityStatus: "VERIFIED",
    decisionRecommendation: "BUILD_CANDIDATE",
  };

  const validPayload = buildCanonicalFounderFitPayload(mockProfile, mockRequirements, baseOptions, {
    calculatorVersion: "2.0.1",
    rubricVersion: "2.0.0",
    rankingVersion: "2.0.0",
    profileRevisionId: "prev-1",
    profileRevisionInputHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    opportunityRevisionId: "opp-1",
  });
  const validHash = computeCanonicalInputHash(validPayload);

  const cleanRecord = {
    id: "eval-1",
    profileRevisionId: "prev-1",
    profileRevisionInputHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    opportunityRevisionId: "opp-1",
    rubricVersion: "2.0.0",
    rankingVersion: "2.0.0",
    calculatorVersion: "2.0.1",
    inputHash: validHash,
    profile: mockProfile,
    requirements: mockRequirements,
    options: baseOptions,
  };

  it("Step 1: Clean populated evaluation passes audit with exitCode 0", () => {
    const res = auditEvaluationRecords([cleanRecord]);
    expect(res.exitCode).toBe(0);
    expect(res.defects.length).toBe(0);
  });

  it("Step 2: Corrupted inputHash triggers defect with exitCode 1", () => {
    const corruptedRecord = {
      ...cleanRecord,
      inputHash: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    const res = auditEvaluationRecords([corruptedRecord]);
    expect(res.exitCode).toBe(1);
    expect(res.defects[0]).toContain("[HASH MISMATCH]");
  });

  it("Step 3: Restoring valid hash returns exitCode 0", () => {
    const res = auditEvaluationRecords([cleanRecord]);
    expect(res.exitCode).toBe(0);
  });

  it("Step 4: Changing source skill proficiency without updating evaluation triggers hash mismatch and exitCode 1", () => {
    const modifiedProfile: FounderProfileData = {
      ...mockProfile,
      skills: [
        { skillKey: "TYPESCRIPT", proficiency: "BASIC", isPrimary: true },
        { skillKey: "REACT", proficiency: "ADVANCED" },
      ],
    };
    const modifiedRecord = {
      ...cleanRecord,
      profile: modifiedProfile,
    };
    const res = auditEvaluationRecords([modifiedRecord]);
    expect(res.exitCode).toBe(1);
    expect(res.defects[0]).toContain("[HASH MISMATCH]");
  });

  it("Step 5: Restoring source skill input returns exitCode 0", () => {
    const res = auditEvaluationRecords([cleanRecord]);
    expect(res.exitCode).toBe(0);
  });

  it("Step 6: Inserting legacy det-r2-* synthetic identifier triggers malformed defect and exitCode 1", () => {
    const legacyRecord = {
      ...cleanRecord,
      inputHash: "det-r2-88-70-20.8",
    };
    const res = auditEvaluationRecords([legacyRecord]);
    expect(res.exitCode).toBe(1);
    expect(res.defects.some((d) => d.includes("[MALFORMED HASH]"))).toBe(true);
  });

  it("Step 7: Empty database in strict mode triggers exitCode 1", () => {
    const res = auditEvaluationRecords([]);
    expect(res.exitCode).toBe(1);
    expect(res.defects[0]).toContain("Zero evaluation records found");
  });
});
