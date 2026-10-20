import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockDeterministicProvider } from "@buildworth/ai";
import {
  executeManualStagingIngestion,
  parseSourceProgressState,
  pickQueriesForSourceWithRotation,
  DEFAULT_FOCUSED_DOMAIN_QUERIES,
} from "../src/index.js";

function createMockPrisma() {
  const store = {
    opportunities: [] as any[],
    scorecards: [] as any[],
    revisions: [] as any[],
    blueprints: [] as any[],
    evidenceLinks: [] as any[],
    rawSignals: [] as any[],
    normalizedSignals: [] as any[],
    ingestionRuns: [] as any[],
    sources: [
      {
        id: "src-hn",
        key: "hackernews",
        name: "Hacker News",
        isEnabled: true,
        permittedExcerptLength: 280,
        sourceFamily: "COMMUNITY",
        storageRestrictions: null as string | null,
        lastSuccessfulCollection: null as Date | null,
      },
      {
        id: "src-gh",
        key: "github",
        name: "GitHub",
        isEnabled: true,
        permittedExcerptLength: 280,
        sourceFamily: "DEVELOPER_ECOSYSTEM",
        storageRestrictions: null as string | null,
        lastSuccessfulCollection: null as Date | null,
      },
      {
        id: "src-so",
        key: "stackexchange",
        name: "Stack Overflow",
        isEnabled: true,
        permittedExcerptLength: 280,
        sourceFamily: "COMMUNITY",
        storageRestrictions: null as string | null,
        lastSuccessfulCollection: null as Date | null,
      },
    ] as any[],
    sourceRuns: [] as any[],
  };

  const prisma: any = {
    _store: store,
    $transaction: async (fn: any) => fn(prisma),
    $executeRawUnsafe: async () => 0,
    ingestionRun: {
      findFirst: async ({ where }: any) => {
        return store.ingestionRuns.find((r) => r.idempotencyKey === where?.idempotencyKey) || null;
      },
      findUnique: async ({ where }: any) => {
        return store.ingestionRuns.find((r) => r.id === where?.id) || null;
      },
      create: async ({ data }: any) => {
        const item = { id: "run-" + (store.ingestionRuns.length + 1), ...data, createdAt: new Date() };
        store.ingestionRuns.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.ingestionRuns.find((r) => r.id === where.id);
        if (!item) throw new Error("Not found");
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      updateMany: async ({ data }: any) => {
        for (const item of store.ingestionRuns) {
          Object.assign(item, data, { updatedAt: new Date() });
        }
        return { count: store.ingestionRuns.length };
      },
    },
    auditLog: {
      create: async () => ({ id: "audit-1" }),
    },
    source: {
      findFirst: async ({ where }: any) => {
        return store.sources.find((s) => {
          if (where?.key && s.key !== where.key) return false;
          if (where?.isEnabled !== undefined && s.isEnabled !== where.isEnabled) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where, take }: any = {}) => {
        let list = store.sources.filter((s) => {
          if (where?.isEnabled !== undefined && s.isEnabled !== where.isEnabled) return false;
          if (where?.key?.in && !where.key.in.includes(s.key)) return false;
          return true;
        });
        if (take) list = list.slice(0, take);
        return list;
      },
      update: async ({ where, data }: any) => {
        const item = store.sources.find((s) => s.id === where.id || s.key === where.key);
        if (item) Object.assign(item, data);
        return item;
      },
      upsert: async ({ create }: any) => {
        const item = { id: "src-" + (store.sources.length + 1), ...create };
        store.sources.push(item);
        return item;
      },
    },
    sourceRun: {
      create: async ({ data }: any) => {
        const item = { id: "srun-" + (store.sourceRuns.length + 1), ...data };
        store.sourceRuns.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.sourceRuns.find((r) => r.id === where.id);
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
      findFirst: async ({ where, orderBy }: any = {}) => {
        let list = [...store.rawSignals];
        if (where?.sourceId) list = list.filter((r) => r.sourceId === where.sourceId);
        if (orderBy?.publishedAt === "desc") {
          list.sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
        }
        return list[0] || null;
      },
      findMany: async ({ where, orderBy, take }: any = {}) => {
        let list = [...store.rawSignals];
        if (where?.sourceId) list = list.filter((r) => r.sourceId === where.sourceId);
        if (orderBy?.publishedAt === "desc") {
          list.sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
        }
        if (take) list = list.slice(0, take);
        return list;
      },
      create: async ({ data }: any) => {
        const item = { id: "raw-" + (store.rawSignals.length + 1), ...data };
        store.rawSignals.push(item);
        return item;
      },
      count: async () => store.rawSignals.length,
    },
    normalizedSignal: {
      findFirst: async ({ where }: any = {}) => {
        if (where?.rawSignalId) {
          return store.normalizedSignals.find((n) => n.rawSignalId === where.rawSignalId) || null;
        }
        return store.normalizedSignals[0] || null;
      },
      findUnique: async ({ where, include }: any = {}) => {
        const item = store.normalizedSignals.find((n) => n.id === where?.id);
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
      findMany: async ({ where, take }: any = {}) => {
        let list = store.normalizedSignals.filter((n) => {
          if (where?.evidenceLinks?.none && n.evidenceLinks?.length > 0) return false;
          return true;
        });
        if (take) list = list.slice(0, take);
        return list;
      },
      create: async ({ data }: any) => {
        const item = { id: "norm-" + (store.normalizedSignals.length + 1), ...data };
        store.normalizedSignals.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.normalizedSignals.find((s) => s.id === where?.id);
        if (item) Object.assign(item, data);
        return item;
      },
      count: async () => store.normalizedSignals.length,
    },
    opportunity: {
      findUnique: async ({ where }: any) => {
        if (where?.slug) return store.opportunities.find((o) => o.slug === where.slug) || null;
        if (where?.id) return store.opportunities.find((o) => o.id === where.id) || null;
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const found = store.opportunities.find((o) => o.slug === where?.slug || o.id === where?.id);
        if (!found) throw new Error("Opp not found");
        return found;
      },
      findFirst: async ({ where }: any = {}) => {
        return store.opportunities.find((o) => {
          if (where?.slug && o.slug !== where.slug) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where, take, include }: any = {}) => {
        let list = [...store.opportunities];
        if (where?.isDemoFixture !== undefined) {
          list = list.filter((o) => o.isDemoFixture === where.isDemoFixture);
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
        const item = { id: "opp-" + (store.opportunities.length + 1), ...data };
        store.opportunities.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.opportunities.find((o) => o.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      count: async () => store.opportunities.length,
    },
    opportunityRevision: {
      findFirst: async ({ where }: any = {}) => {
        const revs = store.revisions.filter((r) => r.opportunityId === where.opportunityId);
        return revs[revs.length - 1] || null;
      },
      create: async ({ data }: any) => {
        const item = { id: "rev-" + (store.revisions.length + 1), ...data };
        store.revisions.push(item);
        return item;
      },
      count: async () => store.revisions.length,
    },
    evidenceLink: {
      findFirst: async ({ where }: any = {}) => {
        return store.evidenceLinks.find((el) => {
          if (where.opportunityId && el.opportunityId !== where.opportunityId) return false;
          if (where.normalizedSignalId && el.normalizedSignalId !== where.normalizedSignalId) return false;
          return true;
        }) || null;
      },
      create: async ({ data }: any) => {
        const item = { id: "ev-" + (store.evidenceLinks.length + 1), ...data };
        store.evidenceLinks.push(item);
        return item;
      },
    },
    scorecard: {
      findFirst: async ({ where }: any = {}) => {
        return store.scorecards.find((s) => s.opportunityId === where.opportunityId) || null;
      },
      create: async ({ data }: any) => {
        const item = { id: "sc-" + (store.scorecards.length + 1), ...data };
        store.scorecards.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.scorecards.find((s) => s.id === where.id || s.opportunityId === where.opportunityId);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    opportunityBlueprint: {
      create: async ({ data }: any) => {
        const item = { id: "bp-" + (store.blueprints.length + 1), ...data };
        store.blueprints.push(item);
        return item;
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
    validationBlueprint: {
      create: async ({ data }: any) => {
        const item = { id: "bp-" + (store.blueprints.length + 1), ...data };
        store.blueprints.push(item);
        return item;
      },
    },
    aiSpendRecord: {
      create: async () => ({ id: "spend-1" }),
      aggregate: async () => ({ _sum: { costCents: 0 } }),
    },
  };

  return prisma;
}

const mockAi = new MockDeterministicProvider();

describe("Discovery Collector Progress and Loop Prevention Suite", () => {
  let prisma: any;
  let fetchSpy: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("advances pagination cursor when a query page returns only duplicates", async () => {
    // Page 1 returns already-persisted items. Proactive page 2 returns new item.
    let pageRequested = 1;
    fetchSpy.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("algolia")) {
        const match = urlStr.match(/page=(\d+)/);
        if (match) pageRequested = parseInt(match[1], 10);

        if (pageRequested === 0) {
          // Algolia is 0-indexed; page 1 corresponds to page=0
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "dup-post-1",
                  title: "Existing kubernetes memory leak",
                  story_text: "Old discussion already in database from last week.",
                  author: "dev-old",
                  created_at: "2026-10-10T00:00:00.000Z",
                },
              ],
            }),
          } as any;
        } else {
          // Page 2 (page=1 in Algolia) returns brand new signal
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "fresh-post-2",
                  title: "Fresh OOMKill incident with cgroups v2",
                  story_text: "Brand new cgroup v2 memory leak causes pods to be terminated without notice.",
                  author: "dev-fresh",
                  created_at: "2026-10-18T12:00:00.000Z",
                },
              ],
            }),
          } as any;
        }
      }
      return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
    });

    // Seed duplicate item into prisma raw signals
    await prisma.rawSignal.create({
      data: {
        sourceId: "src-hn",
        sourceRunId: "prev-run",
        externalId: "dup-post-1",
        sourceUrl: "https://news.ycombinator.com/item?id=dup-post-1",
        contentHash: "hash-dup-post-1", // computeContentHash will match if sanitizedExcerpt matches
        rawContent: "Old discussion already in database from last week.",
        publishedAt: new Date("2026-10-10T00:00:00.000Z"),
      },
    });

    const run = await executeManualStagingIngestion(prisma, {
      idempotencyKey: "test-pagination-advance-01",
      aiProvider: mockAi,
      maxFetchItems: 5,
      targetSourceKeys: ["hackernews"],
      targetQueries: ["kubernetes oomkilled"],
    });

    if (run.status !== "COMPLETED") {
      throw new Error(`Run failed with code: ${run.failureCode}, error: ${run.errorMessage}`);
    }
    expect(run.status).toBe("COMPLETED");
    const hnStats = run.summary?.perSourceStats?.["hackernews"];
    expect(hnStats).toBeDefined();

    // Check that source progress state was persisted in storageRestrictions
    const hnSource = prisma._store.sources.find((s: any) => s.key === "hackernews");
    const progress = parseSourceProgressState(hnSource.storageRestrictions);
    expect(progress.queryProgress["kubernetes oomkilled"]).toBeDefined();
    expect(progress.queryProgress["kubernetes oomkilled"].totalPersisted).toBeGreaterThanOrEqual(1);
  });

  it("ensures duplicate-only pages do not prevent other queries or sources from being processed", async () => {
    // Query 1 returns only duplicate records. Query 2 returns fresh records.
    fetchSpy.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("algolia")) {
        if (urlStr.includes("datadog")) {
          // All hits are already in DB
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "datadog-dup-1",
                  title: "Datadog cost spiking again",
                  story_text: "Duplicate text already processed in previous pipeline runs.",
                  author: "user1",
                  created_at: "2026-10-10T00:00:00.000Z",
                },
              ],
            }),
          } as any;
        } else if (urlStr.includes("kubernetes")) {
          // Fresh hits
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "kubernetes-fresh-1",
                  title: "Kubernetes pod OOMKilled under sudden memory pressure",
                  story_text: "Our Kubernetes cluster pods crash constantly because memory limits trigger OOMKilled before autoscaler reacts.",
                  author: "user2",
                  created_at: "2026-10-18T10:00:00.000Z",
                },
              ],
            }),
          } as any;
        }
      }
      return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
    });

    // Seed datadog duplicate
    await prisma.rawSignal.create({
      data: {
        sourceId: "src-hn",
        sourceRunId: "prev-run",
        externalId: "datadog-dup-1",
        sourceUrl: "https://news.ycombinator.com/item?id=datadog-dup-1",
        contentHash: "hash-datadog-dup-1",
        rawContent: "Duplicate text already processed in previous pipeline runs.",
        publishedAt: new Date("2026-10-10T00:00:00.000Z"),
      },
    });

    const run = await executeManualStagingIngestion(prisma, {
      idempotencyKey: "test-duplicate-isolation-02",
      aiProvider: mockAi,
      maxFetchItems: 10,
      targetSourceKeys: ["hackernews"],
      targetQueries: ["datadog expensive", "kubernetes oomkilled"],
    });

    expect(run.status).toBe("COMPLETED");
    const hnStats = run.summary?.perSourceStats?.["hackernews"];
    expect(hnStats).toBeDefined();

    // Verify both queries were executed
    const executed = hnStats.executedQueries || [];
    const datadogExec = executed.find((e: any) => e.query?.includes("datadog"));
    const k8sExec = executed.find((e: any) => e.query?.includes("kubernetes"));

    expect(datadogExec).toBeDefined();
    expect(k8sExec).toBeDefined();
    // Kubernetes query persisted fresh records despite datadog query being duplicates only
    expect(k8sExec.newlyPersisted).toBeGreaterThanOrEqual(1);
    expect(hnStats.newRawSignals).toBeGreaterThanOrEqual(1);
  });

  it("rotates through bounded queries across consecutive runs via lastQueryIndex", async () => {
    fetchSpy.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ hits: [], items: [] }),
    }));

    const queries = [
      "datadog expensive",
      "kubernetes oomkilled",
      "opentelemetry high cardinality",
      "prometheus memory leak",
      "prompt regression",
      "evaluating prompts",
    ];

    // Pick 1: starting from -1
    const run1 = pickQueriesForSourceWithRotation("hackernews", queries, -1, 3);
    expect(run1.selectedQueries).toHaveLength(3);
    expect(run1.selectedQueries[0]).toBe("datadog expensive");
    expect(run1.selectedQueries[1]).toBe("kubernetes oomkilled");
    expect(run1.selectedQueries[2]).toBe("opentelemetry high cardinality");
    expect(run1.nextQueryIndex).toBe(2);

    // Pick 2: starting after run1's nextQueryIndex (2)
    const run2 = pickQueriesForSourceWithRotation("hackernews", queries, run1.nextQueryIndex, 3);
    expect(run2.selectedQueries).toHaveLength(3);
    expect(run2.selectedQueries[0]).toBe("prometheus memory leak");
    expect(run2.selectedQueries[1]).toBe("prompt regression");
    expect(run2.selectedQueries[2]).toBe("evaluating prompts");
    expect(run2.nextQueryIndex).toBe(5);

    // Pick 3: wraps around to index 0
    const run3 = pickQueriesForSourceWithRotation("hackernews", queries, run2.nextQueryIndex, 3);
    expect(run3.selectedQueries).toHaveLength(3);
    expect(run3.selectedQueries[0]).toBe("datadog expensive");
    expect(run3.nextQueryIndex).toBe(2);
  });

  it("keeps historical corroboration searches strictly separate from fresh discovery without affecting discovery checkpoints", async () => {
    let capturedDiscoveryUrls: string[] = [];
    let capturedCorroborationUrls: string[] = [];

    fetchSpy.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("algolia")) {
        capturedDiscoveryUrls.push(urlStr);
        return {
          ok: true,
          json: async () => ({
            hits: [
              {
                objectID: "fresh-hn-1",
                title: "Kubernetes pod OOMKilled cgroup issue",
                story_text: "High memory surge causes container termination before metrics flush.",
                author: "hn-dev-1",
                created_at: "2026-10-18T10:00:00.000Z",
              },
            ],
          }),
        } as any;
      }

      if (urlStr.includes("api.github.com")) {
        capturedCorroborationUrls.push(urlStr);
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 998811,
                title: "Kubernetes node memory pressure causes pod eviction",
                body: "Independent report confirming container killed by OOM killer on cgroup v2.",
                html_url: "https://github.com/kubernetes/kubernetes/issues/998811",
                user: { login: "github-dev-2" },
                created_at: "2026-09-01T00:00:00.000Z",
              },
            ],
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
    });

    const initialCheckpoint = "1728000000";
    const ghSource = prisma._store.sources.find((s: any) => s.key === "github");
    ghSource.storageRestrictions = JSON.stringify({
      lastQueryIndex: -1,
      queryProgress: {
        "kubernetes oomkilled": {
          page: 1,
          lastCheckpoint: "2026-10-15T00:00:00.000Z",
          totalPersisted: 0,
        },
      },
    });

    const run = await executeManualStagingIngestion(prisma, {
      idempotencyKey: "test-historical-separation-04",
      aiProvider: mockAi,
      maxFetchItems: 5,
      targetSourceKeys: ["hackernews"], // GitHub will only run as historical corroboration
      targetQueries: ["kubernetes oomkilled"],
    });

    expect(run.status).toBe("COMPLETED");

    // Fresh discovery on HN should have persisted the signal
    const hnStats = run.summary?.perSourceStats?.["hackernews"];
    expect(hnStats).toBeDefined();
    expect(hnStats.newRawSignals).toBe(1);

    // The GitHub discovery checkpoint must NOT be modified by corroboration searches
    const updatedGhSource = prisma._store.sources.find((s: any) => s.key === "github");
    const ghProgress = parseSourceProgressState(updatedGhSource.storageRestrictions);
    expect(ghProgress.queryProgress["kubernetes oomkilled"].lastCheckpoint).toBe("2026-10-15T00:00:00.000Z");
  });

  it("advances checkpoints only after successful persistence and preserves checkpoint on zero yields", async () => {
    fetchSpy.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("algolia")) {
        // Return 0 hits
        return {
          ok: true,
          json: async () => ({ hits: [] }),
        } as any;
      }
      return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
    });

    const initialCheckpoint = "1728000000";
    const hnSource = prisma._store.sources.find((s: any) => s.key === "hackernews");
    hnSource.storageRestrictions = JSON.stringify({
      lastQueryIndex: 0,
      queryProgress: {
        "kubernetes oomkilled": {
          page: 1,
          lastCheckpoint: initialCheckpoint,
          totalPersisted: 0,
        },
      },
    });

    const run = await executeManualStagingIngestion(prisma, {
      idempotencyKey: "test-checkpoint-preservation-03",
      aiProvider: mockAi,
      maxFetchItems: 5,
      targetSourceKeys: ["hackernews"],
      targetQueries: ["kubernetes oomkilled"],
    });

    expect(run.status).toBe("COMPLETED");
    const updatedHnSource = prisma._store.sources.find((s: any) => s.key === "hackernews");
    const progress = parseSourceProgressState(updatedHnSource.storageRestrictions);

    // The checkpoint must NOT advance when no records are persisted
    expect(progress.queryProgress["kubernetes oomkilled"].lastCheckpoint).toBe(initialCheckpoint);
    expect(progress.queryProgress["kubernetes oomkilled"].totalPersisted).toBe(0);
  });
});
