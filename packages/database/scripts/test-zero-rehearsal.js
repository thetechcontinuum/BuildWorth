const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);

async function rehearseZeroDbMigration() {
  console.log("=== Rehearsing Complete Migration Chain From Zero On Clean DB ===");

  const dbName = "test_zero_rehearsal_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const zeroDbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;

  try {
    // 2. Run migrate deploy from 0 using npx prisma or local CLI command
    const deployOut = execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: zeroDbUrl },
      stdio: "pipe",
    }).toString();

    console.log("Migrate deploy result:\n", deployOut.trim());

    // 3. Inspect _prisma_migrations and tables
    const prisma = new PrismaClient({ datasources: { db: { url: zeroDbUrl } } });

    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at ASC;
    `;

    console.log("\nApplied Migrations in _prisma_migrations:");
    console.table(migrations);

    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\nTotal Tables Created: ${tables.length}`);

    // 4. Assert zero synthetic rows exist
    const counts = {
      users: await prisma.user.count(),
      subscriptions: await prisma.billingSubscription.count(),
      customers: await prisma.billingCustomer.count(),
      entitlementGrants: await prisma.entitlementGrant.count(),
      opportunities: await prisma.opportunity.count(),
      founderFitEvaluations: await prisma.founderFitEvaluation.count(),
    };

    console.log("\nZero Database Row Counts:", counts);
    for (const [k, v] of Object.entries(counts)) {
      if (v !== 0) throw new Error(`Expected zero rows in ${k}, found ${v}`);
    }

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );
    console.log("\nZero Rehearsal Database Passed Cleanly!");
  } catch (err) {
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${dbName};" >/dev/null 2>&1 || true`,
    );
    throw err;
  }
}

rehearseZeroDbMigration().catch((err) => {
  console.error("Zero rehearsal failed:", err);
  process.exit(1);
});
