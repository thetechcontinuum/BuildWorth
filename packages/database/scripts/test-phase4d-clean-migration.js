const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runCleanMigrationTest() {
  console.log("=== BuildWorth Phase 4D Clean Migration From Zero Verification ===");

  // 1. Inspect Filesystem Migration Directories
  const migrationsDirPath = path.resolve(__dirname, "../prisma/migrations");
  const fsMigrationDirs = fs
    .readdirSync(migrationsDirPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("202"))
    .map((dirent) => dirent.name)
    .sort();

  console.log("Filesystem Migration Directories:");
  console.table(fsMigrationDirs);

  const dbName = "test_phase4d_clean_zero_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 2. Deploy all migrations from zero
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // 3. Applied migrations in _prisma_migrations
    const migRows = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM _prisma_migrations ORDER BY started_at ASC;
    `;
    console.log("\nApplied _prisma_migrations Rows:");
    console.table(migRows);

    // 4. All 80 Public Table Names
    const tableNamesRes = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `;
    console.log(`\nAuthoritative Public Table Count: ${tableNamesRes.length} (Expected: 80)`);
    console.table(tableNamesRes.map((r) => r.table_name));

    if (tableNamesRes.length !== 80) {
      throw new Error(`Expected 80 public tables, found ${tableNamesRes.length}`);
    }

    // 5. Check zero fabricated business rows immediately after migration
    const rowCounts = {
      users: await prisma.user.count(),
      opportunities: await prisma.opportunity.count(),
      savedOpportunities: await prisma.savedOpportunity.count(),
      opportunityRadarJobs: await prisma.opportunityRadarJob.count(),
      opportunityChangeEvents: await prisma.opportunityChangeEvent.count(),
      notificationOutbox: await prisma.notificationOutbox.count(),
      notificationDeliveries: await prisma.notificationDelivery.count(),
      notificationUnsubscribeTokens: await prisma.notificationUnsubscribeToken.count(),
      opportunityExports: await prisma.opportunityExport.count(),
      usageLedgers: await prisma.usageLedger.count(),
      commercialEvents: await prisma.commercialEvent.count(),
      analyticsConsentHistories: await prisma.analyticsConsentHistory.count(),
    };

    console.log("\nZero Fabricated Business Rows Verification immediately after migration:");
    console.table(rowCounts);

    const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
    if (totalRows !== 0) {
      throw new Error(`Fabricated business rows detected post-migration: ${totalRows} rows found.`);
    }

    console.log("\nFabricated Business Rows Found: NO (CLEAN)");
    console.log("\n=======================================================");
    console.log("Clean Migration From Zero Verification PASSED!");
    console.log("=======================================================\n");
  } finally {
    try {
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
        { stdio: "pipe" },
      );
    } catch {}
  }
}

if (require.main === module) {
  runCleanMigrationTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runCleanMigrationTest };
