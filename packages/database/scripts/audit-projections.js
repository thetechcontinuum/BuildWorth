const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));

async function main() {
  const isReportOnly = process.argv.includes("--report-only");
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  
  let prisma;
  try {
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  } catch (err) {
    console.error("[FATAL] Could not initialize PrismaClient:", err.message);
    process.exit(2);
  }

  try {
    const opportunities = await prisma.opportunity.findMany({
      include: {
        revisions: {
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

    let revisionCount = 0;
    let blueprintCount = 0;
    let projectionCount = 0;
    let mismatchCount = 0;

    for (const opp of opportunities) {
      const currentRev = opp.currentRevisionId 
        ? opp.revisions.find(r => r.id === opp.currentRevisionId) || opp.revisions.sort((a,b) => b.revisionNumber - a.revisionNumber)[0]
        : opp.revisions.sort((a,b) => b.revisionNumber - a.revisionNumber)[0];
      if (currentRev) revisionCount++;

      if (opp.currentRevisionId && currentRev && opp.currentRevisionId !== currentRev.id) {
        console.error(`[DEFECT] Opportunity ${opp.slug} currentRevisionId mismatch: ${opp.currentRevisionId} !== ${currentRev.id}`);
        mismatchCount++;
      }

      if (currentRev?.blueprint) {
        blueprintCount++;
        const bp = currentRev.blueprint;

        // 1. Decision Recommendation
        projectionCount++;
        if (bp.decisionEvaluation && opp.decisionRecommendation !== bp.decisionEvaluation.recommendation) {
          console.error(`[DEFECT] Recommendation mismatch for ${opp.slug}: ${opp.decisionRecommendation} !== ${bp.decisionEvaluation.recommendation}`);
          mismatchCount++;
        }

        // 2. Economic Buyer
        projectionCount++;
        const primarySegment = bp.customerSegments[0];
        if (primarySegment && opp.economicBuyer !== primarySegment.economicBuyerRole) {
          console.error(`[DEFECT] Economic buyer mismatch for ${opp.slug}: ${opp.economicBuyer} !== ${primarySegment.economicBuyerRole}`);
          mismatchCount++;
        }

        // 3. Riskiest Assumption
        projectionCount++;
        const unresolved = bp.assumptions
          .filter(a => a.status === "UNTESTED" || a.status === "TESTING")
          .sort((a, b) => {
            const scoreA = (a.importanceScore || 1) * (a.uncertaintyScore || 1);
            const scoreB = (b.importanceScore || 1) * (b.uncertaintyScore || 1);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return (a.id || "").localeCompare(b.id || "");
          });
        const expectedAssumption = unresolved[0]?.statement ?? bp.assumptions[0]?.statement ?? null;
        if (expectedAssumption && opp.riskiestAssumption !== expectedAssumption) {
          console.error(`[DEFECT] Riskiest assumption mismatch for ${opp.slug}: ${opp.riskiestAssumption} !== ${expectedAssumption}`);
          mismatchCount++;
        }

        // 4. Cheapest Experiment
        projectionCount++;
        const expectedExp = bp.validationExperiments[0]?.hypothesis ?? null;
        if (expectedExp && opp.cheapestExperiment !== expectedExp) {
          console.error(`[DEFECT] Cheapest experiment mismatch for ${opp.slug}: ${opp.cheapestExperiment} !== ${expectedExp}`);
          mismatchCount++;
        }
      }
    }

    console.log(`=== Opportunity Projection Audit ===`);
    console.log(`Opportunities Audited : ${opportunities.length}`);
    console.log(`Revisions Audited     : ${revisionCount}`);
    console.log(`Blueprints Audited    : ${blueprintCount}`);
    console.log(`Projections Checked   : ${projectionCount}`);
    console.log(`Mismatches Detected   : ${mismatchCount}`);

    await prisma.$disconnect();

    if (mismatchCount > 0) {
      console.log(`Audit Result: DEFECTS DETECTED`);
      if (isReportOnly) {
        console.log(`--report-only active: exiting with code 0.`);
        process.exit(0);
      }
      process.exit(1);
    }

    console.log(`Audit Result: CLEAN PASS (Exit code 0)`);
    process.exit(0);
  } catch (err) {
    console.error(`[FATAL] Audit execution failed:`, err.message);
    process.exit(2);
  }
}

main();
