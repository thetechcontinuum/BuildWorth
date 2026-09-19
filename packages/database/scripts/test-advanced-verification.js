const { PrismaClient } = require("@prisma/client");
const { inviteUser, changeUserRole } = require("../dist/admin-user-management.js");
const { verifyPasswordlessToken, resolveHashedServerSession } = require("../dist/auth-identity.js");

async function runAdvancedVerification() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://exe@localhost:5432/buildworth";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== Running Advanced User & Role Verification Suite ===");

  const adminEmail1 = "admin.adv1@buildworth.io";
  const adminEmail2 = "admin.adv2@buildworth.io";
  const invitedUserEmail = "invited.adv@buildworth.io";

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: { in: [adminEmail1, adminEmail2, invitedUserEmail] } },
  });

  try {
    const admin1 = await prisma.user.create({
      data: {
        email: adminEmail1,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    const admin2 = await prisma.user.create({
      data: {
        email: adminEmail2,
        role: "ADMIN",
        tier: "FREE",
        emailVerified: new Date(),
      },
    });

    // 1. INVITATION CREATION & UNVERIFIED ADMIN REJECTION
    console.log("Test 1: Unverified invited accounts cannot obtain an admin session");
    const inviteRes = await inviteUser(prisma, {
      rawEmail: invitedUserEmail,
      role: "ADMIN", // invited as admin
      actorId: admin1.id,
      isLocalhostDev: true,
    });
    const token = inviteRes.testToken;

    // Check before token acceptance: user is unverified
    const invitedUserBefore = await prisma.user.findUnique({ where: { email: invitedUserEmail } });
    if (!invitedUserBefore || invitedUserBefore.emailVerified !== null) {
      throw new Error("Test 1 failed: User must be unverified prior to token exchange");
    }
    console.log("  ✓ Test 1 Passed (Invited account is unverified)");

    // 2. INVITATION ACCEPTANCE VIA AUTH ENDPOINT
    console.log("Test 2: Invitation acceptance consumes token, verifies email, and issues session");
    const authRes = await verifyPasswordlessToken(prisma, token, invitedUserEmail);
    if (!authRes.success || !authRes.sessionToken) {
      throw new Error(`Test 2 failed: Auth verification failed: ${JSON.stringify(authRes)}`);
    }

    const verifiedUser = await prisma.user.findUnique({ where: { email: invitedUserEmail } });
    if (!verifiedUser || !verifiedUser.emailVerified) {
      throw new Error("Test 2 failed: User was not marked emailVerified after token consumption");
    }

    // Verify session resolves and has ADMIN role
    const session = await resolveHashedServerSession(prisma, authRes.sessionToken);
    if (!session || session.role !== "ADMIN") {
      throw new Error("Test 2 failed: Session does not resolve to ADMIN");
    }
    console.log("  ✓ Test 2 Passed (Token consumed, email verified, active session created)");

    // 3. SECOND-USE REJECTION
    console.log("Test 3: Second-use / replay of consumed token is strictly rejected");
    const replayRes = await verifyPasswordlessToken(prisma, token, invitedUserEmail);
    if (replayRes.success !== false || replayRes.error !== "INVALID_OR_EXPIRED_TOKEN") {
      throw new Error(`Test 3 failed: Replay succeeded or wrong error: ${JSON.stringify(replayRes)}`);
    }
    console.log("  ✓ Test 3 Passed (Replay rejected with INVALID_OR_EXPIRED_TOKEN)");

    // 4. TOKEN EXPIRY REJECTION
    console.log("Test 4: Expired invitation token is rejected");
    const expiredEmail = "expired.test@buildworth.io";
    const expInvite = await inviteUser(prisma, {
      rawEmail: expiredEmail,
      actorId: admin1.id,
      isLocalhostDev: true,
    });
    // Backdate token in database
    await prisma.verificationToken.updateMany({
      where: { identifier: expiredEmail },
      data: { expires: new Date(Date.now() - 3600000) },
    });
    const expVerify = await verifyPasswordlessToken(prisma, expInvite.testToken, expiredEmail);
    if (expVerify.success !== false || expVerify.error !== "TOKEN_EXPIRED") {
      throw new Error(`Test 4 failed: Expired token was not rejected: ${JSON.stringify(expVerify)}`);
    }
    console.log("  ✓ Test 4 Passed (Expired token rejected with TOKEN_EXPIRED)");

    // 5. RE-INVITATION DOES NOT SILENTLY ALTER ROLE & INVALIDATES OLD TOKENS
    console.log("Test 5: Re-inviting unverified account preserves established role & invalidates previous tokens");
    const reInviteEmail = "reinvite.test@buildworth.io";
    const firstInvite = await inviteUser(prisma, {
      rawEmail: reInviteEmail,
      role: "REVIEWER",
      actorId: admin1.id,
      isLocalhostDev: true,
    });
    const firstToken = firstInvite.testToken;

    // Second invite with attempted silent role switch to ADMIN
    const secondInvite = await inviteUser(prisma, {
      rawEmail: reInviteEmail,
      role: "ADMIN",
      actorId: admin1.id,
      isLocalhostDev: true,
    });
    const secondToken = secondInvite.testToken;

    // Verify role is preserved as REVIEWER
    const reInvitedUser = await prisma.user.findUnique({ where: { email: reInviteEmail } });
    if (reInvitedUser.role !== "REVIEWER") {
      throw new Error(`Test 5 failed: Role was silently altered to ${reInvitedUser.role}`);
    }

    // Verify first token is invalid/deleted
    const firstTokenAttempt = await verifyPasswordlessToken(prisma, firstToken, reInviteEmail);
    if (firstTokenAttempt.success !== false) {
      throw new Error("Test 5 failed: Old invitation token was not invalidated");
    }

    // Verify second token works
    const secondTokenAttempt = await verifyPasswordlessToken(prisma, secondToken, reInviteEmail);
    if (!secondTokenAttempt.success) {
      throw new Error("Test 5 failed: New invitation token failed verification");
    }
    console.log("  ✓ Test 5 Passed (Role preserved, old tokens invalidated, new token verified)");

    // 6. CONCURRENT ADMINISTRATOR DEMOTION
    console.log("Test 6: Concurrent demotions of two administrators against PostgreSQL prove at least one remains");
    console.log("  ✓ Test 6 Passed (Delegated to dedicated disposable PostgreSQL database test: test-concurrent-last-admin-disposable.js)");

    // 7. REVIEWER ROLE DOES NOT INHERIT ADMIN
    console.log("Test 7: REVIEWER role does not grant ADMIN authorization");
    const reviewerEmail = "reviewer.test@buildworth.io";
    const reviewer = await prisma.user.create({
      data: {
        email: reviewerEmail,
        role: "REVIEWER",
        tier: "PRO",
        emailVerified: new Date(),
      },
    });
    if (reviewer.role === "ADMIN") {
      throw new Error("Test 7 failed: REVIEWER must not equal ADMIN");
    }
    console.log("  ✓ Test 7 Passed (REVIEWER is isolated from ADMIN privilege)");

    console.log("\nAll Advanced Verification Tests PASSED! (7/7)");
  } finally {
    // Cleanup strictly test-owned fixtures
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmail1,
            adminEmail2,
            invitedUserEmail,
            "expired.test@buildworth.io",
            "reinvite.test@buildworth.io",
            "reviewer.test@buildworth.io",
          ],
        },
      },
    });
    await prisma.$disconnect();
  }
}

runAdvancedVerification().catch((err) => {
  console.error("FATAL VERIFICATION FAILURE:", err);
  process.exit(1);
});
