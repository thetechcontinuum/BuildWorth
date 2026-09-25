import { describe, it, expect, vi } from "vitest";
import { verifyCronAuthorization, getDailyCronIdempotencyKey } from "../src/ingestion/cron-auth.js";
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

  describe("Route-level /api/cron/discover handler authorization tests", () => {
    // Simulates the exact route handler logic in apps/web/src/app/api/cron/discover/route.ts
    const simulateRouteHandler = (req: {
      headers: Record<string, string | null>;
      searchParams: Record<string, string>;
      secretEnv: string | null;
    }) => {
      const hasQueryParamsSecret =
        "secret" in req.searchParams ||
        "key" in req.searchParams ||
        "cron_secret" in req.searchParams;

      const authResult = verifyCronAuthorization({
        authorizationHeader: req.headers["authorization"],
        hasQueryParamsSecret,
        serverCronSecret: req.secretEnv,
        userAgent: req.headers["user-agent"],
        vercelCronHeader: req.headers["x-vercel-cron"],
        vercelCronSchedule: req.headers["x-vercel-cron-schedule"],
      });

      if (!authResult.authorized) {
        return {
          status: authResult.statusCode,
          body: { error: authResult.error },
        };
      }

      return {
        status: 200,
        body: { success: true, diagnostics: authResult.diagnostics },
      };
    };

    it("route returns 401 on unauthenticated GET request", () => {
      const res = simulateRouteHandler({
        headers: {},
        searchParams: {},
        secretEnv: VALID_SECRET,
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized: Valid Cron authentication required");
    });

    it("route returns 401 when attacker spoofs user-agent and vercel-cron headers without bearer", () => {
      const res = simulateRouteHandler({
        headers: {
          "user-agent": "vercel-cron/1.0",
          "x-vercel-cron": "1",
        },
        searchParams: {},
        secretEnv: VALID_SECRET,
      });
      expect(res.status).toBe(401);
    });

    it("route returns 403 when query-string secret is passed", () => {
      const res = simulateRouteHandler({
        headers: {
          authorization: `Bearer ${VALID_SECRET}`,
        },
        searchParams: { secret: VALID_SECRET },
        secretEnv: VALID_SECRET,
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Query secrets are strictly forbidden");
    });

    it("route returns 200 on authorized Vercel cron invocation", () => {
      const res = simulateRouteHandler({
        headers: {
          authorization: `Bearer ${VALID_SECRET}`,
          "user-agent": "vercel-cron/1.0",
          "x-vercel-cron": "1",
          "x-vercel-cron-schedule": "0 0 * * *",
        },
        searchParams: {},
        secretEnv: VALID_SECRET,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.diagnostics?.hasVercelCronHeader).toBe(true);
    });

    it("route returns 200 on authorized GitHub Actions fallback invocation (without Vercel headers)", () => {
      const res = simulateRouteHandler({
        headers: {
          authorization: `Bearer ${VALID_SECRET}`,
          "user-agent": "GitHub-Actions-Ingestion-Fallback",
        },
        searchParams: {},
        secretEnv: VALID_SECRET,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.diagnostics?.hasVercelCronHeader).toBe(false);
    });
  });

  describe("Deterministic per-UTC-day idempotency across callers", () => {
    it("produces identical idempotency keys for both Vercel Cron and fallback callers on the same UTC day", () => {
      // 00:00 UTC (Vercel Cron schedule)
      const vercelCronTime = new Date("2026-09-25T00:00:15.000Z");
      // 01:15 UTC (GitHub Actions scheduled fallback)
      const fallbackTime = new Date("2026-09-25T01:15:30.000Z");
      // 08:30 UTC (manual recovery dispatch on the same day)
      const manualDispatchTime = new Date("2026-09-25T08:30:00.000Z");

      const key1 = getDailyCronIdempotencyKey(vercelCronTime);
      const key2 = getDailyCronIdempotencyKey(fallbackTime);
      const key3 = getDailyCronIdempotencyKey(manualDispatchTime);

      expect(key1).toBe("cron-prod-ingest-2026-09-25");
      expect(key2).toBe("cron-prod-ingest-2026-09-25");
      expect(key3).toBe("cron-prod-ingest-2026-09-25");
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it("produces a different idempotency key on the next UTC day", () => {
      const day1 = new Date("2026-09-25T23:59:59.000Z");
      const day2 = new Date("2026-09-26T00:00:01.000Z");

      expect(getDailyCronIdempotencyKey(day1)).toBe("cron-prod-ingest-2026-09-25");
      expect(getDailyCronIdempotencyKey(day2)).toBe("cron-prod-ingest-2026-09-26");
      expect(getDailyCronIdempotencyKey(day1)).not.toBe(getDailyCronIdempotencyKey(day2));
    });

    it("prevents duplicate execution when either caller runs first on the same day", async () => {
      const store = {
        ingestionRuns: [] as any[],
        sources: [
          { id: "src-hn", key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280 },
          { id: "src-gh", key: "github", name: "GitHub", isEnabled: true, permittedExcerptLength: 280 },
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
            const record = { id: "run-" + (store.ingestionRuns.length + 1), ...data, createdAt: new Date() };
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
        source: {
          findMany: async ({ where, take }: any) => {
            let list = store.sources.filter((s) => {
              if (where?.isEnabled !== undefined && s.isEnabled !== where.isEnabled) return false;
              return true;
            });
            if (take) list = list.slice(0, take);
            return list;
          },
          create: async ({ data }: any) => {
            const rec = { id: "src-" + (store.sources.length + 1), ...data };
            store.sources.push(rec);
            return rec;
          },
          update: async ({ where, data }: any) => {
            const item = store.sources.find((s) => s.id === where.id);
            if (item) Object.assign(item, data);
            return item;
          },
        },
        sourceRun: {
          create: async ({ data }: any) => data,
          update: async ({ data }: any) => data,
        },
        rawSignal: {
          findUnique: async () => null,
          create: async ({ data }: any) => ({ id: "raw-1", ...data }),
        },
        normalizedSignal: {
          findMany: async () => [],
          findFirst: async () => null,
          findUnique: async () => null,
          create: async ({ data }: any) => ({ id: "norm-1", ...data }),
        },
        opportunity: {
          findMany: async () => [],
          findUnique: async () => null,
          create: async ({ data }: any) => ({ id: "opp-1", ...data }),
          update: async ({ data }: any) => data,
        },
        auditLog: {
          create: async ({ data }: any) => {
            store.auditLogs.push(data);
            return data;
          },
        },
      };

      const sharedKey = getDailyCronIdempotencyKey(new Date("2026-09-25T01:15:00.000Z"));


      // Caller 1 (e.g. Vercel Cron or Fallback running first) executes successfully
      const firstResult = await executeManualStagingIngestion(mockPrisma, {
        idempotencyKey: sharedKey,
        workerId: "caller-1",
      });
      expect(firstResult.status).toBe("COMPLETED");
      expect(firstResult.isExisting).toBeFalsy();

      // Caller 2 (e.g. Fallback scheduled 01:15 UTC when Vercel already ran, or vice-versa)
      const secondResult = await executeManualStagingIngestion(mockPrisma, {
        idempotencyKey: sharedKey,
        workerId: "caller-2",
      });
      expect(secondResult.status).toBe("COMPLETED");
      expect(secondResult.isExisting).toBe(true);
      expect(secondResult.runId).toBe(firstResult.runId);

      // Verify only ONE IngestionRun was created in the database
      expect(store.ingestionRuns).toHaveLength(1);
    });
  });
});

