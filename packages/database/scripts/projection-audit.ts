import { prisma } from "../src/client.js";

interface AuditOptions {
  reportOnly?: boolean;
}

export async function runProjectionAudit(options: AuditOptions = {}) {
  try {
    const opportunities = await prisma.opportunity.findMany({
      include: {
        revisions: {
          orderBy: { revisionNumber: "desc" },
          take: 1,
          include: {
            blueprint: {
              include: {
                customerSegments: true,
                financialScenarios: true,
                decisionEvaluation: true,
                assumptions: true,
                validationExperiments: { orderBy: { orderPriority: "asc" } },
              },
            },
          },
        },
      },
    });

    let defects = 0;

    for (const opp of opportunities) {
      const currentRev = opp.revisions[0];
      if (opp.currentRevisionId && currentRev && opp.currentRevisionId !== currentRev.id) {
        console.error(
          `[DEFECT] Opportunity ${opp.slug} currentRevisionId mismatch: ${opp.currentRevisionId} !== ${currentRev.id}`,
        );
        defects++;
      }

      if (currentRev?.blueprint) {
        const bp = currentRev.blueprint;

        // 1. Decision Recommendation
        if (
          bp.decisionEvaluation &&
          opp.decisionRecommendation !== bp.decisionEvaluation.recommendation
        ) {
          console.error(
            `[DEFECT] Recommendation projection mismatch for ${opp.slug}: ${opp.decisionRecommendation} !== ${bp.decisionEvaluation.recommendation}`,
          );
          defects++;
        }

        // 2. Economic Buyer
        const primarySegment = bp.customerSegments[0];
        if (primarySegment && opp.economicBuyer !== primarySegment.economicBuyerRole) {
          console.error(
            `[DEFECT] Economic buyer projection mismatch for ${opp.slug}: ${opp.economicBuyer} !== ${primarySegment.economicBuyerRole}`,
          );
          defects++;
        }

        // 3. Riskiest Assumption
        const unresolved = bp.assumptions
          .filter((a) => a.status === "UNTESTED" || a.status === "TESTING")
          .sort((a, b) => {
            const scoreA = (a.importanceScore || 1) * (a.uncertaintyScore || 1);
            const scoreB = (b.importanceScore || 1) * (b.uncertaintyScore || 1);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return (a.id || "").localeCompare(b.id || "");
          });
        const expectedAssumption = unresolved[0]?.statement ?? bp.assumptions[0]?.statement ?? null;
        if (expectedAssumption && opp.riskiestAssumption !== expectedAssumption) {
          console.error(
            `[DEFECT] Riskiest assumption projection mismatch for ${opp.slug}: ${opp.riskiestAssumption} !== ${expectedAssumption}`,
          );
          defects++;
        }

        // 4. Cheapest Experiment
        const expectedExp = bp.validationExperiments[0]?.hypothesis ?? null;
        if (expectedExp && opp.cheapestExperiment !== expectedExp) {
          console.error(
            `[DEFECT] Cheapest experiment projection mismatch for ${opp.slug}: ${opp.cheapestExperiment} !== ${expectedExp}`,
          );
          defects++;
        }
      }
    }

    if (defects > 0) {
      console.log(
        `PROJECTION AUDIT FAILED: ${defects} defect(s) detected across ${opportunities.length} opportunities.`,
      );
      if (options.reportOnly) {
        console.log("--report-only flag set: returning exit code 0.");
        process.exit(0);
      }
      process.exit(1);
    }

    console.log(
      `PROJECTION AUDIT CLEAN: ${opportunities.length} opportunities verified with 0 projection defects. (Exit code 0)`,
    );
    process.exit(0);
  } catch (err: any) {
    console.error("[FATAL] Audit execution failure:", err.message);
    process.exit(2);
  }
}

const args = process.argv.slice(2);
const reportOnly = args.includes("--report-only");
runProjectionAudit({ reportOnly });
