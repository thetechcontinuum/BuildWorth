import { describe, it, expect } from "vitest";
import { synthesizeOpportunity } from "../src/synthesizer.js";
import { getDailyDiscoveryFeed } from "../src/discovery/discovery-service.js";
import { APP_CONSTANTS } from "@buildworth/config";
import { SCHEDULED_TASKS } from "../../../apps/scheduler/src/index.js";

describe("Hypothesis Grounding & Schedule Alignment Regression Suite", () => {
  describe("AI Chip / Market News Grounding Regression", () => {
    it("ensures general market news about AI chips/talent does not produce a generic Data Engineering/FinOps hypothesis", () => {
      const chipCluster = {
        clusterId: "cluster-ai-chips",
        title: "Chinese AI Chip Talent and Advanced Packaging Expansion",
        summary:
          "Domestic semiconductor equipment makers expand hiring for high-bandwidth memory packaging and sub-7nm lithography research in Shanghai.",
        vertical: "Semiconductors & DeepTech",
        signalIds: ["sig-chip-1"],
        centroid: [0.85, 0.12, 0.33],
      };

      const blueprint = synthesizeOpportunity(chipCluster, 1);

      // Verify that the synthesized product directly references the cluster's domain, NOT generic Data Engineering / FinOps
      expect(blueprint.proposedProduct).not.toContain("Data Engineering & FinOps");
      expect(blueprint.proposedProduct).not.toContain("Lightweight SaaS tool providing automated monitoring, scheduled sync, and alerting for Data Engineering");
      expect(blueprint.proposedProduct).toContain("Chinese AI Chip Talent and Advanced Packaging Expansion");
      expect(blueprint.targetCustomerSegments[0]).toContain("Semiconductors & DeepTech");
    });

    it("ensures a general market news signal without pain/workaround/intent is excluded from opportunity hypotheses in the discovery feed", async () => {
      const mockOppWithoutProblemEvidence = {
        id: "opp-news-1",
        slug: "china-ai-chip-advancements",
        title: "Chinese AI Chip Talent Migration",
        oneSentenceSummary: "News summary of chip talent migration",
        problemStatement: "Informative overview of domestic semiconductor investments without customer friction",
        status: "DRAFT",
        publicationQualityStatus: "HYPOTHESIS",
        isDemoFixture: false,
        createdAt: new Date(),
        evidenceLinks: [
          {
            id: "link-news-1",
            claimType: "MARKET_ACTIVITY",
            normalizedSignal: {
              id: "sig-news-1",
              signalType: "EMERGING_TECH",
              purchaseIntent: false,
              sourceTitle: "China chipmakers ramp up domestic talent hiring",
              sanitizedExcerpt: "Semiconductor equipment foundries in Shanghai increase domestic talent acquisitions following international restrictions.",
              problemSummary: "Domestic chip talent acquisition increases.",
              canonicalUrl: "https://kr-asia.com/china-chip-talent-news",
              rawSignal: {
                id: "raw-news-1",
                title: "China chipmakers ramp up domestic talent hiring",
                sourceUrl: "https://kr-asia.com/china-chip-talent-news",
                createdAt: new Date(),
                source: {
                  key: "krasia",
                  name: "KrASIA",
                  sourceFamily: "DISCOVERY",
                },
              },
            },
          },
        ],
      };

      const mockPrisma = {
        opportunity: {
          findMany: async () => [mockOppWithoutProblemEvidence],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
      expect(feed.success).toBe(true);
      // Because this signal was pure EMERGING_TECH news without pain/workaround/intent, it must NOT appear as an opportunity hypothesis
      expect(feed.opportunityHypotheses).toHaveLength(0);
    });

    it("allows a signal with concrete pain, workaround, or purchase intent to produce a grounded hypothesis", async () => {
      const mockGroundedOpp = {
        id: "opp-grounded-1",
        slug: "runaway-gpu-cluster-cost-alerting",
        title: "Runaway GPU Cluster Cost Spikes",
        oneSentenceSummary: "Automated cost alerting for unallocated GPU cloud nodes",
        problemStatement: "Engineering teams lose $15k/month on idle H100 instances left running unattended.",
        status: "DRAFT",
        publicationQualityStatus: "HYPOTHESIS",
        isDemoFixture: false,
        createdAt: new Date(),
        evidenceLinks: [
          {
            id: "link-pain-1",
            claimType: "PAIN_EXISTENCE",
            normalizedSignal: {
              id: "sig-pain-1",
              signalType: "PAIN_COMPLAINT",
              purchaseIntent: false,
              sourceTitle: "Forgotten H100 cluster ruined our monthly AWS bill",
              sanitizedExcerpt: "We forgot 8 H100 pods idling over the holiday weekend costing us $18,000 in unexpected cloud spend.",
              problemSummary: "Unattended GPU instances waste engineering budget.",
              canonicalUrl: "https://news.ycombinator.com/item?id=9928172",
              rawSignal: {
                id: "raw-pain-1",
                title: "Forgotten H100 cluster ruined our monthly AWS bill",
                sourceUrl: "https://news.ycombinator.com/item?id=9928172",
                createdAt: new Date(),
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
          findMany: async () => [mockGroundedOpp],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
      expect(feed.success).toBe(true);
      expect(feed.opportunityHypotheses).toHaveLength(1);
      const item = feed.opportunityHypotheses[0];
      expect(item.title).toBe("Runaway GPU Cluster Cost Spikes");
      expect(item.observedFacts[0]).toContain("costing us $18,000");
      expect(item.businessHypothesis.painFriction).toContain("Engineering teams lose $15k/month");
    });
  });

  describe("Schedule Alignment & Configuration Accuracy", () => {
    it("ensures scheduled tasks contain no references to inaccurate 06:00 AM", () => {
      const discoveryTask = SCHEDULED_TASKS.find((t) => t.name === "daily_opportunity_discovery");
      expect(discoveryTask).toBeDefined();
      expect(discoveryTask?.cron).toBe("0 0 * * *");
      expect(discoveryTask?.cron).toBe(APP_CONSTANTS.INGESTION_SCHEDULE.PRIMARY_CRON);
      expect(discoveryTask?.description).toContain("00:00 UTC");

      // Verify no task uses 06:00 AM
      const obsolete06AmTask = SCHEDULED_TASKS.find((t) => t.cron === "0 6 * * *");
      expect(obsolete06AmTask).toBeUndefined();
    });

    it("verifies single source of truth between APP_CONSTANTS and Vercel Cron specification", () => {
      expect(APP_CONSTANTS.INGESTION_SCHEDULE.PRIMARY_CRON).toBe("0 0 * * *");
      expect(APP_CONSTANTS.INGESTION_SCHEDULE.FALLBACK_CRON).toBe("15 1 * * *");
    });
  });
});
