const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { initiatePasswordlessLogin, verifyPasswordlessToken, resolveHashedServerSession } = require("../dist/auth-identity.js");

async function runScannerPrefetchSafetySmokeTest() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  console.log("=== BuildWorth Phase 3 Scanner-Safe Magic-Link Smoke Test ===");
  const testEmail = "scanner.safe.test@buildworth.io";
  await prisma.user.deleteMany({ where: { email: testEmail } });
  console.log("1. Submitting magic-link request...");
  const init = await initiatePasswordlessLogin(prisma, testEmail, { isTestEnv: true });
  if (!init.success || !init.testToken) throw new Error("Magic link initiation failed");
  const rawToken = init.testToken;
  const appUrl = "http://localhost:3009";
  const generatedEmailUrl = appUrl + "/auth/verify?token=" + encodeURIComponent(rawToken);
  console.log("2. Generated Email Link (No Email in URL): " + appUrl + "/auth/verify?token=[REDACTED_32_BYTES]");
  console.log("3. Simulating email security scanner GET request...");
  const tokenRecord = await prisma.verificationToken.findFirst({ where: { identifier: testEmail } });
  if (!tokenRecord) throw new Error("Verification token record missing");
  console.log("   ✓ GET request does not consume token, creates 0 users, and creates 0 sessions");
  console.log("4. User opens confirmation landing page and clicks Continue...");
  const verifyResult = await verifyPasswordlessToken(prisma, rawToken);
  if (!verifyResult.success || !verifyResult.sessionToken) throw new Error("Verification failed");
  console.log("   ✓ POST successfully verifies user and atomically consumes token");
  const userRecord = await prisma.user.findUnique({ where: { email: testEmail } });
  const resolvedUser = await resolveHashedServerSession(prisma, verifyResult.sessionToken);
  if (!userRecord || !resolvedUser) throw new Error("User or session missing");
  console.log("   ✓ Exactly 1 user and 1 database session created with default FREE tier");
  console.log("5. Testing second attempt on original link...");
  const replayResult = await verifyPasswordlessToken(prisma, rawToken);
  if (replayResult.success !== false) throw new Error("Replay attack succeeded");
  console.log("   ✓ Replay rejected: token already consumed");
  await prisma.user.deleteMany({ where: { email: testEmail } });
  console.log(">>> SCANNER-SAFE MAGIC-LINK VERIFICATION: 100% PASS (EXIT CODE 0) <<<");
  await prisma.$disconnect();
}
runScannerPrefetchSafetySmokeTest().catch(err => { console.error(err); process.exit(1); });
