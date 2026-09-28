import { describe, it, expect, vi } from "vitest";
import { MockDeterministicProvider } from "@buildworth/ai";
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
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("algolia")) {
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "999901",
                  title: "Ask HN: Handling multi-cloud reconciliation drift",
                  story_text: "Manual reconciliation process causing recurring delays in multi-cloud infrastructure.",
                  author: "devops_lead",
                  created_at: new Date().toISOString(),
                  points: 80,
                  num_comments: 25,
                },
              ],
            }),
          } as any;
        }
        if (urlStr.includes("github.com")) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 888801,
                  html_url: "https://github.com/org/repo/issues/888801",
                  title: "Reconciliation process bottleneck in pipeline",
                  body: "Engineering teams experience recurring delays due to lack of automated reconciliation tooling.",
                  user: { login: "gh_lead" },
                  created_at: new Date().toISOString(),
                  comments: 10,
                },
              ],
            }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({ hits: [], items: [] }),
        } as any;
      });

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
            if (where.idempotencyKey) {
              return store.ingestionRuns.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
            }
            if (where.id) {
              return store.ingestionRuns.find((r) => r.id === where.id) || null;
            }
            return null;
          },
          findFirst: async ({ where }: any) => {
            return store.ingestionRuns.find((r) => {
              if (where.status && r.status !== where.status) return false;
              if (where.lockedUntil?.gt && !(r.lockedUntil > where.lockedUntil.gt)) return false;
              return true;
            }) || null;
          },
          create: async ({ data }: any) => {
            const record = { id: "run-" + (store.ingestionRuns.length + 1), ...data, createdAt: new Date(), updatedAt: new Date() };
            store.ingestionRuns.push(record);
            return record;
          },
          update: async ({ where, data }: any) => {
            const item = store.ingestionRuns.find((r) => r.id === where.id);
            if (!item) throw new Error("Not found");
            const patch = { ...data };
            if (patch.attemptCount?.increment) {
              patch.attemptCount = (item.attemptCount || 0) + patch.attemptCount.increment;
            }
            Object.assign(item, patch, { updatedAt: new Date() });
            return item;
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const item of store.ingestionRuns) {
              if (where.id && item.id !== where.id) continue;
              if (where.claimToken && item.claimToken !== where.claimToken) continue;
              Object.assign(item, data, { updatedAt: new Date() });
              count++;
            }
            return { count };
          },
        },
        source: {
          findMany: async ({ where, take }: any) => {
            let list = store.sources.filter((s) => {
              if (where?.isEnabled !== undefined && s.isEnabled !== where.isEnabled) return false;
              if (where?.key?.in && !where.key.in.includes(s.key)) return false;
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
          count: async () => store.sources.length,
          upsert: async ({ where, update, create }: any) => {
            const item = store.sources.find((s) => s.key === where.key || s.id === where.id);
            if (item) {
              Object.assign(item, update);
              return item;
            }
            const rec = { id: "src-" + (store.sources.length + 1), ...create };
            store.sources.push(rec);
            return rec;
          },
        },
        sourceRun: {
          create: async ({ data }: any) => {
            const rec = { id: "srun-" + (store.sourceRuns.length + 1), ...data };
            store.sourceRuns.push(rec);
            return rec;
          },
          update: async ({ where, data }: any) => {
            const item = store.sourceRuns.find((s) => s.id === where.id);
            if (item) Object.assign(item, data);
            return item;
          },
        },
        rawSignal: {
          findUnique: async ({ where }: any) => {
            if (where?.contentHash) {
              return store.rawSignals.find((r) => r.contentHash === where.contentHash) || null;
            }
            return null;
          },
          create: async ({ data }: any) => {
            const rec = { id: "raw-" + (store.rawSignals.length + 1), ...data };
            store.rawSignals.push(rec);
            return rec;
          },
        },
        normalizedSignal: {
          findMany: async ({ take }: any) => {
            let list = [...store.normalizedSignals];
            if (take) list = list.slice(0, take);
            return list;
          },
          findFirst: async ({ where }: any) => {
            return store.normalizedSignals.find((n) => {
              if (where?.rawSignalId && n.rawSignalId !== where.rawSignalId) return false;
              return true;
            }) || null;
          },
          findUnique: async ({ where, include }: any) => {
            const item = store.normalizedSignals.find((n) => n.id === where.id);
            if (!item) return null;
            if (include?.rawSignal) {
              const raw = store.rawSignals.find((r) => r.id === item.rawSignalId);
              const src = raw ? store.sources.find((s) => s.id === raw.sourceId) : null;
              return {
                ...item,
                rawSignal: raw ? { ...raw, source: src } : null,
              };
            }
            return item;
          },
          create: async ({ data }: any) => {
            const rec = { id: "norm-" + (store.normalizedSignals.length + 1), ...data };
            store.normalizedSignals.push(rec);
            return rec;
          },
          update: async ({ where, data }: any) => {
            const item = store.normalizedSignals.find((s) => s.id === where.id);
            if (item) Object.assign(item, data);
            return item;
          },
        },
        opportunity: {
          findUnique: async ({ where }: any) => {
            return store.opportunities.find((o) => o.slug === where.slug || o.id === where.id) || null;
          },
          findUniqueOrThrow: async ({ where }: any) => {
            const found = store.opportunities.find((o) => o.slug === where.slug || o.id === where.id);
            if (!found) throw new Error("Opp not found");
            return found;
          },
          findMany: async ({ where, take, include }: any) => {
            let list = [...store.opportunities];
            if (where?.isDemoFixture !== undefined) {
              list = list.filter((o) => (o.isDemoFixture || false) === where.isDemoFixture);
            }
            if (include?.evidenceLinks) {
              list = list.map((opp) => {
                const evLinks = store.evidenceLinks.filter((el) => el.opportunityId === opp.id);
                const enrichedLinks = evLinks.map((el) => {
                  const ns = store.normalizedSignals.find((n) => n.id === el.normalizedSignalId);
                  let enrichedNs = ns;
                  if (ns && include.evidenceLinks.include?.normalizedSignal?.include?.rawSignal) {
                    const raw = store.rawSignals.find((r) => r.id === ns.rawSignalId);
                    const src = raw ? store.sources.find((s) => s.id === raw.sourceId) : null;
                    enrichedNs = { ...ns, rawSignal: raw ? { ...raw, source: src } : null };
                  }
                  return { ...el, normalizedSignal: enrichedNs };
                });
                const sc = store.scorecards.find((s) => s.opportunityId === opp.id);
                return { ...opp, scorecard: sc || null, evidenceLinks: enrichedLinks };
              });
            }
            if (take) list = list.slice(0, take);
            return list;
          },
          create: async ({ data }: any) => {
            const rec = { id: "opp-" + (store.opportunities.length + 1), ...data };
            store.opportunities.push(rec);
            return rec;
          },
          update: async ({ where, data }: any) => {
            const item = store.opportunities.find((o) => o.id === where.id);
            if (item) Object.assign(item, data);
            return item;
          },
        },
        scorecard: {
          findFirst: async ({ where }: any) => {
            return store.scorecards.find((s) => s.opportunityId === where.opportunityId) || null;
          },
          create: async ({ data }: any) => {
            const rec = { id: "sc-" + (store.scorecards.length + 1), ...data };
            store.scorecards.push(rec);
            return rec;
          },
        },
        opportunityRevision: {
          findFirst: async ({ where }: any) => {
            const revs = store.revisions.filter((r) => r.opportunityId === where.opportunityId);
            return revs[revs.length - 1] || null;
          },
          create: async ({ data }: any) => {
            const rec = { id: "rev-" + (store.revisions.length + 1), ...data };
            store.revisions.push(rec);
            return rec;
          },
        },
        opportunityBlueprint: {
          create: async ({ data }: any) => {
            const rec = { id: "bp-" + (store.blueprints.length + 1), ...data };
            store.blueprints.push(rec);
            return rec;
          },
        },
        blueprintCustomerSegment: { create: async ({ data }: any) => data },
        blueprintMvpFeature: { create: async ({ data }: any) => data },
        blueprintCompetitor: { create: async ({ data }: any) => data },
        financialScenario: { create: async ({ data }: any) => data },
        costLineItem: { create: async ({ data }: any) => data },
        benefitDriver: { create: async ({ data }: any) => data },
        blueprintRisk: { create: async ({ data }: any) => data },
        blueprintAssumption: { create: async ({ data }: any) => data },
        validationExperiment: { create: async ({ data }: any) => data },
        decisionEvaluation: { create: async ({ data }: any) => data },
        opportunityRadarJob: { create: async ({ data }: any) => data },
        auditLog: {
          create: async ({ data }: any) => {
            store.auditLogs.push(data);
            return data;
          },
        },
        evidenceLink: {
          create: async ({ data }: any) => {
            const rec = { id: "evlink-" + (store.evidenceLinks.length + 1), ...data };
            store.evidenceLinks.push(rec);
            return rec;
          },
        },
      };

      try {
        const sharedKey = getDailyCronIdempotencyKey(new Date("2026-09-25T01:15:00.000Z"));
        const mockAi = new MockDeterministicProvider();

        // Caller 1 (e.g. Vercel Cron or Fallback running first) executes successfully
        const firstResult = await executeManualStagingIngestion(mockPrisma, {
          idempotencyKey: sharedKey,
          workerId: "caller-1",
          aiProvider: mockAi,
        });
        expect(firstResult.status).toBe("COMPLETED");
        expect(firstResult.isExisting).toBeFalsy();

        // Caller 2 (e.g. Fallback scheduled 01:15 UTC when Vercel already ran, or vice-versa)
        const secondResult = await executeManualStagingIngestion(mockPrisma, {
          idempotencyKey: sharedKey,
          workerId: "caller-2",
          aiProvider: mockAi,
        });
        expect(secondResult.status).toBe("COMPLETED");
        expect(secondResult.isExisting).toBe(true);
        expect(secondResult.runId).toBe(firstResult.runId);

        // Verify only ONE IngestionRun was created in the database
        expect(store.ingestionRuns).toHaveLength(1);
      } finally {
        fetchSpy.mockRestore();
      }
    });

  });
});

