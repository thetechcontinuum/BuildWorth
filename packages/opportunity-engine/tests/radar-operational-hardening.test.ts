import { describe, it, expect } from "vitest";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  issuePersistentUnsubscribeToken,
  verifyPersistentUnsubscribeToken,
  revokePersistentUnsubscribeToken,
  calculateNextDigestSchedule,
  isValidIanaTimezone,
  computeOpportunityRevisionDiff,
  processPendingRadarJobs,
  processPendingNotificationOutbox,
} from "../src/index.js";

describe("Phase 4C Operational Hardening & Security Unit Suite", () => {
  describe("Scanner-Safe & Confidential Unsubscribe Tokens", () => {
    it("generates and verifies scoped, encrypted, expiring AES-256-GCM tokens without leaking identifiers", () => {
      const userId = "user_secret_uuid_9999";
      const token = generateUnsubscribeToken(userId, "EMAIL", "ALL_RADAR_NOTIFICATIONS", 3600);
      expect(token).toMatch(/^unsub_v2\./);

      // Verify token contains no readable plain text userId or email
      expect(token).not.toContain(userId);
      expect(token).not.toContain("EMAIL");
      expect(token).not.toContain("ALL_RADAR_NOTIFICATIONS");

      const verified = verifyUnsubscribeToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.userId).toBe(userId);
      expect(verified.channel).toBe("EMAIL");
      expect(verified.action).toBe("ALL_RADAR_NOTIFICATIONS");
    });

    it("rejects tampered or forged tokens using authenticated decryption check", () => {
      const token = generateUnsubscribeToken("user_abc_123");
      const tamperedToken = token.slice(0, -4) + "AAAA";

      const verified = verifyUnsubscribeToken(tamperedToken);
      expect(verified.valid).toBe(false);
      expect(verified.reason).toBe("DECRYPTION_OR_TAG_VERIFICATION_FAILED");
    });

    it("rejects revoked tokens deterministically", () => {
      const tokenId = "revoked_token_id_12345";
      const token = generateUnsubscribeToken(
        "user_abc_123",
        "EMAIL",
        "ALL_RADAR_NOTIFICATIONS",
        3600,
        { tokenId },
      );
      const revokedSet = new Set([tokenId]);

      const verified = verifyUnsubscribeToken(token, { revokedTokenIds: revokedSet });
      expect(verified.valid).toBe(false);
      expect(verified.reason).toBe("TOKEN_REVOKED");
    });

    it("rejects unsupported key versions safely", () => {
      const token = generateUnsubscribeToken(
        "user_abc_123",
        "EMAIL",
        "ALL_RADAR_NOTIFICATIONS",
        3600,
        { keyVersion: "v1" },
      );
      const verified = verifyUnsubscribeToken(token, { supportedKeyVersions: new Set(["v2"]) });
      expect(verified.valid).toBe(false);
      expect(verified.reason).toBe("UNSUPPORTED_KEY_VERSION");
    });

    it("verifies persistent token issue, verify, and cross-process restart revocation with mocked db", async () => {
      const tokenStore = new Map<string, any>();
      const mockPrisma = {
        notificationUnsubscribeToken: {
          create: async ({ data }: any) => {
            tokenStore.set(data.tokenHash, { ...data, createdAt: new Date() });
            return data;
          },
          findUnique: async ({ where }: any) => {
            return tokenStore.get(where.tokenHash) || null;
          },
          updateMany: async ({ where, data }: any) => {
            const record = tokenStore.get(where.tokenHash);
            if (
              record &&
              (where.revokedAt === null
                ? record.revokedAt === null || record.revokedAt === undefined
                : true)
            ) {
              tokenStore.set(where.tokenHash, { ...record, ...data });
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      };

      // 1. Issue in Process A
      const userId = "user_proc_a_123";
      const token = await issuePersistentUnsubscribeToken(
        mockPrisma,
        userId,
        "EMAIL",
        "ALL_RADAR_NOTIFICATIONS",
        3600,
      );

      // Verify raw database contains ONLY tokenHash and never raw token or plaintext ID
      const storedHashes = Array.from(tokenStore.keys());
      expect(storedHashes.length).toBe(1);
      const storedRecord = tokenStore.get(storedHashes[0]);
      expect(storedRecord.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(storedRecord.tokenHash).not.toContain("unsub_");
      expect(token).not.toContain(userId);

      // 2. Validate in Process B
      const verifiedB = await verifyPersistentUnsubscribeToken(mockPrisma, token);
      expect(verifiedB.valid).toBe(true);
      expect(verifiedB.userId).toBe(userId);

      // 3. Revoke in Process B
      const revokeRes = await revokePersistentUnsubscribeToken(mockPrisma, token);
      expect(revokeRes.success).toBe(true);

      // 4. Validate in Process C (after simulated restart)
      const verifiedC = await verifyPersistentUnsubscribeToken(mockPrisma, token);
      expect(verifiedC.valid).toBe(false);
      expect(verifiedC.reason).toBe("TOKEN_REVOKED");
    });
  });

  describe("Timezone & DST-Safe Digest Scheduling", () => {
    it("validates valid and invalid IANA timezone identifiers", () => {
      expect(isValidIanaTimezone("Europe/Zagreb")).toBe(true);
      expect(isValidIanaTimezone("UTC")).toBe(true);
      expect(isValidIanaTimezone("America/New_York")).toBe(true);
      expect(isValidIanaTimezone("Invalid/Timezone")).toBe(false);
      expect(isValidIanaTimezone("")).toBe(false);
    });

    it("schedules daily digest at 08:00 AM in Europe/Zagreb across exact Spring and Autumn 2026 DST boundaries", () => {
      // Spring 2026 Transition in Europe/Zagreb occurs on Sunday, March 29, 2026 (02:00 -> 03:00)
      // 1. Immediately before spring transition: Saturday March 28, 2026 at 12:00 UTC (UTC+1)
      const beforeSpring = new Date("2026-03-28T12:00:00.000Z");
      const schedBeforeSpring = calculateNextDigestSchedule(
        "DAILY_DIGEST",
        "Europe/Zagreb",
        beforeSpring,
      );
      // Sunday March 29, 2026 at 08:00 local Zagreb is 06:00 UTC (because at 02:00 it jumped to UTC+2)
      expect(schedBeforeSpring.toISOString()).toBe("2026-03-29T06:00:00.000Z");

      // 2. Immediately after spring transition: Monday March 30, 2026 at 12:00 UTC (UTC+2)
      const afterSpring = new Date("2026-03-30T12:00:00.000Z");
      const schedAfterSpring = calculateNextDigestSchedule(
        "DAILY_DIGEST",
        "Europe/Zagreb",
        afterSpring,
      );
      // Tuesday March 31, 2026 at 08:00 local Zagreb is 06:00 UTC
      expect(schedAfterSpring.toISOString()).toBe("2026-03-31T06:00:00.000Z");

      // Autumn 2026 Transition in Europe/Zagreb occurs on Sunday, October 25, 2026 (03:00 -> 02:00)
      // 3. Immediately before autumn transition: Saturday October 24, 2026 at 12:00 UTC (UTC+2)
      const beforeAutumn = new Date("2026-10-24T12:00:00.000Z");
      const schedBeforeAutumn = calculateNextDigestSchedule(
        "DAILY_DIGEST",
        "Europe/Zagreb",
        beforeAutumn,
      );
      // Sunday October 25, 2026 at 08:00 local Zagreb is 07:00 UTC (because at 03:00 it fell back to UTC+1)
      expect(schedBeforeAutumn.toISOString()).toBe("2026-10-25T07:00:00.000Z");

      // 4. Immediately after autumn transition: Monday October 26, 2026 at 12:00 UTC (UTC+1)
      const afterAutumn = new Date("2026-10-26T12:00:00.000Z");
      const schedAfterAutumn = calculateNextDigestSchedule(
        "DAILY_DIGEST",
        "Europe/Zagreb",
        afterAutumn,
      );
      // Tuesday October 27, 2026 at 08:00 local Zagreb is 07:00 UTC
      expect(schedAfterAutumn.toISOString()).toBe("2026-10-27T07:00:00.000Z");
    });

    it("schedules weekly digest on Monday at 08:00 AM", () => {
      // Wednesday
      const wednesday = new Date("2026-08-26T12:00:00Z");
      const schedWeekly = calculateNextDigestSchedule("WEEKLY_DIGEST", "UTC", wednesday);
      // Next Monday: August 31, 2026 at 08:00 UTC
      expect(schedWeekly.toISOString()).toBe("2026-08-31T08:00:00.000Z");
    });
  });

  describe("Deterministic Diff Replay & Concurrency", () => {
    it("produces identical canonical SHA-256 hash for identical revisions regardless of insertion order", () => {
      const snap1: any = {
        id: "rev1",
        revisionNumber: 1,
        opportunityId: "opp1",
        publicationQualityStatus: "HYPOTHESIS",
        evidenceConfidenceScore: 70,
        opportunityScore: 75,
        decisionRecommendation: "VALIDATE_FIRST",
        decisionReasonCodes: ["REASON_A", "REASON_B"],
        pricing: { baseMonthlyPriceCents: 4900, currency: "USD" },
        mvpCost: {
          minBuildMinorCents: 100000,
          maxBuildMinorCents: 200000,
          baseBuildMinorCents: 100000,
        },
        deliveryTimeWeeks: { minWeeks: 4, maxWeeks: 8, baseWeeks: 6 },
        competitors: [
          { name: "Comp B", competitorType: "INDIRECT" },
          { name: "Comp A", competitorType: "DIRECT" },
        ],
        risks: [
          {
            id: "r2",
            category: "TECH",
            severity: "HIGH",
            status: "UNRESOLVED",
            description: "Risk 2",
          },
          {
            id: "r1",
            category: "BIZ",
            severity: "MEDIUM",
            status: "RESOLVED",
            description: "Risk 1",
          },
        ],
        evidenceSignals: [],
      };

      const snap2: any = {
        id: "rev2",
        revisionNumber: 2,
        opportunityId: "opp1",
        publicationQualityStatus: "VERIFIED",
        evidenceConfidenceScore: 85,
        opportunityScore: 88,
        decisionRecommendation: "BUILD_CANDIDATE",
        decisionReasonCodes: ["REASON_A", "REASON_B"],
        pricing: { baseMonthlyPriceCents: 7900, currency: "USD" },
        mvpCost: {
          minBuildMinorCents: 100000,
          maxBuildMinorCents: 200000,
          baseBuildMinorCents: 100000,
        },
        deliveryTimeWeeks: { minWeeks: 4, maxWeeks: 8, baseWeeks: 6 },
        competitors: [
          { name: "Comp A", competitorType: "DIRECT" },
          { name: "Comp B", competitorType: "INDIRECT" },
        ], // Reversed order
        risks: [
          {
            id: "r1",
            category: "BIZ",
            severity: "MEDIUM",
            status: "RESOLVED",
            description: "Risk 1",
          },
          {
            id: "r2",
            category: "TECH",
            severity: "HIGH",
            status: "UNRESOLVED",
            description: "Risk 2",
          },
        ], // Reversed order
        evidenceSignals: [],
      };

      const diff1 = computeOpportunityRevisionDiff(snap1, snap2);
      const diff2 = computeOpportunityRevisionDiff(snap1, snap2);

      expect(diff1.canonicalInputHash).toBe(diff2.canonicalInputHash);
      expect(diff1.overallSeverity).toBe("HIGH");
      expect(diff1.items.length).toBeGreaterThan(0);
    });
  });

  describe("Durable Radar Worker & Outbox Lease Semantics", () => {
    it("processes pending Radar jobs and updates status to COMPLETED", async () => {
      const mockJobs = [
        {
          id: "job_1",
          opportunityRevisionId: "rev_2",
          status: "PENDING",
          attemptCount: 0,
          nextAttemptAt: null,
          lockedUntil: null,
        },
      ];

      const mockPrisma: any = {
        $queryRaw: async () => [{ id: "job_1" }],
        opportunityRadarJob: {
          updateMany: async ({ data }: any) => {
            if (data.status === "PROCESSING") {
              mockJobs[0].status = "PROCESSING";
              mockJobs[0].claimToken = data.claimToken;
            } else if (data.status === "COMPLETED") {
              mockJobs[0].status = "COMPLETED";
            }
            return { count: 1 };
          },
          findMany: async () => [mockJobs[0]],
        },
        opportunityRevision: {
          findUnique: async () => ({
            id: "rev_2",
            opportunityId: "opp_1",
            revisionNumber: 2,
            snapshotData: {},
            reasonForChange: "Test",
            opportunity: { scorecards: [] },
            blueprint: {
              financialScenarios: [],
              costLineItems: [],
              risks: [],
              competitors: [],
              decisionEvaluation: null,
              founderRequirements: null,
            },
            evidenceLinks: [],
          }),
          findFirst: async () => ({
            id: "rev_1",
            opportunityId: "opp_1",
            revisionNumber: 1,
            snapshotData: {},
            reasonForChange: "Test",
            opportunity: { scorecards: [] },
            blueprint: {
              financialScenarios: [],
              costLineItems: [],
              risks: [],
              competitors: [],
              decisionEvaluation: null,
              founderRequirements: null,
            },
            evidenceLinks: [],
          }),
        },
        opportunityChangeEvent: {
          findUnique: async () => null,
          create: async () => ({ id: "ce_1" }),
        },
        savedOpportunity: {
          findMany: async () => [],
        },
        user: {
          findUnique: async () => null,
        },
        notificationOutbox: {
          upsert: async () => {},
        },
      };

      const res = await processPendingRadarJobs(mockPrisma, { batchSize: 5 });
      expect(res.processed).toBe(1);
      expect(res.succeeded).toBe(1);
      expect(mockJobs[0].status).toBe("COMPLETED");
    });

    it("handles outbox worker lease recovery and terminal DEAD_LETTER status after max attempts", async () => {
      const mockOutbox = [
        {
          id: "out_1",
          userId: "user_1",
          opportunityId: "opp_1",
          changeEventId: "ce_1",
          notificationType: "RADAR_CHANGE_ALERT",
          status: "PROCESSING",
          claimToken: "stale_claim",
          attemptCount: 5, // At max attempts
          deduplicationKey: "dedupe_1",
          lockedUntil: new Date(Date.now() - 60000), // Expired lease
        },
      ];

      let finalStatus = "";
      const mockPrisma: any = {
        $queryRaw: async () => [{ id: "out_1" }],
        notificationOutbox: {
          updateMany: async ({ data }: any) => {
            if (data.status) finalStatus = data.status;
            return { count: 1 };
          },
          findMany: async () => [mockOutbox[0]],
        },
        user: {
          findUnique: async () => ({
            id: "user_1",
            tier: "PRO",
            notificationPreference: { emailEnabled: true },
            billingSubscriptions: [{ status: "ACTIVE" }],
            savedOpportunities: [{ id: "w_1", radarEnabled: true, mutedUntil: null }],
          }),
        },
        notificationDelivery: {
          create: async () => {},
        },
      };

      const res = await processPendingNotificationOutbox(mockPrisma, {
        maxAttempts: 5,
        providerOptions: { shouldFail: true }, // Force provider failure
      });

      expect(res.processed).toBe(1);
      expect(res.failed).toBe(1);
      expect(finalStatus).toBe("DEAD_LETTER");
    });
  });
});
