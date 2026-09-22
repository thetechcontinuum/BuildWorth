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
            sanitizedExcerpt: "Excerpt 1",
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
            sanitizedExcerpt: "Excerpt 2",
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
    };

    const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
    expect(feed.success).toBe(true);
    expect(feed.totalCount).toBe(0);
    expect(feed.items).toHaveLength(0);
    expect(feed.hasItemsToday).toBe(false);
  });
});
