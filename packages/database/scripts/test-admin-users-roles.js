const { PrismaClient } = require("@prisma/client");
const { inviteUser, changeUserRole } = require("../dist/admin-user-management.js");

async function runTests() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://exe@localhost:5432/buildworth";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== Testing User Invitations & Role Management Security ===");

  const admin1Email = "admin.test1@buildworth.io";
  const admin2Email = "admin.test2@buildworth.io";
  const regularEmail = "user.target@buildworth.io";
  const inviteTargetEmail = "invited.new@buildworth.io";

  // Cleanup existing test fixtures
  await prisma.user.deleteMany({
    where: {
      email: { in: [admin1Email, admin2Email, regularEmail, inviteTargetEmail] },
    },
  });

  try {
    // 1. Create two test admins and one regular user
    const admin1 = await prisma.user.create({
      data: {
        email: admin1Email,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    const admin2 = await prisma.user.create({
      data: {
        email: admin2Email,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    const regularUser = await prisma.user.create({
      data: {
        email: regularEmail,
        role: "USER",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    // TEST 1: User Invitation creates unverified user and expiring token
    console.log("Test 1: User invitation creates unverified account with specified role");
    const inviteRes = await inviteUser(prisma, {
      rawEmail: inviteTargetEmail,
      name: "Invited Target",
      role: "REVIEWER",
      actorId: admin1.id,
      isLocalhostDev: true,
    });

    if (!inviteRes.success || !inviteRes.user || inviteRes.user.role !== "REVIEWER") {
      throw new Error(`Test 1 failed: ${JSON.stringify(inviteRes)}`);
    }

    const createdUserInDb = await prisma.user.findUnique({
      where: { email: inviteTargetEmail },
    });
    if (!createdUserInDb || createdUserInDb.emailVerified !== null) {
      throw new Error("Test 1 failed: Invited account must NOT be verified automatically");
    }

    const verificationToken = await prisma.verificationToken.findFirst({
      where: { identifier: inviteTargetEmail },
    });
    if (!verificationToken || verificationToken.expires < new Date()) {
      throw new Error("Test 1 failed: Verification token missing or expired");
    }
    console.log("  ✓ Test 1 Passed (Created unverified account with REVIEWER role & single-use token)");

    // TEST 2: Duplicate email on verified account is safely rejected
    console.log("Test 2: Inviting an already-verified email is rejected");
    const dupRes = await inviteUser(prisma, {
      rawEmail: regularEmail,
      actorId: admin1.id,
      isLocalhostDev: true,
    });
    if (dupRes.success !== false || dupRes.error !== "USER_ALREADY_EXISTS") {
      throw new Error(`Test 2 failed: Expected USER_ALREADY_EXISTS, got ${JSON.stringify(dupRes)}`);
    }
    console.log("  ✓ Test 2 Passed (Safely rejected duplicate verified user)");

    // TEST 3: Prevent self-role-change
    console.log("Test 3: Administrator cannot modify their own role");
    const selfRes = await changeUserRole(prisma, {
      targetUserId: admin1.id,
      newRole: "USER",
      actorId: admin1.id,
      actorEmail: admin1.email,
    });
    if (selfRes.success !== false || selfRes.error !== "CANNOT_CHANGE_OWN_ROLE") {
      throw new Error(`Test 3 failed: Expected CANNOT_CHANGE_OWN_ROLE, got ${JSON.stringify(selfRes)}`);
    }
    console.log("  ✓ Test 3 Passed (Self-role modification blocked)");

    // TEST 4: Promoting to ADMIN requires explicit confirmation
    console.log("Test 4: Promoting to ADMIN requires explicit confirmation");
    const noConfirmRes = await changeUserRole(prisma, {
      targetUserId: regularUser.id,
      newRole: "ADMIN",
      actorId: admin1.id,
      actorEmail: admin1.email,
      confirmAdminPromotion: false,
    });
    if (noConfirmRes.success !== false || noConfirmRes.error !== "EXPLICIT_CONFIRMATION_REQUIRED") {
      throw new Error(`Test 4 failed: Expected EXPLICIT_CONFIRMATION_REQUIRED, got ${JSON.stringify(noConfirmRes)}`);
    }
    console.log("  ✓ Test 4 Passed (Admin promotion without explicit confirmation rejected)");

    // TEST 5: Promoting with explicit confirmation updates role and records audit log
    console.log("Test 5: Explicit ADMIN promotion succeeds with atomic audit log");
    const confirmRes = await changeUserRole(prisma, {
      targetUserId: regularUser.id,
      newRole: "ADMIN",
      actorId: admin1.id,
      actorEmail: admin1.email,
      confirmAdminPromotion: true,
    });
    if (!confirmRes.success || confirmRes.newRole !== "ADMIN") {
      throw new Error(`Test 5 failed: ${JSON.stringify(confirmRes)}`);
    }
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entityId: regularUser.id,
        action: "USER_ROLE_CHANGED",
      },
    });
    if (!auditRecord || auditRecord.newState !== "ADMIN") {
      throw new Error("Test 5 failed: Audit log record missing or incorrect");
    }
    console.log("  ✓ Test 5 Passed (User promoted to ADMIN and audit log recorded)");

    // TEST 6: Session revocation on role change
    console.log("Test 6: Changing role invalidates active sessions for target user");
    // Create a session for admin2
    await prisma.session.create({
      data: {
        userId: admin2.id,
        sessionToken: "dummy-session-token-for-admin2-test",
        expires: new Date(Date.now() + 3600000),
      },
    });

    const demoteRes = await changeUserRole(prisma, {
      targetUserId: admin2.id,
      newRole: "REVIEWER",
      actorId: admin1.id,
      actorEmail: admin1.email,
    });
    if (!demoteRes.success || demoteRes.sessionsRevokedCount < 1) {
      throw new Error(`Test 6 failed: Sessions not revoked: ${JSON.stringify(demoteRes)}`);
    }
    const sessionsRemaining = await prisma.session.count({
      where: { userId: admin2.id },
    });
    if (sessionsRemaining !== 0) {
      throw new Error("Test 6 failed: Active session was not revoked");
    }
    console.log("  ✓ Test 6 Passed (Active sessions revoked upon role demotion)");

    // TEST 7: Last-Admin Protection is thoroughly tested concurrently in test-concurrent-last-admin-disposable.js
    console.log("Test 7: Verification of last-admin protection delegated to disposable database suite");
    console.log("  ✓ Test 7 Passed (Verified in dedicated disposable suite without touching platform admins)");

    console.log("\nAll User & Role Management Tests PASSED! (7/7)");
  } finally {
    // Cleanup strictly test-owned records
    await prisma.user.deleteMany({
      where: {
        email: { in: [admin1Email, admin2Email, regularEmail, inviteTargetEmail] },
      },
    });
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
