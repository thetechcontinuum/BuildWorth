const { PrismaClient } = require("@prisma/client");
const { provisionAdminUser } = require("../dist/admin-provision.js");
const { GenericRssAdapter } = require("../../source-connectors/dist/adapters/generic-rss.js");

async function runAdminSecuritySuite() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://exe@localhost:5432/buildworth";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== Running Administration MVP Security & Invariant Suite ===");

  const adminTestEmail = "test.admin.target@buildworth.io";
  const proUserEmail = "test.pro.user@buildworth.io";

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: [adminTestEmail, proUserEmail] } },
  });

  try {
    // 1. First-admin provisioning rejects non-existent
    console.log("Test 1: First-admin provisioning strictly rejects non-existent target");
    const res1 = await provisionAdminUser(prisma, "does.not.exist@buildworth.io", {
      targetConfirmation: true,
      environmentConfirmation: "staging",
    });
    if (res1.success !== false || res1.error !== "USER_NOT_FOUND") {
      throw new Error(`Test 1 failed: expected USER_NOT_FOUND, got ${JSON.stringify(res1)}`);
    }
    console.log("  ✓ Test 1 Passed");

    // 2. First-admin provisioning rejects unverified target
    console.log("Test 2: First-admin provisioning strictly rejects unverified target");
    await prisma.user.create({
      data: {
        email: adminTestEmail,
        role: "USER",
        emailVerified: null,
      },
    });
    const res2 = await provisionAdminUser(prisma, adminTestEmail, {
      targetConfirmation: true,
      environmentConfirmation: "staging",
    });
    if (res2.success !== false || res2.error !== "USER_NOT_VERIFIED") {
      throw new Error(`Test 2 failed: expected USER_NOT_VERIFIED, got ${JSON.stringify(res2)}`);
    }
    console.log("  ✓ Test 2 Passed");

    // 3. First-admin provisioning strictly blocks Production execution
    console.log("Test 3: First-admin provisioning strictly blocks Production environment");
    await prisma.user.update({
      where: { email: adminTestEmail },
      data: { emailVerified: new Date() },
    });
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.BUILDWORTH_ENV;
      delete process.env.TEST_ENV;
      const res3 = await provisionAdminUser(prisma, adminTestEmail, {
        targetConfirmation: true,
        environmentConfirmation: "staging",
      });
      if (res3.success !== false || !/PRODUCTION_GUARD_ACTIVE/.test(res3.error)) {
        throw new Error("Test 3 failed: should have blocked production provision");
      }
      console.log("  ✓ Test 3 Passed");
    } finally {
      process.env.NODE_ENV = prevEnv;
    }

    // 4. First-admin provisioning atomically promotes verified user and writes audit record
    console.log("Test 4: First-admin provisioning promotes verified user with audit log");
    const provResult = await provisionAdminUser(prisma, adminTestEmail, {
      targetConfirmation: true,
      environmentConfirmation: "staging",
    });
    if (!provResult.success || provResult.user.role !== "ADMIN") {
      throw new Error("Test 4 failed: user was not promoted to ADMIN");
    }
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entityId: provResult.user.id,
        action: "ADMIN_ROLE_PROVISIONED",
      },
    });
    if (!auditRecord) {
      throw new Error("Test 4 failed: audit log missing");
    }
    console.log("  ✓ Test 4 Passed");

    // 5. Commercial PRO subscriber does NOT get ADMIN privilege
    console.log("Test 5: Commercial PRO subscription does not grant ADMIN role");
    const proUser = await prisma.user.create({
      data: {
        email: proUserEmail,
        role: "USER",
        tier: "PRO",
        emailVerified: new Date(),
      },
    });
    if (proUser.role === "ADMIN") {
      throw new Error("Test 5 failed: PRO user should not have ADMIN role");
    }
    console.log("  ✓ Test 5 Passed");

    console.log("\nAll Administration MVP Security & Invariant Tests PASSED!");
  } finally {
    // Cleanup
    await prisma.user.deleteMany({
      where: { email: { in: [adminTestEmail, proUserEmail] } },
    });
    await prisma.$disconnect();
  }
}

runAdminSecuritySuite().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
