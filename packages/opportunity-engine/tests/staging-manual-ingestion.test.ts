import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockDeterministicProvider } from "@buildworth/ai";
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
      findFirst: async ({ where }: any) => {
        return store.normalizedSignals.find((n) => {
          if (where.rawSignalId && n.rawSignalId !== where.rawSignalId) return false;
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

  return prisma;
}

describe("Staging Manual Ingestion Unit & Hardening Suite", () => {
  let prisma: any;
  let fetchSpy: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
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
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  const mockAi = new MockDeterministicProvider();

  describe("Durable Claim, Lease Recovery & Concurrency Semantics", () => {
    it("atomically claims a new run and transitions status to COMPLETED upon successful ingestion", async () => {
      const key = "run-test-success-001";
      const result = await executeManualStagingIngestion(prisma, {
        idempotencyKey: key,
        aiProvider: mockAi,
      });

      if (result.status !== "COMPLETED") {
        throw new Error(`Run failed with code: ${result.failureCode}, error: ${result.errorMessage}`);
      }
      expect(result.status).toBe("COMPLETED");
      expect(result.idempotencyKey).toBe(key);
      expect(result.counters.fetched).toBeGreaterThan(0);
      expect(result.counters.candidates).toBeGreaterThan(0);
    });

    it("returns existing completed run when called with duplicate Idempotency-Key", async () => {
      const key = "run-test-idempotent-002";
      const run1 = await executeManualStagingIngestion(prisma, { idempotencyKey: key, aiProvider: mockAi });
      expect(run1.status).toBe("COMPLETED");

      const run2 = await executeManualStagingIngestion(prisma, { idempotencyKey: key, aiProvider: mockAi });
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
      const result2 = await executeManualStagingIngestion(prisma, { idempotencyKey: key2, aiProvider: mockAi });
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

      const result = await executeManualStagingIngestion(prisma, { idempotencyKey: key, aiProvider: mockAi });
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
        aiProvider: mockAi,
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
        aiProvider: mockAi,
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
        aiProvider: mockAi,
      });
      const initialRawCount = prisma._store.rawSignals.length;

      const run2 = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-dedup-009",
        aiProvider: mockAi,
      });

      expect(run2.counters.deduplicated).toBeGreaterThan(0);
      expect(prisma._store.rawSignals.length).toBe(initialRawCount);
    });

    it("stores only short excerpts and never stores full articles (> 280 chars)", async () => {
      await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-copyright-010",
        aiProvider: mockAi,
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

  describe("Candidate Stability, Evidence Expansion & Unrelated Signals Isolation", () => {
    it("preserves candidate identity, original problem, and old evidence while appending matching new evidence", async () => {
      // 1. Initial run creates candidate
      const run1 = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-cand-stable-001",
        aiProvider: mockAi,
      });
      expect(run1.status).toBe("COMPLETED");
      const cand1 = prisma._store.opportunities[0];
      expect(cand1).toBeDefined();
      const originalId = cand1.id;
      const originalTitle = cand1.title;
      const originalProblem = cand1.problemStatement;
      const initialLinks = prisma._store.evidenceLinks.filter((el: any) => el.opportunityId === originalId);
      const initialLinkCount = initialLinks.length;
      expect(initialLinkCount).toBeGreaterThan(0);

      // 2. Perform second ingestion pass with matching evidence
      const run2 = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-cand-stable-002",
        aiProvider: mockAi,
      });
      expect(run2.status).toBe("COMPLETED");

      // Verify the candidate's original identity was preserved
      const updatedCand = prisma._store.opportunities.find((o: any) => o.id === originalId);
      expect(updatedCand).toBeDefined();
      expect(updatedCand.title).toBe(originalTitle);
      expect(updatedCand.problemStatement).toBe(originalProblem);

      // Verify original evidence links remain intact
      const updatedLinks = prisma._store.evidenceLinks.filter((el: any) => el.opportunityId === originalId);
      expect(updatedLinks.length).toBeGreaterThanOrEqual(initialLinkCount);
    });

    it("isolates unrelated signals into a separate candidate and preserves the original candidate unchanged", async () => {
      // 1. Create existing candidate for reconciliation drift
      const existingOpp = await prisma.opportunity.create({
        data: {
          id: "opp-existing-devops-001",
          slug: "multi-cloud-reconciliation-drift",
          title: "Multi-Cloud Reconciliation Drift",
          problemStatement: "Manual reconciliation process causing recurring delays in multi-cloud infrastructure.",
          vertical: "DevOps & Compliance",
          industry: "DevOps",
          status: "DRAFT",
          publicationQualityStatus: "REJECTED_INSUFFICIENT_EVIDENCE",
          isDemoFixture: false,
          createdAt: new Date(Date.now() - 100000),
        },
      });

      const initialOppCount = prisma._store.opportunities.length;

      // 2. Mock fetch to return completely unrelated signals (e.g. medical dental billing)
      fetchSpy.mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("algolia")) {
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "999999",
                  title: "Ask HN: Dental clinic insurance claim denial management",
                  story_text: "Dental practices lose revenue due to opaque insurance claim codes.",
                  author: "dentist_dev",
                  created_at: new Date().toISOString(),
                  points: 50,
                  num_comments: 15,
                },
              ],
            }),
          } as any;
        }
        return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
      });

      const customAi: any = {
        name: "custom-mock",
        generateStructured: async (messages: any) => {
          const userMsg = messages.find((m: any) => m.role === "user")?.content || "";
          if (userMsg.includes("Classify this")) {
            return {
              data: { signalType: "PAIN_COMPLAINT", confidenceScore: 85 },
              rawResponse: JSON.stringify({ signalType: "PAIN_COMPLAINT", confidenceScore: 85 }),
            };
          }
          const data = {
            signalType: "PAIN_COMPLAINT",
            sanitizedExcerpt: "Dental practices lose revenue due to opaque insurance claim codes.",
            problemSummary: "Dental clinic insurance claim denial management and revenue leak.",
            actorRole: "Dental Office Manager",
            workflowContext: "Healthcare Billing",
            severityScore: 4,
            frequencyScore: 4,
            intentToPayScore: 3,
            extractedEntities: ["Dental Claims"],
            confidenceScore: 88,
          };
          return { data, rawResponse: JSON.stringify(data) };
        },
        generateEmbedding: async (text: string) => {
          const embedding: number[] = new Array(64).fill(0);
          if (text.toLowerCase().includes("dental") || text.toLowerCase().includes("dentist")) {
            embedding[0] = 1.0;
          } else {
            embedding[32] = 1.0;
          }
          return { embedding, dimensions: 64, costMinorUnits: 0 };
        },
      };

      const run = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-unrelated-003",
        aiProvider: customAi,
      });

      expect(run.status).toBe("COMPLETED");

      // Verify original candidate is preserved exactly
      const originalCandidate = prisma._store.opportunities.find((o: any) => o.id === existingOpp.id);
      expect(originalCandidate).toBeDefined();
      expect(originalCandidate.title).toBe("Multi-Cloud Reconciliation Drift");
      expect(originalCandidate.problemStatement).toBe("Manual reconciliation process causing recurring delays in multi-cloud infrastructure.");

      // Verify a new candidate was created for the unrelated domain
      expect(prisma._store.opportunities.length).toBeGreaterThan(initialOppCount);
      const newCand = prisma._store.opportunities.find((o: any) => o.id !== existingOpp.id);
      expect(newCand).toBeDefined();
    });
  });

  describe("Strict Willingness-To-Pay Intent Semantics", () => {
    it("does not classify passive pricing mentions as WILLINGNESS_TO_PAY without buyer commitment", async () => {
      // Ingestion with passive pricing text
      fetchSpy.mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("algolia")) {
          return {
            ok: true,
            json: async () => ({
              hits: [
                {
                  objectID: "888888",
                  title: "Pricing models for developer tools are confusing",
                  story_text: "Tools like Datadog cost $50/mo and pricing tiers are expensive.",
                  author: "commenter_1",
                  created_at: new Date().toISOString(),
                  points: 30,
                  num_comments: 5,
                },
              ],
            }),
          } as any;
        }
        return { ok: true, json: async () => ({ hits: [], items: [] }) } as any;
      });

      const run = await executeManualStagingIngestion(prisma, {
        idempotencyKey: "run-wtp-strict-004",
        aiProvider: mockAi,
      });

      expect(run.status).toBe("COMPLETED");
      // Verify no evidence link was labeled as WILLINGNESS_TO_PAY for mere passive pricing mentions
      const wtpLinks = prisma._store.evidenceLinks.filter((el: any) => el.claimType === "WILLINGNESS_TO_PAY");
      expect(wtpLinks.length).toBe(0);
    });
  });
});