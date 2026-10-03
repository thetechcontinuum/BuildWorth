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
    const mockSignalCreatedAt = new Date("2026-09-20T10:00:00Z");
    const mockSignalPublishedAt = new Date("2026-09-19T08:00:00Z");
    const mockOppCreatedAt = new Date("2026-09-21T09:00:00Z");

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
    const mockPublishedAt = new Date("2026-09-24T12:00:00Z");
    const mockCreatedAt = new Date("2026-09-25T00:30:00Z");

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
});
