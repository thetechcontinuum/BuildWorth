import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_FOCUSED_DOMAIN_QUERIES,
  executeManualStagingIngestion,
  evaluateCandidateQualification,
  signalsSupportSameProblem,
  deriveEconomicBuyerRole,
  deriveEndUserRole,
  isConcreteProblemOrWorkaround,
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
      { id: "src-hn", key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "COMMUNITY" },
      { id: "src-gh", key: "github", name: "GitHub", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "DEVELOPER_ECOSYSTEM" },
      { id: "src-so", key: "stackexchange", name: "Stack Overflow", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "COMMUNITY" },
    ] as any[],
    sourceRuns: [] as any[],
  };

  const prisma: any = {
    _store: store,
    $transaction: async (fn: any) => fn(prisma),
    $executeRawUnsafe: async () => 0,
    ingestionRun: {
      findFirst: async ({ where }: any) => {
        return store.ingestionRuns.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
      },
      findUnique: async ({ where }: any) => {
        return store.ingestionRuns.find((r) => r.id === where.id) || null;
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
      findFirst: async ({ where }: any = {}) => {
        if (where?.sourceId) {
          const matching = store.rawSignals.filter((r) => r.sourceId === where.sourceId);
          return matching[matching.length - 1] || null;
        }
        return store.rawSignals[0] || null;
      },
      findUnique: async ({ where }: any) => {
        if (where?.contentHash) return store.rawSignals.find((r) => r.contentHash === where.contentHash) || null;
        return null;
      },
      findMany: async () => store.rawSignals,
      create: async ({ data }: any) => {
        const item = { id: "raw-" + (store.rawSignals.length + 1), ...data, createdAt: new Date() };
        store.rawSignals.push(item);
        return item;
      },
    },
    normalizedSignal: {
      findFirst: async ({ where }: any) => {
        return store.normalizedSignals.find((n) => {
          if (where?.rawSignalId && n.rawSignalId !== where.rawSignalId) return false;
          return true;
        }) || null;
      },
      findUnique: async ({ where }: any) => {
        const item = store.normalizedSignals.find((n) => n.id === where.id);
        if (item) {
          const raw = store.rawSignals.find((r) => r.id === item.rawSignalId);
          const src = raw ? store.sources.find((s) => s.id === raw.sourceId) : null;
          return { ...item, rawSignal: raw ? { ...raw, source: src } : null };
        }
        return null;
      },
      findMany: async () => store.normalizedSignals,
      create: async ({ data }: any) => {
        const item = { id: "norm-" + (store.normalizedSignals.length + 1), ...data, createdAt: new Date() };
        store.normalizedSignals.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.normalizedSignals.find((n) => n.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    opportunity: {
      findUnique: async ({ where }: any) => {
        if (where.id) return store.opportunities.find((o) => o.id === where.id) || null;
        if (where.slug) return store.opportunities.find((o) => o.slug === where.slug) || null;
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        let opp = null;
        if (where.id) opp = store.opportunities.find((o) => o.id === where.id);
        else if (where.slug) opp = store.opportunities.find((o) => o.slug === where.slug);
        if (!opp) throw new Error("Opportunity not found");
        return opp;
      },
      findMany: async () => store.opportunities,
      create: async ({ data }: any) => {
        const item = { id: "opp-" + (store.opportunities.length + 1), ...data, createdAt: new Date() };
        store.opportunities.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = store.opportunities.find((o) => o.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    scorecard: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const item = { id: "sc-" + (store.scorecards.length + 1), ...data };
        store.scorecards.push(item);
        return item;
      },
      update: async () => ({}),
    },
    opportunityRevision: {
      findFirst: async () => null,
      findMany: async () => store.revisions,
      create: async ({ data }: any) => {
        const item = { id: "rev-" + (store.revisions.length + 1), ...data };
        store.revisions.push(item);
        return item;
      },
    },
    opportunityBlueprint: {
      findFirst: async () => null,
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
    evidenceLink: {
      findFirst: async () => null,
      findMany: async () => store.evidenceLinks,
      create: async ({ data }: any) => {
        const item = { id: "evlink-" + (store.evidenceLinks.length + 1), ...data };
        store.evidenceLinks.push(item);
        return item;
      },
    },
  };

  return prisma;
}

describe("Domain Discovery Yield & Parameter Verification", () => {
  it("provides default focused domain queries spanning DevOps and AI Developer Tooling", () => {
    expect(DEFAULT_FOCUSED_DOMAIN_QUERIES).toBeDefined();
    expect(DEFAULT_FOCUSED_DOMAIN_QUERIES.length).toBeGreaterThanOrEqual(6);

    const devopsQueries = DEFAULT_FOCUSED_DOMAIN_QUERIES.filter(
      (q) => q.includes("datadog") || q.includes("terraform") || q.includes("kubernetes"),
    );
    expect(devopsQueries.length).toBeGreaterThanOrEqual(3);

    const aiQueries = DEFAULT_FOCUSED_DOMAIN_QUERIES.filter(
      (q) => q.includes("llm") || q.includes("prompt") || q.includes("vllm"),
    );
    expect(aiQueries.length).toBeGreaterThanOrEqual(3);
  });

  it("recognizes technical domain anchors in signalsSupportSameProblem", () => {
    // DevOps state locking
    expect(
      signalsSupportSameProblem(
        "Terraform State Lock acquisition error in CI pipeline",
        "Error acquiring the state lock: ConditionalCheckFailedException in DynamoDB",
        "Our automated Terraform pipeline halts because state locks are not released cleanly.",
        "We have frequent deployment blocks when DynamoDB state lock fails to release after runner termination.",
      ),
    ).toBe(true);

    // AI prompt evaluation
    expect(
      signalsSupportSameProblem(
        "Automated regression testing for LLM prompt changes",
        "Evaluating LLM prompts across model versions",
        "We spend hours manually validating whether system prompt edits degrade edge case accuracy.",
        "Need a reliable framework to evaluate prompt regressions before shipping changes to production.",
      ),
    ).toBe(true);

    // AI GPU memory breakdown
    expect(
      signalsSupportSameProblem(
        "vLLM server restarts fail with out of memory error",
        "CUDA out-of-memory error during vLLM batching inference",
        "vLLM worker crashes intermittently with OOM when processing concurrent context requests.",
        "GPU memory leak during batch embedding generation causing server to run out of memory.",
      ),
    ).toBe(true);
  });

  it("derives specific buyer and user roles for DevOps and AI Tooling", () => {
    expect(deriveEconomicBuyerRole("DevOps Platform Engineers", "Software Engineering & DevOps")).toBe(
      "VP of Engineering or Head of DevOps",
    );
    expect(deriveEconomicBuyerRole("Applied LLM Developers", "AI Developer Tooling")).toBe(
      "Head of AI or VP of Engineering",
    );

    expect(deriveEndUserRole("DevOps & Platform Engineering")).toBe(
      "Senior DevOps / Release Engineer",
    );
    expect(deriveEndUserRole("AI Prompt & LLM Engineering")).toBe(
      "AI / Prompt Engineer or Applied LLM Developer",
    );
  });

  it("records executed query stats and distinguishes success from no evidence found", async () => {
    const prisma = createMockPrisma();

    // Mock fetch to return results for datadog query, but empty for other queries
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("datadog")) {
        return {
          ok: true,
          json: async () => ({
            hits: [
              {
                objectID: "hn-dd-101",
                story_title: "Ask HN: Is observability broken for you?",
                comment_text: "Our Datadog bill spiked 300% after migrating to microservices with custom tags.",
                author: "sre_lead",
                created_at: new Date().toISOString(),
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

    const mockAi: any = {
      name: "test-ai",
      generateStructured: async (messages: any) => {
        const userMsg = messages.find((m: any) => m.role === "user")?.content || "";
        if (userMsg.includes("Classify this")) {
          return {
            data: { signalType: "PAIN_COMPLAINT", confidenceScore: 88 },
            rawResponse: JSON.stringify({ signalType: "PAIN_COMPLAINT", confidenceScore: 88 }),
          };
        }
        const data = {
          signalType: "PAIN_COMPLAINT",
          sanitizedExcerpt: userMsg.slice(0, 100),
          problemSummary: "Observability cost spike and billing friction with Datadog",
          actorRole: "Site Reliability Engineer",
          workflowContext: "Observability & FinOps",
          severityScore: 4,
          frequencyScore: 4,
          intentToPayScore: 4,
          extractedEntities: ["Datadog", "Microservices"],
          confidenceScore: 85,
        };
        return { data, rawResponse: JSON.stringify(data) };
      },
      generateEmbedding: async () => ({ embedding: new Array(64).fill(0.1), dimensions: 64, costMinorUnits: 0 }),
    };

    const run = await executeManualStagingIngestion(prisma, {
      idempotencyKey: "test-query-stats-yield-01",
      aiProvider: mockAi,
      maxFetchItems: 10,
      targetSourceKeys: ["hackernews"],
      targetQueries: ["datadog expensive alternative", "kubernetes crashloopbackoff oomkilled"],
    });

    expect(run.status).toBe("COMPLETED");

    const hnStats = run.summary?.perSourceStats?.["hackernews"];
    expect(hnStats).toBeDefined();
    expect(hnStats.executedQueries).toBeDefined();
    expect(hnStats.executedQueries.length).toBeGreaterThanOrEqual(1);

    const ddQuery = hnStats.executedQueries.find((eq: any) => eq.query.includes("datadog"));
    expect(ddQuery).toBeDefined();
    expect(ddQuery.status).toBe("SUCCESS");
    expect(ddQuery.itemsFetched).toBe(1);
    expect(ddQuery.durationMs).toBeGreaterThanOrEqual(0);

    fetchSpy.mockRestore();
  });

  it("qualifies fresh practitioner problem candidate as early hypothesis", () => {
    const verifiedSignals = [
      {
        normalizedSignal: {
          id: "ns-1",
          signalType: "PAIN",
          canonicalUrl: "https://news.ycombinator.com/item?id=47085504",
          sourceTitle: "Observability cost runaway and alert fatigue",
          sanitizedExcerpt: "Our Datadog spend reached $40k/month while critical alerts were lost in noise.",
          actorRole: "Site Reliability Engineer",
          severityScore: 4,
          frequencyScore: 4,
          intentToPayScore: 4,
          purchaseIntent: true,
          independenceKey: "auth:sre_lead",
        },
        rawSignal: {
          id: "raw-1",
          sourceUrl: "https://news.ycombinator.com/item?id=47085504",
          authorFingerprint: "sre_lead",
        },
        source: { key: "hackernews", name: "Hacker News", sourceFamily: "COMMUNITY" },
      },
      {
        normalizedSignal: {
          id: "ns-2",
          signalType: "PAIN",
          canonicalUrl: "https://stackoverflow.com/questions/79012345",
          sourceTitle: "Managing metric cardinality spikes in Datadog agent",
          sanitizedExcerpt: "Custom tags caused custom metrics explosion resulting in unexpected overage bill.",
          actorRole: "DevOps Engineer",
          severityScore: 4,
          frequencyScore: 3,
          intentToPayScore: 3,
          purchaseIntent: false,
          independenceKey: "auth:devops_dan",
        },
        rawSignal: {
          id: "raw-2",
          sourceUrl: "https://stackoverflow.com/questions/79012345",
          authorFingerprint: "devops_dan",
        },
        source: { key: "stackexchange", name: "Stack Overflow", sourceFamily: "COMMUNITY" },
      },
    ];

    const qual = evaluateCandidateQualification(
      {
        title: "Observability Cost Runaway and Cardinality Management",
        problemStatement: "Engineering teams face unpredictable SaaS observability bill spikes due to metric cardinality.",
        primaryUrl: "https://news.ycombinator.com/item?id=47085504",
        primarySourceKey: "hackernews",
      },
      verifiedSignals,
      [],
      { status: "HYPOTHESIS", isEligibleForVerified: false, blockers: [], warnings: [], metrics: {} },
      72,
    );

    expect(qual.isEligibleForOpportunity).toBe(true);
    expect(qual.finalStatus).toBe("PUBLISHED");
    expect(qual.pubQualityStatus).toBe("HYPOTHESIS");
    expect(qual.qualificationReason).toContain("Qualified opportunity hypothesis");
  });

  it("recognizes concrete operational friction in DevOps and AI developer tooling signals", () => {
    // 1. Datadog bill spike & manual proxy workaround
    expect(
      isConcreteProblemOrWorkaround({
        title: "Infrastructure decisions I endorse or regret after 4 years at a startup",
        sanitizedExcerpt: "Our Datadog bill spiked 300% after migrating to microservices with custom tags. We spent days building a proxy to drop tags.",
        canonicalUrl: "https://news.ycombinator.com/item?id=47085504",
        sourceKey: "hackernews",
        signalType: "PAIN",
      }),
    ).toBe(true);

    // 2. Kubernetes OOMKilled & CrashLoopBackOff pod eviction
    expect(
      isConcreteProblemOrWorkaround({
        title: "My container works under docker compose but gets OOMKilled the moment I set a memory limit in the Deployment",
        sanitizedExcerpt: "The pod enters CrashLoopBackOff with OOMKilled exit code 137 under memory limit.",
        canonicalUrl: "https://stackoverflow.com/questions/79989436",
        sourceKey: "stackexchange",
        signalType: "PAIN",
      }),
    ).toBe(true);

    // 3. Terraform state lock acquisition failure in CI
    expect(
      isConcreteProblemOrWorkaround({
        title: "Bootstrap Terraform remote state (S3 + locking)",
        sanitizedExcerpt: "Error acquiring the state lock: ConditionalCheckFailedException DynamoDB lock release timeout.",
        canonicalUrl: "https://github.com/JaiG1998/devops-platform/issues/6",
        sourceKey: "github",
        signalType: "PAIN",
      }),
    ).toBe(true);

    // 4. Prompt regression and evaluation framework
    expect(
      isConcreteProblemOrWorkaround({
        title: "Evaluation and Prompt Regression",
        sanitizedExcerpt: "We need an evaluation framework to benchmark prompt regressions before shipping changes to production.",
        canonicalUrl: "https://github.com/SamiranB8888/ai-pm-copilot/issues/68",
        sourceKey: "github",
        signalType: "PAIN",
      }),
    ).toBe(true);
  });
});

