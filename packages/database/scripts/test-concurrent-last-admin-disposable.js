const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { changeUserRole } = require("../dist/admin-user-management.js");

async function runDisposableConcurrentTest() {
  console.log("=== Concurrent Last-Admin Demotion in Disposable PostgreSQL Database ===");

  const runPrefix = `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const disposableDbName = `bw_disp_test_${Date.now()}`;
  const baseAdminUrl = process.env.DATABASE_ADMIN_URL || "postgresql://exe@localhost:5432/postgres";
  const baseHost = process.env.DB_HOST || "localhost";
  const basePort = process.env.DB_PORT || "5432";
  const baseUser = process.env.DB_USER || "exe";

  console.log(`[Safety Guard] Ensuring disposable target database: ${disposableDbName}`);

  // 1. Fail before mutation if target cannot be proven disposable
  let dbCreated = false;
  try {
    execSync(`createdb ${disposableDbName} -U ${baseUser} -h ${baseHost} -p ${basePort} || psql -U ${baseUser} -h ${baseHost} -p ${basePort} -d postgres -c "CREATE DATABASE ${disposableDbName};"`, {
      stdio: "pipe",
    });
    dbCreated = true;
    console.log(`  ✓ Created provably isolated disposable test database: ${disposableDbName}`);
  } catch (err) {
    console.error(`[FATAL] Failed to create disposable target database: ${err.message}`);
    process.exit(1);
  }

  const disposableDbUrl = `postgresql://${baseUser}@${baseHost}:${basePort}/${disposableDbName}?schema=public`;

  try {
    // 2. Push schema to disposable database
    console.log("  Pushing schema to disposable database via prisma db push...");
    execSync(`DATABASE_URL="${disposableDbUrl}" pnpm --filter @buildworth/database exec prisma db push --skip-generate`, {
      cwd: path.resolve(__dirname, "../../.."),
      stdio: "pipe",
    });
    console.log("  ✓ Disposable schema ready.");

    const prisma = new PrismaClient({ datasources: { db: { url: disposableDbUrl } } });

    // 3. Seed ONLY test-owned users identified by runPrefix
    const testAdmin1Email = `${runPrefix}_admin1@buildworth.io`;
    const testAdmin2Email = `${runPrefix}_admin2@buildworth.io`;

    const admin1 = await prisma.user.create({
      data: {
        email: testAdmin1Email,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    const admin2 = await prisma.user.create({
      data: {
        email: testAdmin2Email,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    console.log(`  Created 2 test-owned admins: ${admin1.email} & ${admin2.email}`);

    // Verify exactly 2 admins exist in the disposable database
    const initialCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (initialCount !== 2) {
      throw new Error(`Expected exactly 2 admins in disposable DB, got ${initialCount}`);
    }

    // 4. Concurrently attempt to demote BOTH administrators simultaneously
    console.log("  Executing concurrent role demotions against PostgreSQL...");
    const results = await Promise.all([
      changeUserRole(prisma, {
        targetUserId: admin1.id,
        newRole: "USER",
        actorId: `${runPrefix}_actor_a`,
        actorEmail: `${runPrefix}_actor_a@buildworth.io`,
      }),
      changeUserRole(prisma, {
        targetUserId: admin2.id,
        newRole: "USER",
        actorId: `${runPrefix}_actor_b`,
        actorEmail: `${runPrefix}_actor_b@buildworth.io`,
      }),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    console.log("  Results:", JSON.stringify(results));

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error(`Expected exactly 1 success and 1 failure, got ${successes.length} successes and ${failures.length} failures`);
    }

    if (failures[0].error !== "LAST_ADMIN_PROTECTION") {
      throw new Error(`Expected LAST_ADMIN_PROTECTION error, got: ${JSON.stringify(failures[0])}`);
    }

    const finalAdminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (finalAdminCount !== 1) {
      throw new Error(`Expected exactly 1 admin to remain in the disposable database, got ${finalAdminCount}`);
    }

    console.log("  ✓ Concurrent last-admin demotion test passed: row locks prevented dual-demotion!");

    // Cleanup test records using runPrefix
    await prisma.user.deleteMany({
      where: {
        email: { startsWith: runPrefix },
      },
    });

    await prisma.$disconnect();
    console.log("  ✓ Test-owned records cleaned up.");
  } finally {
    // Drop the entire disposable database
    if (dbCreated) {
      try {
        execSync(`dropdb ${disposableDbName} -U ${baseUser} -h ${baseHost} -p ${basePort} || psql -U ${baseUser} -h ${baseHost} -p ${basePort} -d postgres -c "DROP DATABASE ${disposableDbName};"`, {
          stdio: "pipe",
        });
        console.log(`  ✓ Successfully dropped disposable database: ${disposableDbName}`);
      } catch (dropErr) {
        console.warn(`[Warning] Could not drop disposable DB ${disposableDbName}:`, dropErr.message);
      }
    }
  }

  console.log("\nDisposable Concurrent Last-Admin Test PASSED (1/1)!");
}

runDisposableConcurrentTest().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
