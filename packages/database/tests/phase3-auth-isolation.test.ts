import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  initiatePasswordlessLogin,
  verifyPasswordlessToken,
  resolveHashedServerSession,
  revokeHashedServerSession,
} from "../src/auth-identity.js";
import { createOrUpdateFounderProfileTransaction } from "../../opportunity-engine/src/profile/profile-service.js";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5440/postgres?schema=public",
    },
  },
});

describe("Mandatory Phase 3 Comprehensive Verification & Security Gates", () => {
  const userAEmail = "user.a.founder@buildworth.io";
  const userBEmail = "user.b.founder@buildworth.io";

  beforeEach(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
  });

  it("1. Rejects arbitrary email and invalid formats from generating verification tokens", async () => {
    const invalid1 = await initiatePasswordlessLogin(prisma, "not-an-email");
    expect(invalid1.success).toBe(false);

    const invalid2 = await initiatePasswordlessLogin(prisma, "victim@");
    expect(invalid2.success).toBe(false);
  });

  it("2. Valid single-use magic link token creates session and cannot be replayed", async () => {
    const req = await initiatePasswordlessLogin(prisma, userAEmail, { isTestEnv: true });
    expect(req.success).toBe(true);
    expect(req.testToken).toBeDefined();

    const rawToken = req.testToken!;

    // 1st verification succeeds
    const verify1 = await verifyPasswordlessToken(prisma, userAEmail, rawToken);
    expect(verify1.success).toBe(true);
    expect(verify1.sessionToken).toBeDefined();
    expect(verify1.user?.tier).toBe("FREE"); // Default FREE tier (never auto-PRO)

    // 2nd verification fails (single-use token consumed)
    const verify2 = await verifyPasswordlessToken(prisma, userAEmail, rawToken);
    expect(verify2.success).toBe(false);
    expect(verify2.error).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("3. Forged and revoked session tokens are rejected by server session resolver", async () => {
    const req = await initiatePasswordlessLogin(prisma, userAEmail, { isTestEnv: true });
    const auth = await verifyPasswordlessToken(prisma, userAEmail, req.testToken!);
    const validRawSession = auth.sessionToken!;

    // Resolves valid session
    const sessionUser = await resolveHashedServerSession(prisma, validRawSession);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.email).toBe(userAEmail);

    // Forged session token fails
    const forged = await resolveHashedServerSession(prisma, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    expect(forged).toBeNull();

    // Revoking session invalidates access
    await revokeHashedServerSession(prisma, validRawSession);
    const afterRevoke = await resolveHashedServerSession(prisma, validRawSession);
    expect(afterRevoke).toBeNull();
  });

  it("4. Enforces cross-user isolation: User A profile updates are isolated from User B", async () => {
    const reqA = await initiatePasswordlessLogin(prisma, userAEmail, { isTestEnv: true });
    const authA = await verifyPasswordlessToken(prisma, userAEmail, reqA.testToken!);

    const reqB = await initiatePasswordlessLogin(prisma, userBEmail, { isTestEnv: true });
    const authB = await verifyPasswordlessToken(prisma, userBEmail, reqB.testToken!);

    const userA = authA.user!;
    const userB = authB.user!;

    // User A creates profile revision #1
    const revA1 = await createOrUpdateFounderProfileTransaction(prisma, userA.id, {
      userId: userA.id,
      skills: [{ skillKey: "TYPESCRIPT", proficiency: "EXPERT" }],
      domainExpertise: [{ industryOrDomain: "DevOps", yearsExperienceBand: "3-5" }],
      distributionAssets: [],
      preferences: {
        preferredIndustries: ["DevOps"],
        excludedIndustries: [],
        preferredBusinessModels: [],
        targetGeographies: [],
        preferredBuyerRoles: [],
      },
      constraints: {
        mvpBudgetBand: "USD_5K_TO_20K",
        budgetCurrency: "USD",
        availableHoursPerWeekBand: "HOURS_21_TO_35",
        teamSizeBand: "SOLO_FOUNDER",
        technicalRiskTolerance: "HIGH",
        regulatoryRiskTolerance: "MEDIUM",
        salesComplexityTolerance: "LOW",
        operationalBurdenTolerance: "MEDIUM",
        fundingPreference: "BOOTSTRAP_ONLY",
      },
    });

    expect(revA1.revisionNumber).toBe(1);

    // Verify User B profile remains non-existent / isolated
    const profB = await prisma.founderProfile.findUnique({ where: { userId: userB.id } });
    expect(profB).toBeNull();

    // User A creates profile revision #2 (sequential increment)
    const revA2 = await createOrUpdateFounderProfileTransaction(prisma, userA.id, {
      userId: userA.id,
      skills: [{ skillKey: "TYPESCRIPT", proficiency: "EXPERT" }, { skillKey: "REACT", proficiency: "ADVANCED" }],
      domainExpertise: [{ industryOrDomain: "DevOps", yearsExperienceBand: "3-5" }],
      distributionAssets: [],
      preferences: {
        preferredIndustries: ["DevOps"],
        excludedIndustries: [],
        preferredBusinessModels: [],
        targetGeographies: [],
        preferredBuyerRoles: [],
      },
      constraints: {
        mvpBudgetBand: "USD_5K_TO_20K",
        budgetCurrency: "USD",
        availableHoursPerWeekBand: "HOURS_21_TO_35",
        teamSizeBand: "SOLO_FOUNDER",
        technicalRiskTolerance: "HIGH",
        regulatoryRiskTolerance: "MEDIUM",
        salesComplexityTolerance: "LOW",
        operationalBurdenTolerance: "MEDIUM",
        fundingPreference: "BOOTSTRAP_ONLY",
      },
    });

    expect(revA2.revisionNumber).toBe(2);

    const activeProfileA = await prisma.founderProfile.findUnique({
      where: { userId: userA.id },
      include: { revisions: { orderBy: { revisionNumber: "asc" } } },
    });

    expect(activeProfileA?.revisions).toHaveLength(2);
    expect(activeProfileA?.currentProfileRevisionId).toBe(revA2.revisionId);
  });
});
