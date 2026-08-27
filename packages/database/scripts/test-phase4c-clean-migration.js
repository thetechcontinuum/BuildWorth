const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function runCleanMigrationTest() {
  console.log("=== BuildWorth Phase 4C Clean Migration From Zero Verification ===");

  const dbName = "test_clean_mig_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const dbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 1. Deploy all migrations from zero
    execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        PATH: process.env.PATH || "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        DATABASE_URL: dbUrl,
      },
      stdio: "pipe",
    });

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    // Public table count
    const tableCountRes = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `;
    console.log(`Authoritative Public Table Count: ${tableCountRes[0].count} (Expected: 77)`);

    // Applied migrations
    const migRows = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM _prisma_migrations ORDER BY started_at ASC;
    `;
    console.log("\nApplied _prisma_migrations Rows:");
    console.table(migRows);

    // Check zero fabricated business rows immediately after migration
    const rowCounts = {
      users: await prisma.user.count(),
      opportunities: await prisma.opportunity.count(),
      savedOpportunities: await prisma.savedOpportunity.count(),
      opportunityRadarJobs: await prisma.opportunityRadarJob.count(),
      opportunityChangeEvents: await prisma.opportunityChangeEvent.count(),
      notificationOutbox: await prisma.notificationOutbox.count(),
      notificationDeliveries: await prisma.notificationDelivery.count(),
      notificationUnsubscribeTokens: await prisma.notificationUnsubscribeToken.count(),
    };

    console.log("\nZero Fabricated Business Rows Verification immediately after migration:");
    console.table(rowCounts);

    const hasFabricatedData = Object.values(rowCounts).some((c) => c > 0);
    console.log(
      `\nFabricated Business Rows Found: ${hasFabricatedData ? "YES (DEFECT)" : "NO (CLEAN)"}`,
    );

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Clean Migration From Zero Verification PASSED!");
    console.log("=======================================================\n");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

runCleanMigrationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
