import { describe, it, expect, beforeEach } from "vitest";
import { executeManualStagingIngestion } from "../src/index.js";

function createMockPrisma() {
  const store = {
    ingestionRuns: [] as any[],
    sources: [
      { id: "src-hn", key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280 },
      { id: "src-gh", key: "github", name: "GitHub", isEnabled: true, permittedExcerptLength: 280 },
      { id: "src-rd", key: "reddit", name: "Reddit", isEnabled: true, permittedExcerptLength: 280 },
      { id: "src-ph", key: "producthunt", name: "Product Hunt", isEnabled: true, permittedExcerptLength: 280 },
    ] as any[],
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

  const prisma: any = {
    _store: store,
    $transaction: async (fn: any) => fn(prisma),
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
          if (where.isEnabled !== undefined && s.isEnabled !== where.isEnabled) return false;
          if (where.key?.in && !where.key.in.includes(s.key)) return false;
          return true;
        });
        if (take) list = list.slice(0, take);
        return list;
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
        if (where.contentHash) {
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

  return prisma;
}

describe("Staging Manual Ingestion Unit & Hardening Suite", () => {
  let prisma: any;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  describe("Durable Claim, Lease Recovery & Concurrency Semantics", () => {
    it("atomically claims a new run and transitions status to COMPLETED upon successful ingestion", async () => {
      const key = "run-test-success-001";
      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: key,
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.idempotencyKey).toBe(key);
      expect(result.counters.fetched).toBeGreaterThan(0);
      expect(result.counters.published).toBeGreaterThan(0);
      expect(result.publishedSlugs.length).toBeGreaterThan(0);
    });

    it("returns existing completed run when called with duplicate Idempotency-Key", async () => {
      const key = "run-test-idempotent-002";
      const run1 = await executeManualStagingIngestion(prisma, { idempotencyKey: key });
      expect(run1.status).toBe("COMPLETED");

      const run2 = await executeManualStagingIngestion(prisma, { idempotencyKey: key });
      expect(run2.status).toBe("COMPLETED");
      expect(run2.runId).toBe(run1.runId);
      expect(run2.isExisting).toBe(true);
      expect(run2.publishedSlugs).toEqual(run1.publishedSlugs);
    });

    it("rejects concurrent execution when another run is currently locked in PROCESSING", async () => {
      const key1 = "run-test-active-003";
      await prisma.ingestionRun.create({
        data: {
          idempotencyKey: key1,
          status: "PROCESSING",
          claimToken: "token-123",
          lockedBy: "worker-1",
          lockedAt: new Date(),
          lockedUntil: new Date(Date.now() + 60000),
          startedAt: new Date(),
        },
      });

      const key2 = "run-test-active-004";
      const result2 = await executeManualStagingIngestion(prisma, { idempotencyKey: key2 });
      expect(result2.status).toBe("FAILED");
      expect(result2.failureCode).toBe("CONCURRENT_RUN_IN_PROGRESS");
    });

    it("reclaims expired PROCESSING lease safely", async () => {
      const key = "run-test-expired-005";
      const expiredRun = await prisma.ingestionRun.create({
        data: {
          idempotencyKey: key,
          status: "PROCESSING",
          claimToken: "token-stale-000",
          lockedBy: "worker-stale",
          lockedAt: new Date(Date.now() - 120000),
          lockedUntil: new Date(Date.now() - 60000),
          attemptCount: 1,
          startedAt: new Date(Date.now() - 120000),
        },
      });

      const result = await executeManualStagingIngestion(prisma, { idempotencyKey: key });
      expect(result.status).toBe("COMPLETED");
      expect(result.runId).toBe(expiredRun.id);

      const dbRun = await prisma.ingestionRun.findUnique({ where: { id: expiredRun.id } });
      expect(dbRun.attemptCount).toBe(2);
    });
  });

  describe("Source, Copyright & Content Deduplication Controls", () => {
    it("fails safely with NO_ACTIVE_SOURCES when all staging sources are disabled", async () => {
      for (const s of prisma._store.sources) {
        s.isEnabled = false;
      }

      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-no-sources-006",
      });

      expect(result.status).toBe("FAILED");
      expect(result.failureCode).toBe("NO_ACTIVE_SOURCES");
      expect(result.counters.published).toBe(0);
    });

    it("enforces strict maximum limits: <= 5 sources, <= 30 items, <= 20 raw signals, <= 5 candidates, <= 3 published", async () => {
      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-strict-limits-007",
        maxSources: 5,
        maxFetchItems: 30,
        maxRawSignals: 20,
        maxCandidates: 5,
        maxPublishedOpportunities: 3,
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.counters.fetched).toBeLessThanOrEqual(30);
      expect(result.counters.rawSignals).toBeLessThanOrEqual(20);
      expect(result.counters.candidates).toBeLessThanOrEqual(5);
      expect(result.counters.published).toBeLessThanOrEqual(3);
    });

    it("deduplicates identical content hashes without duplicating RawSignals or Opportunities", async () => {
      const run1 = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-dedup-008",
      });
      const initialRawCount = prisma._store.rawSignals.length;

      const run2 = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-dedup-009",
      });

      expect(run2.counters.deduplicated).toBeGreaterThan(0);
      expect(prisma._store.rawSignals.length).toBe(initialRawCount);
    });

    it("stores only short excerpts and never stores full articles (> 280 chars)", async () => {
      await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-copyright-010",
      });

      for (const raw of prisma._store.rawSignals) {
        expect(raw.rawContent.length).toBeLessThanOrEqual(280);
      }
      for (const norm of prisma._store.normalizedSignals) {
        expect(norm.sanitizedExcerpt.length).toBeLessThanOrEqual(280);
      }
    });
  });

  describe("AI Controls & Fault Tolerance", () => {
    it("fails safely with AI_PROVIDER_NOT_CONFIGURED when AI throws unconfigured error", async () => {
      const faultyAI: any = {
        name: "faulty",
        generateStructured: async () => {
          throw new Error("Agnes AI API Key not configured");
        },
        generateEmbedding: async () => ({ embedding: new Array(64).fill(0), dimensions: 64, costMinorUnits: 1 }),
      };

      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-ai-unconfigured-011",
        aiProvider: faultyAI,
      });

      expect(result.status).toBe("FAILED");
      expect(result.failureCode).toBe("AI_PROVIDER_NOT_CONFIGURED");
    });
  });

  describe("Security & Secret Hygiene", () => {
    it("contains no secrets, passwords, or database URLs in returned report", async () => {
      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-hygiene-012",
      });

      const json = JSON.stringify(result);
      expect(json).not.toContain("postgres://");
      expect(json).not.toContain("postgresql://");
      expect(json).not.toContain("password");
      expect(json).not.toContain("sk-");
      expect(json).not.toContain("secret");
    });
  });
});