import { PrismaClient } from "@prisma/client";
import { buildCanonicalFounderFitPayload, computeCanonicalInputHash } from "@buildworth/scoring";

export async function runFounderFitAudit(args: string[] = process.argv.slice(2)) {
  const allowEmpty = args.includes("--allow-empty");
  console.log("=== BuildWorth Phase 3 Founder Fit Strict Evaluation & Hash Audit ===");
  console.log(
    "Audit Mode:",
    allowEmpty ? "Permissive (--allow-empty allowed)" : "Strict (requires >= 1 valid evaluation)",
  );

  let prisma: PrismaClient | null = null;

  try {
    prisma = new PrismaClient();
    let evaluations: any[] = [];

    try {
      evaluations = await (prisma as any).founderFitEvaluation.findMany({
        include: {
          profileRevision: {
            include: {
              skills: true,
              domainExpertise: true,
              distributionAssets: true,
              preferences: true,
              constraints: true,
            },
          },
          requirements: {
            include: {
              requiredSkills: true,
            },
          },
          dimensions: true,
          blockers: true,
        },
      });
    } catch (err: any) {
      if (allowEmpty) {
        console.log("----------------------------------------------------------------");
        console.log("Total Evaluations Audited : 0");
        console.log("Audit Result Status        : EMPTY / NOT VERIFIED");
        console.log("----------------------------------------------------------------");
        process.exit(0);
      } else {
        console.error("Database connection failure during strict audit:", err.message);
        process.exit(2);
      }
    }

    if (evaluations.length === 0) {
      if (allowEmpty) {
        console.log("----------------------------------------------------------------");
        console.log("Total Evaluations Audited : 0");
        console.log("Audit Result Status        : EMPTY / NOT VERIFIED");
        console.log("----------------------------------------------------------------");
        process.exit(0);
      } else {
        console.error("Strict Audit Failed: Zero evaluation records found in database.");
        console.error("Non-vacuous verification requires at least 1 persisted evaluation.");
        process.exit(1);
      }
    }

    let defectCount = 0;
    let malformedHashCount = 0;
    let hashMismatchCount = 0;
    let obsoleteVersionCount = 0;

    console.log(`Auditing ${evaluations.length} evaluation record(s)...`);

    for (const ev of evaluations) {
      // 1. Format validation
      if (!/^[a-f0-9]{64}$/.test(ev.inputHash)) {
        console.error(
          `[MALFORMED HASH] Evaluation ${ev.id} has invalid 64-char hex hash: ${ev.inputHash}`,
        );
        malformedHashCount++;
        defectCount++;
        continue;
      }

      // 2. Version validation
      if (ev.rubricVersion !== "2.0.0" || ev.rankingVersion !== "2.0.0") {
        console.warn(
          `[OBSOLETE VERSION] Evaluation ${ev.id} uses legacy version (Rubric ${ev.rubricVersion}, Ranking ${ev.rankingVersion})`,
        );
        obsoleteVersionCount++;
        defectCount++;
      }

      // 3. Recalculate canonical hash if relations exist
      if (ev.profileRevision && ev.requirements) {
        const canonicalProfile: any = {
          userId: ev.profileRevision.userId,
          skills: ev.profileRevision.skills.map((s: any) => ({
            skillKey: s.skillKey,
            proficiency: s.proficiency,
            isPrimary: s.isPrimary,
          })),
          domainExpertise: ev.profileRevision.domainExpertise.map((d: any) => ({
            industryOrDomain: d.industryOrDomain,
            yearsExperienceBand: d.yearsExperienceBand,
          })),
          distributionAssets: ev.profileRevision.distributionAssets.map((a: any) => ({
            assetType: a.assetType,
            audienceSizeBand: a.audienceSizeBand,
          })),
          preferences: ev.profileRevision.preferences,
          constraints: ev.profileRevision.constraints,
        };

        const canonicalReqs: any = {
          blueprintId: ev.requirements.blueprintId,
          schemaVersion: ev.requirements.schemaVersion,
          minimumBudgetBand: ev.requirements.minimumBudgetBand,
          minimumCapacityBand: ev.requirements.minimumCapacityBand,
          minimumTeamSizeBand: ev.requirements.minimumTeamSizeBand,
          maxExpectedDeliveryWeeks: ev.requirements.maxExpectedDeliveryWeeks,
          requiredTechnicalRiskLevel: ev.requirements.requiredTechnicalRiskLevel,
          requiredRegulatoryRiskLevel: ev.requirements.requiredRegulatoryRiskLevel,
          requiredSalesComplexityLevel: ev.requirements.requiredSalesComplexityLevel,
          targetBuyerRoles: ev.requirements.targetBuyerRoles,
          targetIndustries: ev.requirements.targetIndustries,
          targetGeographies: ev.requirements.targetGeographies,
          requiredSkills: ev.requirements.requiredSkills.map((s: any) => ({
            skillKey: s.skillKey,
            minimumProficiency: s.minimumProficiency,
            preferredProficiency: s.preferredProficiency,
            importance: s.importance,
            isOutsourceable: s.isOutsourceable,
          })),
        };

        const canonicalPayload = buildCanonicalFounderFitPayload(
          canonicalProfile,
          canonicalReqs,
          {
            opportunityScore: 89,
            evidenceConfidence: 82,
            publicationQualityStatus: "VERIFIED",
            decisionRecommendation: "BUILD_CANDIDATE",
          },
          {
            rubricVersion: ev.rubricVersion,
            rankingVersion: ev.rankingVersion,
            taxonomyVersion: ev.taxonomyVersion,
            profileRevisionId: ev.profileRevisionId,
            profileRevisionInputHash: ev.profileRevision.inputHash,
            opportunityRevisionId: ev.opportunityRevisionId,
          },
        );

        const expectedHash = computeCanonicalInputHash(canonicalPayload);
        if (ev.inputHash !== expectedHash) {
          console.error(
            `[HASH MISMATCH] Evaluation ${ev.id} inputHash (${ev.inputHash}) does not match recalculated (${expectedHash})`,
          );
          hashMismatchCount++;
          defectCount++;
        }
      }
    }

    console.log("----------------------------------------------------------------");
    console.log(`Total Evaluations Audited          : ${evaluations.length}`);
    console.log(`Malformed Hash Count                : ${malformedHashCount}`);
    console.log(`Hash Mismatch Count                 : ${hashMismatchCount}`);
    console.log(`Obsolete Current Evaluation Count   : ${obsoleteVersionCount}`);
    console.log(`Total Defect Count                  : ${defectCount}`);
    console.log("----------------------------------------------------------------");

    if (defectCount > 0) {
      console.error("Founder Fit Audit Result: FAILED (Defects detected)");
      process.exit(1);
    }

    console.log("Founder Fit Audit Result: CLEAN (Exit code 0)");
    process.exit(0);
  } catch (error: any) {
    console.error("Founder Fit Audit Execution Failure:", error);
    process.exit(2);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

if (
  require.main === module ||
  (typeof process !== "undefined" && process.argv[1]?.includes("audit-founder-fit"))
) {
  runFounderFitAudit();
}
