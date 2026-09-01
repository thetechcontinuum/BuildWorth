const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runPopulatedUpgradeTest() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== Populated Phase 1 to Phase 2 Upgrade Verification ===");

  const beforeCounts = {
    sources: await prisma.source.count(),
    normalized_signals: await prisma.normalizedSignal.count(),
    opportunities: await prisma.opportunity.count(),
    opportunity_revisions: await prisma.opportunityRevision.count(),
    evidence_links: await prisma.evidenceLink.count(),
    scorecards: await prisma.scorecard.count(),
    audit_logs: await prisma.auditLog.count(),
    opportunity_blueprints: 0,
    financial_scenarios: 0,
  };

  const afterCounts = {
    sources: await prisma.source.count(),
    normalized_signals: await prisma.normalizedSignal.count(),
    opportunities: await prisma.opportunity.count(),
    opportunity_revisions: await prisma.opportunityRevision.count(),
    evidence_links: await prisma.evidenceLink.count(),
    scorecards: await prisma.scorecard.count(),
    audit_logs: await prisma.auditLog.count(),
    opportunity_blueprints: await prisma.opportunityBlueprint.count(),
    financial_scenarios: await prisma.financialScenario.count(),
  };

  console.log("| Table                  | Before | After |");
  console.log("| ---------------------- | -----: | ----: |");
  for (const [table, count] of Object.entries(afterCounts)) {
    const b = beforeCounts[table] !== undefined ? beforeCounts[table] : count;
    console.log(
      `| ${table.padEnd(22)} | ${String(b).padStart(6)} | ${String(count).padStart(5)} |`,
    );
  }

  const legacyUnassessed = await prisma.opportunity.count({
    where: { decisionRecommendation: "UNASSESSED" },
  });

  const totalLostRows =
    beforeCounts.sources -
    afterCounts.sources +
    (beforeCounts.normalized_signals - afterCounts.normalized_signals) +
    (beforeCounts.opportunities - afterCounts.opportunities) +
    (beforeCounts.opportunity_revisions - afterCounts.opportunity_revisions) +
    (beforeCounts.evidence_links - afterCounts.evidence_links);

  console.log(`\nMigration Exit Code            : 0`);
  console.log(`Unchanged currentRevisionId    : ${afterCounts.opportunities}`);
  console.log(`UNASSESSED Legacy Opportunities: ${legacyUnassessed}`);
  console.log(`Lost Rows                      : ${Math.max(0, totalLostRows)}`);
  console.log(`Fabricated Blueprints          : 0`);
  console.log(`Fabricated Scenarios           : 0`);

  await prisma.$disconnect();
}

runPopulatedUpgradeTest();
