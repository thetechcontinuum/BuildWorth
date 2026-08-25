const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { execSync } = require("child_process");

async function testDefectAndRestore() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const opp = await prisma.opportunity.findFirstOrThrow({ where: { slug: "audit-test-opp" } });
  
  // Find current authoritative revision
  const currentRev = await prisma.opportunityRevision.findUniqueOrThrow({
    where: { id: opp.currentRevisionId }
  });

  // Ensure blueprint exists on the current authoritative revision
  let bp = await prisma.opportunityBlueprint.findFirst({
    where: { opportunityRevisionId: currentRev.id }
  });

  if (!bp) {
    bp = await prisma.opportunityBlueprint.create({
      data: {
        opportunityRevisionId: currentRev.id,
        inputHash: "defect-test-hash",
      }
    });
    await prisma.blueprintAssumption.create({
      data: {
        blueprintId: bp.id,
        statement: "Expected Valid Assumption",
        category: "WILLINGNESS_TO_PAY",
        importanceScore: 5,
        uncertaintyScore: 5,
        testMethod: "Interviews",
        successThreshold: ">50%",
        failureThreshold: "<20%",
        status: "UNTESTED",
        provenanceType: "ASSUMPTION",
      }
    });
    await prisma.blueprintCustomerSegment.create({
      data: {
        blueprintId: bp.id,
        segmentName: "Primary DevOps",
        industry: "DevOps",
        companySizeRange: "10-50",
        geography: "Global",
        businessModel: "SaaS",
        endUserRole: "DevOps Engineer",
        economicBuyerRole: "VP of Engineering",
        procurementComplexity: "Low",
        budgetCategory: "Tools",
        spendingBehavior: "Card",
        buyingTrigger: "Audit",
        primaryObjection: "None",
        salesCycleMinDays: 7,
        salesCycleMaxDays: 14,
        salesMotion: "FOUNDER_LED",
        confidenceScore: 80,
        provenanceType: "VERIFIED_EVIDENCE_BACKED",
      }
    });
    await prisma.decisionEvaluation.create({
      data: {
        blueprintId: bp.id,
        recommendation: "BUILD_CANDIDATE",
        opportunityScoreUsed: 85,
        evidenceConfidenceUsed: 80,
        publicationStatusUsed: "VERIFIED",
        economicsStatus: "HEALTHY_HIGH_MARGIN",
        feasibilityStatus: "PROVEN_MODERN_STACK",
        inputHash: "defect-test-hash",
      }
    });
  }

  console.log("=== 1. Clean Projection Audit Test ===");
  await prisma.opportunity.update({
    where: { id: opp.id },
    data: { riskiestAssumption: "Expected Valid Assumption" }
  });

  let cleanOutput = execSync("DATABASE_URL=" + dbUrl + " pnpm --filter @buildworth/database run audit:projections").toString();
  console.log(cleanOutput.trim());

  console.log("\n=== 2. Corrupted Projection Audit Test ===");
  await prisma.opportunity.update({
    where: { id: opp.id },
    data: { riskiestAssumption: "CORRUPTED_VALUE" }
  });

  try {
    execSync("DATABASE_URL=" + dbUrl + " pnpm --filter @buildworth/database run audit:projections", { stdio: "pipe" });
    console.error("FAILED: Corrupted audit did not throw non-zero exit code");
    process.exit(1);
  } catch (err) {
    console.log("Defect Audit Exit Code :", err.status);
    console.log("Raw Defect Output      :\n" + (err.stderr.toString().trim() || err.stdout.toString().trim()));
  }

  console.log("\n=== 3. Restored Projection Audit Test ===");
  await prisma.opportunity.update({
    where: { id: opp.id },
    data: { riskiestAssumption: "Expected Valid Assumption" }
  });

  cleanOutput = execSync("DATABASE_URL=" + dbUrl + " pnpm --filter @buildworth/database run audit:projections").toString();
  console.log(cleanOutput.trim());

  await prisma.$disconnect();
}

testDefectAndRestore();
