import { describe, it, expect, vi } from "vitest";
import { verifyCronAuthorization } from "../src/ingestion/cron-auth.js";
import { executeManualStagingIngestion } from "../src/index.js";

describe("Scheduled Cron Discovery Strict Authentication & Concurrency Suite", () => {
  const VALID_SECRET = "production_cron_secret_high_entropy_32_characters_long";

  describe("verifyCronAuthorization security rules", () => {
    it("fails closed with 401 when no headers or authorization are supplied", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        authorizationHeader: null,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.error).toBe("Unauthorized: Valid Cron authentication required");
    });

    it("fails closed with 401 when spoofed Vercel User-Agent is supplied without bearer", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        userAgent: "vercel-cron/1.0",
        authorizationHeader: null,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("fails closed with 401 when spoofed x-vercel-cron header is supplied without bearer", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        vercelCronHeader: "1",
        authorizationHeader: null,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("fails closed with 401 when both spoofed headers are supplied without bearer", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        userAgent: "vercel-cron/1.0",
        vercelCronHeader: "1",
        vercelCronSchedule: "0 0 * * *",
        authorizationHeader: null,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("fails closed with 401 when only x-vercel-cron-schedule is supplied without bearer", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        vercelCronSchedule: "0 0 * * *",
        authorizationHeader: null,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("fails closed with 401 when incorrect bearer token is supplied", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        authorizationHeader: "Bearer invalid_bearer_token_123456",
        userAgent: "vercel-cron/1.0",
        vercelCronHeader: "1",
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it("fails closed with 401 when server CRON_SECRET is missing or empty", () => {
      const res1 = verifyCronAuthorization({
        serverCronSecret: undefined,
        authorizationHeader: `Bearer ${VALID_SECRET}`,
      });
      expect(res1.authorized).toBe(false);
      expect(res1.statusCode).toBe(401);

      const res2 = verifyCronAuthorization({
        serverCronSecret: "too-short",
        authorizationHeader: "Bearer too-short",
      });
      expect(res2.authorized).toBe(false);
      expect(res2.statusCode).toBe(401);
    });

    it("fails closed with 403 when secrets are passed in query params", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        hasQueryParamsSecret: true,
        authorizationHeader: `Bearer ${VALID_SECRET}`,
      });
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.error).toBe("Query secrets are strictly forbidden");
    });

    it("accepts valid Bearer token using constant-time equality and attaches diagnostic metadata", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        authorizationHeader: `Bearer ${VALID_SECRET}`,
        vercelCronHeader: "1",
        vercelCronSchedule: "0 0 * * *",
      });
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.diagnostics?.hasVercelCronHeader).toBe(true);
      expect(res.diagnostics?.cronSchedule).toBe("0 0 * * *");
    });

    it("does not leak secret values in response or errors", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        authorizationHeader: "Bearer bad_secret",
      });
      expect(JSON.stringify(res)).not.toContain(VALID_SECRET);
      expect(JSON.stringify(res)).not.toContain("bad_secret");
    });

    it("ensures spoofed headers never bypass authentication or authorize ingestion", () => {
      // Attacker attempts every combination of spoofed headers without the bearer token
      const spoofedAttempts = [
        { userAgent: "vercel-cron/1.0" },
        { vercelCronHeader: "1" },
        { vercelCronSchedule: "0 0 * * *" },
        { userAgent: "vercel-cron/1.0", vercelCronHeader: "1" },
        { userAgent: "vercel-cron/1.0", vercelCronSchedule: "0 0 * * *" },
        { vercelCronHeader: "1", vercelCronSchedule: "0 0 * * *" },
        { userAgent: "vercel-cron/1.0", vercelCronHeader: "1", vercelCronSchedule: "0 0 * * *" },
      ];

      for (const attempt of spoofedAttempts) {
        const res = verifyCronAuthorization({
          serverCronSecret: VALID_SECRET,
          authorizationHeader: null,
          ...attempt,
        });
        expect(res.authorized).toBe(false);
        expect(res.statusCode).toBe(401);
      }
    });

    it("verifies legitimate invocation with valid Bearer token and Vercel headers is accepted", () => {
      const res = verifyCronAuthorization({
        serverCronSecret: VALID_SECRET,
        authorizationHeader: `Bearer ${VALID_SECRET}`,
        userAgent: "vercel-cron/1.0",
        vercelCronHeader: "1",
        vercelCronSchedule: "0 0 * * *",
      });
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.diagnostics?.hasVercelCronHeader).toBe(true);
      expect(res.diagnostics?.cronSchedule).toBe("0 0 * * *");
    });
  });

  describe("Lease-protected overlapping execution invariants", () => {
    it("rejects concurrent execution when another worker has an active lease on the run", async () => {
      const store = {
        ingestionRuns: [] as any[],
        sources: [
          { id: "src-hn", key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280 },
        ],
        sourceRuns: [] as any[],
        rawSignals: [] as any[],
        normalizedSignals: [] as any[],
        opportunities: [] as any[],
        scorecards: [] as any[],
        revisions: [] as any[],
        blueprints: [] as any[],
        evidenceLinks: [] as any[],
        auditLogs: [] as any[],
      };

      const mockPrisma: any = {
        _store: store,
        $transaction: async (fn: any) => fn(mockPrisma),
        $executeRawUnsafe: async () => {},
        ingestionRun: {
          findUnique: async ({ where }: any) => {
            return store.ingestionRuns.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
          },
          findFirst: async ({ where }: any) => {
            return store.ingestionRuns.find((r) => {
              if (where.status && r.status !== where.status) return false;
              if (where.lockedUntil?.gt && !(r.lockedUntil > where.lockedUntil.gt)) return false;
              return true;
            }) || null;
          },
          create: async ({ data }: any) => {
            const record = { id: "run-" + (store.ingestionRuns.length + 1), ...data };
            store.ingestionRuns.push(record);
            return record;
          },
          update: async ({ where, data }: any) => {
            const item = store.ingestionRuns.find((r) => r.id === where.id);
            if (!item) throw new Error("Not found");
            Object.assign(item, data);
            return item;
          },
        },
      };

      // 1. First worker locks the lease
      await mockPrisma.ingestionRun.create({
        data: {
          idempotencyKey: "cron-overlap-test-key-1",
          status: "PROCESSING",
          claimToken: "token-worker-1",
          lockedBy: "worker-1",
          lockedAt: new Date(),
          lockedUntil: new Date(Date.now() + 60000), // active for 60 seconds
          startedAt: new Date(),
        },
      });

      // 2. Second overlapping worker attempts execution
      const overlappingResult = await executeManualStagingIngestion(mockPrisma, {
        idempotencyKey: "cron-overlap-test-key-2",
        workerId: "worker-2",
      });

      expect(overlappingResult.status).toBe("FAILED");
      expect(overlappingResult.failureCode).toBe("CONCURRENT_RUN_IN_PROGRESS");
    });
  });
});
