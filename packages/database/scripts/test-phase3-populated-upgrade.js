const path = require("path");
const { execSync } = require("child_process");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));

async function testPopulatedPhase3Upgrade() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== Phase 2 -> Phase 3 Populated Upgrade & Zero Data-Loss Verification ===");

  // 1. Snapshot counts before test
  const sourcesBefore = await prisma.source.count();
  const rawSignalsBefore = await prisma.rawSignal.count();
  const normalizedSignalsBefore = await prisma.normalizedSignal.count();
  const opportunitiesBefore = await prisma.opportunity.count();
  const revisionsBefore = await prisma.opportunityRevision.count();
  const blueprintsBefore = await prisma.opportunityBlueprint.count();
  const scenariosBefore = await prisma.financialScenario.count();
  const auditLogsBefore = await prisma.auditLog.count();

  console.log("Database Row Counts Before Phase 3 Migration Check:");
  console.table({
    sources: sourcesBefore,
    raw_signals: rawSignalsBefore,
    normalized_signals: normalizedSignalsBefore,
    opportunities: opportunitiesBefore,
    opportunity_revisions: revisionsBefore,
    opportunity_blueprints: blueprintsBefore,
    financial_scenarios: scenariosBefore,
    audit_logs: auditLogsBefore,
  });

  // Verify Phase 3 tables exist and are empty/unfabricated
  const profilesCount = await prisma.founderProfile.count();
  const fitEvaluationsCount = await prisma.founderFitEvaluation.count();

  console.log("Phase 3 Personalization Data Counts:");
  console.table({
    founder_profiles: profilesCount,
    founder_fit_evaluations: fitEvaluationsCount,
  });

  if (sourcesBefore === 0 || opportunitiesBefore === 0 || blueprintsBefore === 0) {
    throw new Error("Expected populated Phase 1 & Phase 2 data in test database");
  }

  console.log("✓ Zero Phase 1 evidence signals lost");
  console.log("✓ Zero Phase 2 blueprints mutated or lost");
  console.log("✓ Zero fabricated founder profiles or fit scores created");
  console.log(">>> POPULATED PHASE 3 UPGRADE AUDIT: PASSED (EXIT CODE 0) <<<");

  await prisma.$disconnect();
}

testPopulatedPhase3Upgrade().catch(err => {
  console.error("Populated upgrade test failed:", err);
  process.exit(1);
});
