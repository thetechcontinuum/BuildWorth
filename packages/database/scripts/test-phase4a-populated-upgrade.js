const path = require("path");
const { execSync } = require("child_process");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const { resolveUserEntitlements, checkEntitlement } = require("../../entitlements/dist/index.js");

async function testPopulatedUpgrade() {
  console.log("=== BuildWorth Phase 4A Populated Database Upgrade Rehearsal ===");

  const dbName = "test_phase4a_pop_" + Date.now();
  execSync(
    `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`,
  );

  const popDbUrl = `postgresql://postgres:postgres@localhost:5440/${dbName}?schema=public`;
  const cwd = path.resolve("packages/database");
  const prismaBin = path.resolve("packages/database/node_modules/.bin/prisma");

  // 2. Temporarily isolate Phase 4A migration and run Phase 1-3 migrations
  const p4aMigrationDir = path.resolve(
    "packages/database/prisma/migrations/20260825200000_phase4a_billing_entitlements_foundation",
  );
  const p4aTempDir = path.resolve("packages/database/prisma/migrations/_temp_phase4a");
  const fs = require("fs");

  try {
    if (fs.existsSync(p4aMigrationDir)) {
      fs.renameSync(p4aMigrationDir, p4aTempDir);
    }

    // Deploy Phase 1-3 migrations
    execSync(`"${prismaBin}" migrate deploy`, {
      cwd,
      env: { ...process.env, DATABASE_URL: popDbUrl },
      stdio: "pipe",
    });

    console.log("Deployed Phase 1-3 migrations to populated rehearsal database.");

    // Seed authoritative Phase 3 records into rehearsal DB
    execSync(`DATABASE_URL="${popDbUrl}" node packages/database/scripts/seed-taxonomy.js`, {
      stdio: "pipe",
    });
    execSync(`DATABASE_URL="${popDbUrl}" node packages/database/scripts/seed-audit-evaluation.js`, {
      stdio: "pipe",
    });

    // 3. Capture Pre-Migration Counts & Hashes
    const prisma = new PrismaClient({ datasources: { db: { url: popDbUrl } } });

    const beforeCounts = {
      users: await prisma.user.count(),
      opportunities: await prisma.opportunity.count(),
      opportunityRevisions: await prisma.opportunityRevision.count(),
      opportunityBlueprints: await prisma.opportunityBlueprint.count(),
      normalizedSignals: await prisma.normalizedSignal.count(),
      evidenceLinks: await prisma.evidenceLink.count(),
      founderProfiles: await prisma.founderProfile.count(),
      founderProfileRevisions: await prisma.founderProfileRevision.count(),
      founderFitEvaluations: await prisma.founderFitEvaluation.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    const beforeEvaluation = await prisma.founderFitEvaluation.findFirst();
    const beforeEvalHash = beforeEvaluation.inputHash;

    console.log("Pre-Migration Phase 3 Counts:", beforeCounts);

    // 4. Restore Phase 4A migration and deploy
    if (fs.existsSync(p4aTempDir)) {
      fs.renameSync(p4aTempDir, p4aMigrationDir);
    }

    const upgradeOut = execSync(`"${prismaBin}" migrate deploy`, {
      cwd,
      env: { ...process.env, DATABASE_URL: popDbUrl },
      stdio: "pipe",
    }).toString();

    console.log("Phase 4A Upgrade Result:\n", upgradeOut.trim());

    // 5. Post-Migration Verification
    const afterCounts = {
      users: await prisma.user.count(),
      opportunities: await prisma.opportunity.count(),
      opportunityRevisions: await prisma.opportunityRevision.count(),
      opportunityBlueprints: await prisma.opportunityBlueprint.count(),
      normalizedSignals: await prisma.normalizedSignal.count(),
      evidenceLinks: await prisma.evidenceLink.count(),
      founderProfiles: await prisma.founderProfile.count(),
      founderProfileRevisions: await prisma.founderProfileRevision.count(),
      founderFitEvaluations: await prisma.founderFitEvaluation.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log("Post-Migration Phase 4A Counts:", afterCounts);

    // Assert zero deleted or altered rows
    for (const [k, v] of Object.entries(beforeCounts)) {
      if (afterCounts[k] !== v) {
        throw new Error(
          `Data corruption detected in table ${k}: before=${v}, after=${afterCounts[k]}`,
        );
      }
    }

    const afterEvaluation = await prisma.founderFitEvaluation.findFirst();
    if (afterEvaluation.inputHash !== beforeEvalHash) {
      throw new Error(
        `Founder fit evaluation hash mutated during upgrade: before=${beforeEvalHash}, after=${afterEvaluation.inputHash}`,
      );
    }

    // Verify zero fabricated subscriptions or entitlement grants
    const subCount = await prisma.billingSubscription.count();
    const grantCount = await prisma.entitlementGrant.count();
    if (subCount !== 0 || grantCount !== 0) {
      throw new Error(
        `Fabricated subscription records created during migration: subs=${subCount}, grants=${grantCount}`,
      );
    }

    // Verify legacy users default to FREE tier
    const user = await prisma.user.findFirst();
    const ctx = resolveUserEntitlements(user);
    if (ctx.tier !== "FREE") {
      throw new Error(`Legacy user was automatically promoted to ${ctx.tier}`);
    }

    await prisma.$disconnect();
    execSync(
      `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${dbName};"`,
    );

    console.log("\n=======================================================");
    console.log("Phase 4A Populated Upgrade Rehearsal PASSED with 0 Defects!");
    console.log("=======================================================");
  } finally {
    if (fs.existsSync(p4aTempDir)) {
      fs.renameSync(p4aTempDir, p4aMigrationDir);
    }
  }
}

testPopulatedUpgrade().catch((err) => {
  console.error("Populated upgrade test failed:", err);
  process.exit(1);
});
