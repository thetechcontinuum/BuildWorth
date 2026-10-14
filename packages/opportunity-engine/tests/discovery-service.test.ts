import { describe, it, expect } from "vitest";
import { getDailyDiscoveryFeed, deriveMarketRegion } from "../src/discovery/discovery-service.js";

describe("Discovery Feed Service & DTO Isolation Suite", () => {
  it("derives proper regional market names from source attributes", () => {
    expect(deriveMarketRegion("krasia", "DISCOVERY")).toBe("Asia / Pan-Asia");
    expect(deriveMarketRegion("e27", "DISCOVERY")).toBe("Asia / Pan-Asia");
    expect(deriveMarketRegion("eustartups", "DISCOVERY")).toBe("Europe");
    expect(deriveMarketRegion("siliconcanals", "DISCOVERY")).toBe("Europe");
    expect(deriveMarketRegion("lobsters", "COMMUNITY")).toBe("Global / Developer Ecosystem");
    expect(deriveMarketRegion("techcrunch", "DISCOVERY")).toBe("North America & Global");
    expect(deriveMarketRegion("github", "DEVELOPER_ECOSYSTEM")).toBe("Global / Developer Ecosystem");
    expect(deriveMarketRegion("hackernews", "COMMUNITY")).toBe("Global / North America & Europe");
    expect(deriveMarketRegion("ted", "DISCOVERY")).toBe("Europe");
    expect(deriveMarketRegion("samgov", "DISCOVERY")).toBe("United States / Federal");
    expect(deriveMarketRegion("stackexchange", "COMMUNITY")).toBe("Global / Developer Ecosystem");
    expect(deriveMarketRegion("cisakev", "DISCOVERY")).toBe("Global / Cybersecurity");
    expect(deriveMarketRegion("arxiv", "DISCOVERY")).toBe("Global / Scientific & DeepTech");
    expect(deriveMarketRegion("unknown", "CUSTOM", "Enterprise")).toBe("Global / Remote");
  });

  it("builds discovery feed strictly filtering out Pro fields and enforcing DTO allowlist", async () => {
    const mockSignalCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const mockSignalPublishedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const mockOppCreatedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const mockCandidate = {
      id: "opp-123",
      slug: "realtime-k8s-pod-finops-terminator",
      title: "Real-time Kubernetes Orphaned Pod Interceptor",
      oneSentenceSummary: "Automatically detects and drains abandoned dev pods before they accumulate AWS charges.",
      problemStatement: "Engineers spin up preview clusters and forget to shut them down, leading to $5k+/mo idle costs.",
      industry: "DevOps & Compliance",
      economicBuyer: "VP of Infrastructure",
      endUser: "DevOps Engineer",
      proposedProduct: "Lightweight mutating webhook for dev pod TTL auto-enforcement",
      existingWorkflow: "Manual weekly cloud cost spreadsheet audits",
      status: "DRAFT",
      publicationQualityStatus: "HYPOTHESIS",
      isDemoFixture: false,
      createdAt: mockOppCreatedAt,
      // Pro blueprint fields that MUST NOT leak:
      financialEconomics: { arr: 1000000, ltv: 50000 },
      first20Plan: { step1: "Cold email 20 infra heads" },
      validationRoadmap: { experiments: ["preorder test"] },
      scorecards: [{ opportunityScore: 78, evidenceConfidenceScore: 65 }],
      evidenceLinks: [
        {
          id: "link-1",
          normalizedSignal: {
            id: "sig-norm-1",
            sourceTitle: "Abandoned pods costing us thousands on EKS",
            sanitizedExcerpt: "We found 40 forgotten namespace pods idling over the weekend causing massive bill spikes.",
            problemSummary: "Orphaned dev pods waste infrastructure budget.",
            canonicalUrl: "https://news.ycombinator.com/item?id=39120931",
            publishedAt: mockSignalPublishedAt,
            rawSignal: {
              id: "raw-1",
              title: "Abandoned pods costing us thousands on EKS",
              sourceUrl: "https://news.ycombinator.com/item?id=39120931",
              createdAt: mockSignalCreatedAt,
              publishedAt: mockSignalPublishedAt,
              source: {
                key: "hackernews",
                name: "Hacker News",
                sourceFamily: "COMMUNITY",
              },
            },
          },
        },
      ],
    };

    const mockPrisma = {
      opportunity: {
        findMany: async () => [mockCandidate],
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });

    expect(feed.success).toBe(true);
    expect(feed.totalCount).toBe(1);
    expect(feed.items).toHaveLength(1);

    const item = feed.items[0];

    // Allowed public fields
    expect(item.id).toBe("opp-123");
    expect(item.slug).toBe("realtime-k8s-pod-finops-terminator");
    expect(item.title).toBe("Real-time Kubernetes Orphaned Pod Interceptor");
    expect(item.summary).toBe("Automatically detects and drains abandoned dev pods before they accumulate AWS charges.");
    expect(item.verificationLabel).toBe("Early idea / Not yet verified");
    expect(item.status).toBe("HYPOTHESIS");
    expect(item.market).toBe("Global / North America & Europe");
    expect(item.canonicalUrl).toBe("https://news.ycombinator.com/item?id=39120931");
    expect(item.sourceFamily).toBe("COMMUNITY");

    // Source publication date vs feed discovery date separation
    expect(item.publicationDate).toBe(mockSignalPublishedAt.toISOString());
    expect(item.discoveredAt).toBe(mockOppCreatedAt.toISOString());

    // Separated observed facts vs AI hypothesis
    expect(item.observedFacts).toContain("We found 40 forgotten namespace pods idling over the weekend causing massive bill spikes.");
    expect(item.businessHypothesis.targetAudience).toBe("VP of Infrastructure");
    expect(item.businessHypothesis.proposedSolution).toBe("Lightweight mutating webhook for dev pod TTL auto-enforcement");
    expect(item.businessHypothesis.confidenceNote).toContain("Not yet validated");

    // Strict leak prevention: Ensure no pro fields or internal blueprint blobs exist on item
    expect((item as any).financialEconomics).toBeUndefined();
    expect((item as any).first20Plan).toBeUndefined();
    expect((item as any).validationRoadmap).toBeUndefined();
    expect((item as any).lockedSections).toBeUndefined();
    expect((item as any).internalCandidateId).toBeUndefined();
  });

  it("deduplicates repeat canonical URLs and identical titles", async () => {
    const oppA = {
      id: "opp-1",
      slug: "idea-a",
      title: "Shared Article Problem",
      oneSentenceSummary: "Summary A",
      problemStatement: "Problem A",
      status: "DRAFT",
      publicationQualityStatus: "HYPOTHESIS",
      createdAt: new Date(),
      evidenceLinks: [
        {
          normalizedSignal: {
            id: "sig-1",
            canonicalUrl: "https://news.ycombinator.com/item?id=888888",
            sanitizedExcerpt: "Severe problem and breakdown costing $500 Excerpt 1",
            rawSignal: {
              sourceUrl: "https://news.ycombinator.com/item?id=888888",
              source: { key: "hackernews", name: "Hacker News" },
            },
          },
        },
      ],
    };

    const oppB = {
      id: "opp-2",
      slug: "idea-b",
      title: "Shared Article Problem Duplicate",
      oneSentenceSummary: "Summary B",
      problemStatement: "Problem B",
      status: "DRAFT",
      publicationQualityStatus: "HYPOTHESIS",
      createdAt: new Date(),
      evidenceLinks: [
        {
          normalizedSignal: {
            id: "sig-2",
            canonicalUrl: "https://news.ycombinator.com/item?id=888888", // Same canonical URL!
            sanitizedExcerpt: "Severe problem and breakdown costing $500 Excerpt 2",
            rawSignal: {
              sourceUrl: "https://news.ycombinator.com/item?id=888888",
              source: { key: "hackernews", name: "Hacker News" },
            },
          },
        },
      ],
    };

    const mockPrisma = {
      opportunity: {
        findMany: async () => [oppA, oppB],
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
    expect(feed.success).toBe(true);
    expect(feed.totalCount).toBe(1);
    expect(feed.items[0].slug).toBe("idea-a");
  });

  it("enforces primary-source limits so no single source dominates the feed", async () => {
    const makeMockOpp = (id: string, slug: string, title: string, sourceKey: string, url: string) => ({
      id,
      slug,
      title,
      oneSentenceSummary: `Summary for ${title}`,
      problemStatement: `Problem for ${title}`,
      status: "DRAFT",
      publicationQualityStatus: "HYPOTHESIS",
      createdAt: new Date(),
      evidenceLinks: [
        {
          normalizedSignal: {
            id: `sig-${id}`,
            canonicalUrl: url,
            sanitizedExcerpt: `Excerpt for ${title}`,
            rawSignal: {
              sourceUrl: url,
              source: { key: sourceKey, name: sourceKey.toUpperCase(), sourceFamily: "COMMUNITY" },
            },
          },
        },
      ],
    });

    const candidates = [
      makeMockOpp("1", "opp-hn-1", "HN Problem 1", "hackernews", "https://news.ycombinator.com/item?id=1"),
      makeMockOpp("2", "opp-hn-2", "HN Problem 2", "hackernews", "https://news.ycombinator.com/item?id=2"),
      makeMockOpp("3", "opp-hn-3", "HN Problem 3", "hackernews", "https://news.ycombinator.com/item?id=3"),
      makeMockOpp("4", "opp-sc-1", "European Problem 1", "siliconcanals", "https://siliconcanals.com/post-1"),
      makeMockOpp("5", "opp-lob-1", "Dev Problem 1", "lobsters", "https://lobste.rs/s/post-1"),
    ];

    const mockPrisma = {
      opportunity: {
        findMany: async () => candidates,
      },
    };

    // With maxItemsPerSource = 2 and limit = 5, the 3rd HN post should be skipped, allowing SC and Lobsters to appear
    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5, maxItemsPerSource: 2 });
    expect(feed.success).toBe(true);
    expect(feed.totalCount).toBe(4); // 2 from HN, 1 from SC, 1 from Lobsters

    const hnItems = feed.items.filter((i) => i.canonicalUrl.includes("ycombinator"));
    const scItems = feed.items.filter((i) => i.canonicalUrl.includes("siliconcanals"));
    const lobItems = feed.items.filter((i) => i.canonicalUrl.includes("lobste.rs"));

    expect(hnItems.length).toBe(2);
    expect(scItems.length).toBe(1);
    expect(lobItems.length).toBe(1);
  });

  it("handles empty day state without inventing mock posts or fabricating dates", async () => {
    const mockPrisma = {
      opportunity: {
        findMany: async () => [],
      },
      rawSignal: {
        findMany: async () => [],
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
    expect(feed.success).toBe(true);
    expect(feed.totalCount).toBe(0);
    expect(feed.items).toHaveLength(0);
    expect(feed.marketSignals).toHaveLength(0);
    expect(feed.opportunityHypotheses).toHaveLength(0);
    expect(feed.hasItemsToday).toBe(false);
  });

  it("populates authentic MarketSignalFeedItemDTO items separately with required labels and fields", async () => {
    const mockPublishedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const mockCreatedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const mockRawSignals = [
      {
        id: "raw-hn-1",
        title: "Ask HN: Why is managing cloud ingress certificates still brittle?",
        rawContent: "We run into frequent edge certificate expiries and renewals breaking staging environments.",
        sourceUrl: "https://news.ycombinator.com/item?id=9928192",
        publishedAt: mockPublishedAt,
        createdAt: mockCreatedAt,
        source: {
          key: "hackernews",
          name: "Hacker News",
          sourceFamily: "COMMUNITY",
          isEnabled: true,
          policyStatus: "ALLOWED",
        },
        normalizedSignal: {
          id: "norm-1",
          canonicalUrl: "https://news.ycombinator.com/item?id=9928192",
          sourceTitle: "Ask HN: Why is managing cloud ingress certificates still brittle?",
          sanitizedExcerpt: "We run into frequent edge certificate expiries and renewals breaking staging environments.",
        },
      },
      {
        id: "raw-sc-1",
        title: "Amsterdam AI compliance startup secures €3M seed",
        rawContent: "New regulatory reporting obligations in the EU create pressing requirements for automated data tracing.",
        sourceUrl: "https://siliconcanals.com/news/amsterdam-compliance-seed/",
        publishedAt: mockPublishedAt,
        createdAt: mockCreatedAt,
        source: {
          key: "siliconcanals",
          name: "Silicon Canals",
          sourceFamily: "DISCOVERY",
          isEnabled: true,
          policyStatus: "ALLOWED",
        },
        normalizedSignal: {
          id: "norm-2",
          canonicalUrl: "https://siliconcanals.com/news/amsterdam-compliance-seed/",
          sourceTitle: "Amsterdam AI compliance startup secures €3M seed",
          sanitizedExcerpt: "New regulatory reporting obligations in the EU create pressing requirements for automated data tracing.",
        },
      },
    ];

    const mockPrisma = {
      opportunity: {
        findMany: async () => [],
      },
      rawSignal: {
        findMany: async () => mockRawSignals,
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { signalsLimit: 5 });
    expect(feed.success).toBe(true);
    expect(feed.marketSignals).toHaveLength(2);
    expect(feed.opportunityHypotheses).toHaveLength(0);

    const sig1 = feed.marketSignals[0];
    expect(sig1.id).toBe("raw-hn-1");
    expect(sig1.sourceKey).toBe("hackernews");
    expect(sig1.sourceName).toBe("Hacker News");
    expect(sig1.sourceFamily).toBe("COMMUNITY");
    expect(sig1.title).toBe("Ask HN: Why is managing cloud ingress certificates still brittle?");
    expect(sig1.label).toBe("Market signal — not a validated business opportunity");
    expect(sig1.market).toBe("Global / North America & Europe");
    expect(sig1.canonicalUrl).toBe("https://news.ycombinator.com/item?id=9928192");
    expect(sig1.publishedAt).toBe(mockPublishedAt.toISOString());
    expect(sig1.discoveredAt).toBe(mockCreatedAt.toISOString());

    // Never invents product ideas, buyer demand, or willingness to pay on market signals
    expect((sig1 as any).proposedSolution).toBeUndefined();
    expect((sig1 as any).buyerDemand).toBeUndefined();
    expect((sig1 as any).willingnessToPay).toBeUndefined();
  });

  it("strictly excludes INITIAL_OPPORTUNITIES fixture slugs from discovery feed", async () => {
    const fixtureSlugs = [
      "automated-soc2-evidence-collector",
      "llm-prompt-regression-ci-interceptor",
      "snowflake-runaway-query-circuit-breaker",
      "postgres-pool-exhaustion-watchdog-nextjs",
    ];

    // Mock Prisma returning a demo fixture opportunity alongside an authentic one
    const mockPrisma = {
      opportunity: {
        findMany: async (args: any) => {
          // If query checks isDemoFixture: false, demo fixtures are already filtered
          const allOpps = [
            {
              id: "opp-fixture-1",
              slug: "llm-prompt-regression-ci-interceptor",
              title: "LLM Prompt Regression & Token Cost Interceptor for CI/CD",
              oneSentenceSummary: "Automated test harness in GitHub Actions",
              status: "DRAFT",
              publicationQualityStatus: "HYPOTHESIS",
              isDemoFixture: true,
              createdAt: new Date(),
            },
            {
              id: "opp-genuine-1",
              slug: "genuine-cross-cloud-latency-guard",
              title: "Genuine Cross Cloud Latency Guard",
              oneSentenceSummary: "Monitors and routes inter-region traffic automatically",
              status: "DRAFT",
              publicationQualityStatus: "HYPOTHESIS",
              isDemoFixture: false,
              createdAt: new Date(),
              evidenceLinks: [
                {
                  id: "el-1",
                  normalizedSignal: {
                    id: "ns-1",
                    sourceTitle: "Inter-region latency friction",
                    sanitizedExcerpt: "Experiencing 200ms latency spikes between eu-central and us-east",
                    canonicalUrl: "https://news.ycombinator.com/item?id=8831920",
                    publishedAt: new Date(),
                    rawSignal: {
                      id: "rs-1",
                      sourceUrl: "https://news.ycombinator.com/item?id=8831920",
                      source: { key: "hackernews", name: "Hacker News", sourceFamily: "COMMUNITY" },
                    },
                  },
                },
              ],
            },
          ];

          return allOpps.filter((o) => {
            if (args?.where?.isDemoFixture === false && o.isDemoFixture) return false;
            return true;
          });
        },
      },
      rawSignal: {
        findMany: async () => [],
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 10 });
    expect(feed.success).toBe(true);
    expect(feed.opportunityHypotheses).toHaveLength(1);
    expect(feed.opportunityHypotheses[0].slug).toBe("genuine-cross-cloud-latency-guard");

    // Ensure none of the 4 INITIAL_OPPORTUNITIES fixtures appear
    for (const slug of fixtureSlugs) {
      expect(feed.opportunityHypotheses.some((h) => h.slug === slug)).toBe(false);
      expect(feed.items.some((h) => h.slug === slug)).toBe(false);
    }
  });

  it("enforces multi-source diversity in marketSignals without allowing single source starvation", async () => {
    const mockRawSignals: any[] = [];
    for (let i = 1; i <= 5; i++) {
      mockRawSignals.push({
        id: `raw-gh-${i}`,
        sourceUrl: `https://github.com/org/repo/issues/${i}`,
        title: `GitHub Issue ${i}`,
        rawContent: `GitHub issue content ${i} description details`,
        publishedAt: new Date(),
        createdAt: new Date(),
        source: { key: "github", name: "GitHub Issues", sourceFamily: "DEVELOPER_ECOSYSTEM", isEnabled: true, policyStatus: "ALLOWED" },
      });
    }
    mockRawSignals.push({
      id: "raw-arxiv-1",
      sourceUrl: "https://arxiv.org/abs/2610.0101",
      title: "arXiv AI Agent Benchmark",
      rawContent: "arXiv paper details on agent evaluation",
      publishedAt: new Date(),
      createdAt: new Date(),
      source: { key: "arxiv", name: "arXiv Preprints", sourceFamily: "DISCOVERY", isEnabled: true, policyStatus: "ALLOWED" },
    });
    mockRawSignals.push({
      id: "raw-cisa-1",
      sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-9999",
      title: "CVE-2026-9999: Zero Day Remote Execution",
      rawContent: "CISA vulnerability details",
      publishedAt: new Date(),
      createdAt: new Date(),
      source: { key: "cisakev", name: "CISA KEV", sourceFamily: "DISCOVERY", isEnabled: true, policyStatus: "ALLOWED" },
    });
    mockRawSignals.push({
      id: "raw-ted-1",
      sourceUrl: "https://ted.europa.eu/en/notice/-/detail/777777-2026",
      title: "EU Cloud Infrastructure Tender Notice",
      rawContent: "European public procurement notice",
      publishedAt: new Date(),
      createdAt: new Date(),
      source: { key: "ted", name: "TED Europa", sourceFamily: "DISCOVERY", isEnabled: true, policyStatus: "ALLOWED" },
    });

    const mockPrisma = {
      opportunity: { findMany: async () => [] },
      rawSignal: { findMany: async () => mockRawSignals },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { signalsLimit: 10 });
    expect(feed.success).toBe(true);

    const githubItems = feed.marketSignals.filter((s) => s.sourceKey === "github");
    const arxivItems = feed.marketSignals.filter((s) => s.sourceKey === "arxiv");
    const cisaItems = feed.marketSignals.filter((s) => s.sourceKey === "cisakev");
    const tedItems = feed.marketSignals.filter((s) => s.sourceKey === "ted");

    expect(arxivItems).toHaveLength(1);
    expect(cisaItems).toHaveLength(1);
    expect(tedItems).toHaveLength(1);
    expect(githubItems.length).toBeGreaterThanOrEqual(2);
  });

  it("generates three distinct levels and computes daily personalized brief with theme metrics", async () => {
    const now = new Date();
    const mockNormalizedSignals = [
      {
        id: "norm-lead-1",
        signalType: "PAIN",
        sourceTitle: "Kafka consumer rebalance latency spikes under high partition churn",
        sanitizedExcerpt: "Our streaming data consumers experience massive 45-second latency spikes when partitions rebalance, causing downstream data loss.",
        problemSummary: "Streaming consumers suffer latency spikes and buffer overflow during partition rebalance.",
        actorRole: "Streaming Platform Engineer",
        canonicalUrl: "https://lobste.rs/s/kafka99",
        rawSignal: {
          id: "raw-lead-1",
          sourceUrl: "https://lobste.rs/s/kafka99",
          title: "Kafka consumer rebalance latency spikes under high partition churn",
          publishedAt: now,
          createdAt: now,
          source: { key: "lobsters", name: "Lobsters", sourceFamily: "COMMUNITY", isEnabled: true, policyStatus: "ALLOWED" },
        },
      },
    ];

    const mockRawSignals = [
      {
        id: "raw-sig-1",
        sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-1111",
        title: "CVE-2026-1111: Critical Auth Bypass",
        rawContent: "Exploited vulnerability in enterprise gateway.",
        publishedAt: now,
        createdAt: now,
        source: { key: "cisakev", name: "CISA KEV", sourceFamily: "DISCOVERY", isEnabled: true, policyStatus: "ALLOWED" },
      },
    ];

    const mockCorroboratedOpp = {
      id: "opp-corrob-1",
      slug: "kubernetes-idle-gpu-watchdog",
      title: "Kubernetes Idle GPU Watchdog & Job Reaper",
      oneSentenceSummary: "Automatically detects and drains idle GPU instances on cloud clusters.",
      problemStatement: "Machine learning teams leave idle H100 pods allocated, driving $20k monthly waste.",
      industry: "Data Engineering & FinOps",
      economicBuyer: "Head of Infrastructure",
      endUser: "ML Platform Engineer",
      proposedProduct: "Real-time Kubernetes daemonset measuring GPU utilization and auto-evicting dead jobs",
      status: "DRAFT",
      publicationQualityStatus: "HYPOTHESIS",
      isDemoFixture: false,
      createdAt: now,
      evidenceLinks: [
        {
          id: "link-c-1",
          normalizedSignal: {
            id: "sig-c-1",
            sourceTitle: "GPU cluster idle spend costing $20k monthly",
            sanitizedExcerpt: "Idle GPU clusters draining infrastructure budget without monitoring.",
            problemSummary: "GPU spend waste.",
            canonicalUrl: "https://news.ycombinator.com/item?id=99999",
            publishedAt: now,
            rawSignal: {
              id: "raw-c-1",
              title: "GPU cluster idle spend costing $20k monthly",
              sourceUrl: "https://news.ycombinator.com/item?id=99999",
              createdAt: now,
              publishedAt: now,
              source: { key: "hackernews", name: "Hacker News", sourceFamily: "COMMUNITY", isEnabled: true },
            },
          },
        },
        {
          id: "link-c-2",
          normalizedSignal: {
            id: "sig-c-2",
            sourceTitle: "Cloud GPU cost overrun alerts missing in current k8s stack",
            sanitizedExcerpt: "We cannot track dangling GPU allocations across teams in EKS.",
            problemSummary: "Missing GPU cost watchdog.",
            canonicalUrl: "https://lobste.rs/s/gpu001",
            publishedAt: now,
            rawSignal: {
              id: "raw-c-2",
              title: "Cloud GPU cost overrun alerts missing in current k8s stack",
              sourceUrl: "https://lobste.rs/s/gpu001",
              createdAt: now,
              publishedAt: now,
              source: { key: "lobsters", name: "Lobsters", sourceFamily: "COMMUNITY", isEnabled: true },
            },
          },
        },
      ],
    };

    const mockPrisma = {
      opportunity: { findMany: async () => [mockCorroboratedOpp] },
      normalizedSignal: { findMany: async () => mockNormalizedSignals },
      rawSignal: { findMany: async () => mockRawSignals },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5, signalsLimit: 5 });

    // 1. Level 1: Market Signals
    expect(feed.marketSignals).toHaveLength(1);
    expect(feed.marketSignals[0].sourceKey).toBe("cisakev");
    expect(feed.marketSignals[0].label).toBe("Market signal — not a validated business opportunity");

    // 2. Level 2: Research Leads (Uncorroborated single source with concrete problem)
    expect(feed.researchLeads).toHaveLength(1);
    const lead = feed.researchLeads[0];
    expect(lead.title).toContain("Kafka consumer rebalance latency spikes");
    expect(lead.plausibleBuyer).toBe("Streaming Platform Engineer");
    expect(lead.aiAssumptions).toHaveLength(3);
    expect(lead.concreteValidationStep).toBeDefined();
    expect(lead.concreteValidationStep).toContain("rebalance benchmark");

    // 3. Level 3: Corroborated Opportunities
    expect(feed.opportunityHypotheses).toHaveLength(1);
    expect(feed.opportunityHypotheses[0].title).toBe("Kubernetes Idle GPU Watchdog & Job Reaper");
    expect(feed.opportunityHypotheses[0].signalCount).toBe(2);

    // 4. Daily Brief Intelligence Summary
    expect(feed.dailyBrief).toBeDefined();
    expect(feed.dailyBrief?.date).toBe(now.toISOString().slice(0, 10));
    expect(feed.dailyBrief?.themes).toHaveLength(5);

    const dataFinOpsTheme = feed.dailyBrief?.themes.find((t) => t.theme === "Data Engineering & FinOps");
    expect(dataFinOpsTheme).toBeDefined();
    expect(dataFinOpsTheme?.corroboratedCount).toBe(1);
    expect(dataFinOpsTheme?.topPainHeadline).toBe("Kubernetes Idle GPU Watchdog & Job Reaper");
  });

  it("strictly enforces 14-day publication limit, excluding July 25 and September 30 stale records and undated items", async () => {
    // Current date is mid-October 2026
    const baseNow = new Date("2026-10-14T21:45:00.000Z");
    const freshDate = new Date("2026-10-12T10:00:00.000Z"); // 2 days old (valid)
    const september30Date = new Date("2026-09-30T07:56:17.000Z"); // 14.5 days old (stale)
    const july25Date = new Date("2026-07-25T07:11:24.000Z"); // 81 days old (stale)

    const mockRawSignals = [
      // 1. Fresh signal (within 14 days) -> should be included
      {
        id: "raw-fresh-1",
        title: "Docker container network DNS resolution failure in production",
        sourceUrl: "https://news.ycombinator.com/item?id=888801",
        createdAt: baseNow,
        publishedAt: freshDate,
        source: { key: "hackernews", name: "Hacker News", sourceFamily: "COMMUNITY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://news.ycombinator.com/item?id=888801",
          sourceTitle: "Docker container network DNS resolution failure in production",
          sanitizedExcerpt: "Containers fail to resolve internal cluster endpoints intermittently.",
          verificationStatus: "VERIFIED",
        },
      },
      // 2. September 30 record (14.5 days old) -> MUST BE EXCLUDED
      {
        id: "raw-stale-sept30",
        title: "Insert ,show, update, delete picture with PDO",
        sourceUrl: "https://stackoverflow.com/questions/80001001/insert-show-update-delete-picture",
        createdAt: baseNow,
        publishedAt: september30Date,
        source: { key: "stackexchange", name: "Stack Exchange & Stack Overflow", sourceFamily: "COMMUNITY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://stackoverflow.com/questions/80001001/insert-show-update-delete-picture",
          sourceTitle: "Insert ,show, update, delete picture with PDO",
          sanitizedExcerpt: "How to handle image upload and blob storage in PDO.",
          verificationStatus: "VERIFIED",
        },
      },
      // 3. July 25 record (81 days old) -> MUST BE EXCLUDED
      {
        id: "raw-stale-july25",
        title: "Kamal deploy SQLite error on start: unable to open database file",
        sourceUrl: "https://stackoverflow.com/questions/80001002/kamal-deploy-sqlite-error",
        createdAt: baseNow,
        publishedAt: july25Date,
        source: { key: "stackexchange", name: "Stack Exchange & Stack Overflow", sourceFamily: "COMMUNITY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://stackoverflow.com/questions/80001002/kamal-deploy-sqlite-error",
          sourceTitle: "Kamal deploy SQLite error on start: unable to open database file",
          sanitizedExcerpt: "Deploying sqlite with kamal fails on boot due to permission denied.",
          verificationStatus: "VERIFIED",
        },
      },
      // 4. Undated record (publishedAt: null) -> MUST BE EXCLUDED (discovery date cannot be substituted)
      {
        id: "raw-undated-1",
        title: "Undated legacy signal without publication timestamp",
        sourceUrl: "https://example.com/undated-issue",
        createdAt: baseNow,
        publishedAt: null,
        source: { key: "github", name: "GitHub Issues", sourceFamily: "DEVELOPER_ECOSYSTEM", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://example.com/undated-issue",
          sourceTitle: "Undated legacy signal without publication timestamp",
          sanitizedExcerpt: "No published date in feed source.",
          verificationStatus: "VERIFIED",
        },
      },
      // 5. Duplicate of fresh signal (same title) -> MUST BE DEDUPLICATED
      {
        id: "raw-fresh-dup",
        title: "Docker container network DNS resolution failure in production",
        sourceUrl: "https://lobste.rs/s/docker01",
        createdAt: baseNow,
        publishedAt: freshDate,
        source: { key: "lobsters", name: "Lobsters", sourceFamily: "COMMUNITY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://lobste.rs/s/docker01",
          sourceTitle: "Docker container network DNS resolution failure in production",
          sanitizedExcerpt: "Containers fail to resolve internal cluster endpoints intermittently.",
          verificationStatus: "VERIFIED",
        },
      },
    ];

    const mockPrisma = {
      opportunity: { findMany: async () => [] },
      normalizedSignal: { findMany: async () => [] },
      rawSignal: {
        findMany: async (args: any) => {
          // Simulate prisma filter on publishedAt >= fourteenDaysAgo and not null
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          return mockRawSignals.filter((r) => r.publishedAt && r.publishedAt >= fourteenDaysAgo);
        },
      },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 10, signalsLimit: 10 });

    // Verify only the 1 unique fresh signal was included
    expect(feed.marketSignals).toHaveLength(1);
    expect(feed.marketSignals[0].title).toBe("Docker container network DNS resolution failure in production");
    expect(feed.marketSignals[0].publishedAt).toBe(freshDate.toISOString());

    // Explicitly verify stale July 25 and September 30 records are excluded
    const titles = feed.marketSignals.map((s) => s.title);
    expect(titles).not.toContain("Insert ,show, update, delete picture with PDO");
    expect(titles).not.toContain("Kamal deploy SQLite error on start: unable to open database file");
    expect(titles).not.toContain("Undated legacy signal without publication timestamp");
  });

  it("ensures news, research papers, and CVEs are not labeled 'top pain' unless containing evidence of user friction", async () => {
    const baseNow = new Date("2026-10-14T21:45:00.000Z");

    const mockRawSignals = [
      // 1. Research paper from arXiv (scientific preprint, no user friction)
      {
        id: "raw-arxiv-1",
        title: "Two Clocks: Why Larger Rollout Batches Learn Slower in Reinforcement Learning",
        sourceUrl: "https://arxiv.org/abs/2610.18874v1",
        createdAt: baseNow,
        publishedAt: baseNow,
        source: { key: "arxiv", name: "arXiv Preprints", sourceFamily: "DISCOVERY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://arxiv.org/abs/2610.18874v1",
          sourceTitle: "Two Clocks: Why Larger Rollout Batches Learn Slower in Reinforcement Learning",
          sanitizedExcerpt: "We investigate rollout batch scaling behavior in deep reinforcement learning.",
          verificationStatus: "VERIFIED",
        },
      },
      // 2. CVE vulnerability bulletin (advisory, no concrete user friction)
      {
        id: "raw-cve-1",
        title: "CVE-2026-0322: Palo Alto Networks PAN-OS Code Injection Vulnerability",
        sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-0322",
        createdAt: baseNow,
        publishedAt: baseNow,
        source: { key: "cisakev", name: "CISA Known Exploited Vulnerabilities", sourceFamily: "DISCOVERY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-0322",
          sourceTitle: "CVE-2026-0322: Palo Alto Networks PAN-OS Code Injection Vulnerability",
          sanitizedExcerpt: "PAN-OS contains a remote command injection vulnerability.",
          verificationStatus: "VERIFIED",
        },
      },
      // 3. Generic news article (venture deal / funding announcement)
      {
        id: "raw-news-1",
        title: "Deals in brief: NEU Battery Materials raises USD 7.6 million Series A",
        sourceUrl: "https://kr-asia.com/neu-battery-series-a",
        createdAt: baseNow,
        publishedAt: baseNow,
        source: { key: "krasia", name: "KrASIA", sourceFamily: "DISCOVERY", isEnabled: true },
        normalizedSignal: {
          canonicalUrl: "https://kr-asia.com/neu-battery-series-a",
          sourceTitle: "Deals in brief: NEU Battery Materials raises USD 7.6 million Series A",
          sanitizedExcerpt: "Bringing you updates on venture funding across APAC markets.",
          verificationStatus: "VERIFIED",
        },
      },
    ];

    const mockPrisma = {
      opportunity: { findMany: async () => [] },
      normalizedSignal: { findMany: async () => [] },
      rawSignal: { findMany: async () => mockRawSignals },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5, signalsLimit: 5 });

    expect(feed.marketSignals).toHaveLength(3);
    expect(feed.researchLeads).toHaveLength(0);
    expect(feed.opportunityHypotheses).toHaveLength(0);

    // Verify daily brief themes: NONE of the news, paper, or CVE records can be labeled "top pain"
    for (const theme of feed.dailyBrief?.themes || []) {
      expect(theme.topPainHeadline).toBe("no qualifying pain signals");
    }
  });

  it("keeps single-source items labeled Research Leads and never validated opportunities", async () => {
    const baseNow = new Date("2026-10-14T21:45:00.000Z");

    const mockSingleSourceSignal = {
      id: "ns-single-1",
      canonicalUrl: "https://stackoverflow.com/questions/80009813/multi-project-visual-studio-template-error",
      sourceTitle: "Multi-Project Visual Studio Template Error",
      sanitizedExcerpt: "Visual studio fails to expand project parameters during multi-project template creation.",
      problemSummary: "Multi-Project Visual Studio Template Error breaking build automation.",
      actorRole: "Software Tooling & Systems Developers",
      signalType: "PAIN",
      verificationStatus: "VERIFIED",
      publishedAt: baseNow,
      rawSignal: {
        id: "raw-single-1",
        title: "Multi-Project Visual Studio Template Error",
        sourceUrl: "https://stackoverflow.com/questions/80009813/multi-project-visual-studio-template-error",
        createdAt: baseNow,
        publishedAt: baseNow,
        source: { key: "stackexchange", name: "Stack Exchange & Stack Overflow", sourceFamily: "COMMUNITY", isEnabled: true },
      },
    };

    const mockPrisma = {
      opportunity: { findMany: async () => [] },
      normalizedSignal: { findMany: async () => [mockSingleSourceSignal] },
      rawSignal: { findMany: async () => [] },
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5, signalsLimit: 5 });

    // Single source item MUST be a Research Lead, NOT in opportunityHypotheses
    expect(feed.opportunityHypotheses).toHaveLength(0);
    expect(feed.researchLeads).toHaveLength(1);

    const lead = feed.researchLeads[0];
    expect(lead.status).toBe("RESEARCH_LEAD");
    expect(lead.label).toBe("Research Lead — uncorroborated customer pain signal requiring validation");
    expect(lead.plausibleBuyer).toBe("Software Tooling & Systems Developers");
    expect(lead.aiAssumptions).toBeDefined();
    expect(lead.concreteValidationStep).toBeDefined();
  });
});
