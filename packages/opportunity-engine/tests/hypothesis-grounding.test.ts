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

    it("ensures an ungrounded news article is NOT qualified as an opportunity hypothesis just because the opportunity title or problem statement contains problem keywords", async () => {
      const mockAlibabaNewsOpp = {
        id: "opp-alibaba-1",
        slug: "china-push-for-domestic-ai-chip-capability",
        title: "China's push for domestic AI chip capability amid internatio",
        oneSentenceSummary: "News report on Chinese AI chip cluster buildout",
        problemStatement: "China's push for domestic AI chip capability amid international competition and technology safety concerns",
        status: "DRAFT",
        publicationQualityStatus: "HYPOTHESIS",
        isDemoFixture: false,
        createdAt: new Date(),
        evidenceLinks: [
          {
            id: "link-ali-1",
            claimType: "MARKET_ATTRACTIVENESS",
            normalizedSignal: {
              id: "sig-ali-1",
              signalType: "MARKET_ACTIVITY",
              purchaseIntent: false,
              sourceTitle: "Alibaba touts most powerful AI chip in China for data center buildout",
              sanitizedExcerpt: "The conglomerate is targeting 20 GW of capacity by 2032 amid a debate over technology safety.",
              problemSummary: "Alibaba data center expansion announcement.",
              canonicalUrl: "https://kr-asia.com/alibaba-touts-most-powerful-ai-chip-in-china-for-data-center-buildout",
              rawSignal: {
                id: "raw-ali-1",
                title: "Alibaba touts most powerful AI chip in China for data center buildout",
                sourceUrl: "https://kr-asia.com/alibaba-touts-most-powerful-ai-chip-in-china-for-data-center-buildout",
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
          findMany: async () => [mockAlibabaNewsOpp],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
      expect(feed.success).toBe(true);
      // Must be excluded because the excerpt contains no customer pain, workaround, or purchase intent
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
      expect(item.businessHypothesis.purchaseIntentStatus).toBe("UNKNOWN");
      expect(item.businessHypothesis.assumptions).toBeDefined();
      expect(item.businessHypothesis.assumptions?.length).toBeGreaterThan(0);
      expect(item.businessHypothesis.validationExperiment).toBeDefined();
    });

    it("synthesizes an unverified HYPOTHESIS from recent NormalizedSignal with concrete pain when stored opportunities are empty", async () => {
      const mockPainNormalizedSignal = {
        id: "ns-auth-pain-1",
        signalType: "PAIN_COMPLAINT",
        purchaseIntent: false,
        actorRole: "DevOps Engineer",
        sourceTitle: "Kafka lag monitoring breaks silently during traffic spikes",
        sanitizedExcerpt: "Our Kafka consumer lag alert fails silently on partition rebalance, causing hours of latency bottleneck before on-call notices.",
        problemSummary: "Silent Kafka consumer lag monitoring failures during partition rebalancing.",
        canonicalUrl: "https://github.com/segment/kafka-go/issues/9981",
        createdAt: new Date("2026-10-12T14:00:00Z"),
        rawSignal: {
          id: "raw-auth-pain-1",
          title: "Kafka lag monitoring breaks silently during traffic spikes",
          sourceUrl: "https://github.com/segment/kafka-go/issues/9981",
          publishedAt: new Date("2026-10-12T13:30:00Z"),
          createdAt: new Date("2026-10-12T14:00:00Z"),
          source: {
            key: "github",
            name: "GitHub Issues & Discussions",
            sourceFamily: "DEVELOPER_ECOSYSTEM",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      const mockPureNewsSignal = {
        id: "ns-auth-news-1",
        signalType: "MARKET_ACTIVITY",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "Tech Giant announces quarterly developer conference dates",
        sanitizedExcerpt: "The annual developer convention will take place in San Francisco next spring with keynote speakers.",
        problemSummary: "Developer convention scheduling announcement.",
        canonicalUrl: "https://siliconcanals.com/tech-giant-conference-2026",
        createdAt: new Date("2026-10-12T15:00:00Z"),
        rawSignal: {
          id: "raw-auth-news-1",
          title: "Tech Giant announces quarterly developer conference dates",
          sourceUrl: "https://siliconcanals.com/tech-giant-conference-2026",
          publishedAt: new Date("2026-10-12T14:30:00Z"),
          createdAt: new Date("2026-10-12T15:00:00Z"),
          source: {
            key: "siliconcanals",
            name: "Silicon Canals",
            sourceFamily: "DISCOVERY",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      const mockPrisma = {
        opportunity: {
          findMany: async () => [], // No persisted draft opportunity rows
        },
        normalizedSignal: {
          findMany: async () => [mockPainNormalizedSignal, mockPureNewsSignal],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
      expect(feed.success).toBe(true);

      // Must produce exactly 1 hypothesis from the concrete pain signal, and 0 from the generic news signal
      expect(feed.opportunityHypotheses).toHaveLength(1);
      const hyp = feed.opportunityHypotheses[0];
      expect(hyp.title).toContain("Kafka lag monitoring breaks silently");
      expect(hyp.status).toBe("HYPOTHESIS");
      expect(hyp.verificationLabel).toBe("Early idea / Not yet verified");
      expect(hyp.observedFacts[0]).toContain("partition rebalance");
      expect(hyp.businessHypothesis.targetAudience).toBe("DevOps Engineer");
      expect(hyp.businessHypothesis.purchaseIntentStatus).toBe("UNKNOWN");
      expect(hyp.businessHypothesis.assumptions).toBeDefined();
      expect(hyp.businessHypothesis.assumptions?.length).toBeGreaterThan(0);
      expect(hyp.businessHypothesis.validationExperiment).toContain("consumer lag threshold alerts");
      expect(hyp.canonicalUrl).toBe("https://github.com/segment/kafka-go/issues/9981");
    });

    it("treats public tenders (TED), vulnerabilities (CISA KEV), and research (arXiv) as Market Signals without synthesizing ungrounded hypotheses", async () => {
      const mockTenderOpp = {
        id: "opp-tender-1",
        slug: "eu-tender-cloud-monitoring",
        title: "EU Public Tender for Cloud Infrastructure Services",
        oneSentenceSummary: "Government agency tender for cloud operations",
        problemStatement: "Government agency issues invitation to tender for multi-cloud monitoring contract.",
        status: "DRAFT",
        publicationQualityStatus: "HYPOTHESIS",
        isDemoFixture: false,
        createdAt: new Date(),
        evidenceLinks: [
          {
            id: "link-ted-1",
            claimType: "BUYER_DEMAND",
            normalizedSignal: {
              id: "sig-ted-1",
              signalType: "PROCUREMENT",
              purchaseIntent: false,
              sourceTitle: "EU Public Tender for Cloud Infrastructure Services",
              sanitizedExcerpt: "Invitation to tender notice for cloud infrastructure management published by public agency.",
              problemSummary: "EU agency tender notice.",
              canonicalUrl: "https://ted.europa.eu/en/notice/-/detail/600123-2026",
              rawSignal: {
                id: "raw-ted-1",
                title: "EU Public Tender for Cloud Infrastructure Services",
                sourceUrl: "https://ted.europa.eu/en/notice/-/detail/600123-2026",
                createdAt: new Date(),
                source: {
                  key: "ted",
                  name: "TED Europa Tenders",
                  sourceFamily: "DISCOVERY",
                },
              },
            },
          },
        ],
      };

      const mockPrisma = {
        opportunity: {
          findMany: async () => [mockTenderOpp],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
      expect(feed.success).toBe(true);
      // Tender without verified commercial customer pain/WTP must NOT be an opportunity hypothesis
      expect(feed.opportunityHypotheses).toHaveLength(0);
    });

    it("displays tender and vulnerability signals in marketSignals section with authentic source labels", async () => {
      const mockRawTender = {
        id: "raw-ted-live",
        sourceUrl: "https://ted.europa.eu/en/notice/-/detail/600123-2026",
        title: "Automated identity verification for public portals",
        rawContent: "Tender contract notice for public portal IAM upgrades.",
        publishedAt: new Date("2026-10-01T08:00:00Z"),
        createdAt: new Date("2026-10-01T12:00:00Z"),
        source: {
          key: "ted",
          name: "TED Europa Tenders",
          sourceFamily: "DISCOVERY",
          isEnabled: true,
          policyStatus: "ALLOWED",
        },
        normalizedSignal: {
          canonicalUrl: "https://ted.europa.eu/en/notice/-/detail/600123-2026",
          sourceTitle: "Automated identity verification for public portals",
          sanitizedExcerpt: "Tender contract notice for public portal IAM upgrades.",
        },
      };

      const mockRawCisa = {
        id: "raw-cisa-live",
        sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-8877",
        title: "CVE-2026-8877: Firewall Remote Code Execution",
        rawContent: "Active in-the-wild exploitation of network edge firewall gateway.",
        publishedAt: new Date("2026-10-01T09:00:00Z"),
        createdAt: new Date("2026-10-01T12:05:00Z"),
        source: {
          key: "cisakev",
          name: "CISA Known Exploited Vulnerabilities",
          sourceFamily: "DISCOVERY",
          isEnabled: true,
          policyStatus: "ALLOWED",
        },
        normalizedSignal: {
          canonicalUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-8877",
          sourceTitle: "CVE-2026-8877: Firewall Remote Code Execution",
          sanitizedExcerpt: "Active in-the-wild exploitation of network edge firewall gateway.",
        },
      };

      const mockPrisma = {
        opportunity: {
          findMany: async () => [],
        },
        rawSignal: {
          findMany: async () => [mockRawTender, mockRawCisa],
        },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { signalsLimit: 5 });
      expect(feed.success).toBe(true);
      expect(feed.marketSignals).toHaveLength(2);

      const tedSignal = feed.marketSignals.find((s) => s.sourceKey === "ted");
      expect(tedSignal).toBeDefined();
      expect(tedSignal?.market).toBe("Europe");
      expect(tedSignal?.label).toBe("Market signal — not a validated business opportunity");

      const cisaSignal = feed.marketSignals.find((s) => s.sourceKey === "cisakev");
      expect(cisaSignal).toBeDefined();
      expect(cisaSignal?.market).toBe("Global / Cybersecurity");
      expect(cisaSignal?.label).toBe("Market signal — not a validated business opportunity");
    });

    describe("Five Live Feed Examples Quality Regression", () => {
      // 1. Concrete user breakdown: Rotex HPSU UART sensor decoding failure
      const rotexSignal = {
        id: "ns-rotex-1",
        signalType: "PAIN",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "No valid decoding for Rotex HPSU bi-bloc 2010 RRLQ008BAV3 – likely old \"S protocol\" vs. newer \"I protocol\"",
        sanitizedExcerpt: "No valid sensor decoding on a 2010-generation Rotex RRLQ008BAV3 outdoor unit. UART communication is confirmed working, but every configured entity permanently reports Unbekannt.",
        problemSummary: "No valid decoding for Rotex HPSU bi-bloc 2010 RRLQ008BAV3 – likely old \"S protocol\" vs. newer \"I protocol\"",
        canonicalUrl: "https://github.com/wrfz/esphome-components/issues/18",
        createdAt: new Date("2026-10-13T18:06:00Z"),
        rawSignal: {
          id: "raw-rotex-1",
          title: "No valid decoding for Rotex HPSU bi-bloc 2010 RRLQ008BAV3 – likely old \"S protocol\" vs. newer \"I protocol\"",
          sourceUrl: "https://github.com/wrfz/esphome-components/issues/18",
          publishedAt: new Date("2026-09-11T08:38:22Z"),
          createdAt: new Date("2026-10-13T18:06:00Z"),
          source: {
            key: "github",
            name: "GitHub Issues & Discussions",
            sourceFamily: "DEVELOPER_ECOSYSTEM",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      // 2. Feature request backlog / enhancement without user breakdown: eBay tools EP-13
      const ebayFeatureSignal = {
        id: "ns-ebay-1",
        signalType: "FEATURE_REQUEST",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "EP-13: 18 eBay flag markets, verified fee/tax engine, universal bulk results table + branded PDF/CSV",
        sanitizedExcerpt: "EP-13 — All 18 eBay marketplaces, evidence-backed fee/tax calculations, and Add-to-List/PDF on EVERY tool. Owner requirements: All existing ten public eCommPilot tools should have bulk flow.",
        problemSummary: "EP-13: 18 eBay flag markets, verified fee/tax engine, universal bulk results table + branded PDF/CSV",
        canonicalUrl: "https://github.com/ponzey717/ecommpilot-main/issues/11",
        createdAt: new Date("2026-10-13T18:06:00Z"),
        rawSignal: {
          id: "raw-ebay-1",
          title: "EP-13: 18 eBay flag markets, verified fee/tax engine, universal bulk results table + branded PDF/CSV",
          sourceUrl: "https://github.com/ponzey717/ecommpilot-main/issues/11",
          publishedAt: new Date("2026-10-13T12:03:17Z"),
          createdAt: new Date("2026-10-13T18:06:00Z"),
          source: {
            key: "github",
            name: "GitHub Issues & Discussions",
            sourceFamily: "DEVELOPER_ECOSYSTEM",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      // 3. Academic paper / journal article: Vaporware as a Means of Entry Deterrence
      const vaporwarePaperSignal = {
        id: "ns-vaporware-1",
        signalType: "MARKET_ACTIVITY",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "Vaporware as a Means of Entry Deterrence",
        sanitizedExcerpt: "Vaporware as a Means of Entry Deterrence",
        problemSummary: "Vaporware as a Means of Entry Deterrence",
        canonicalUrl: "https://onlinelibrary.wiley.com/doi/abs/10.1111/1467-6451.00204",
        createdAt: new Date("2026-10-13T18:06:00Z"),
        rawSignal: {
          id: "raw-vaporware-1",
          title: "Vaporware as a Means of Entry Deterrence",
          sourceUrl: "https://onlinelibrary.wiley.com/doi/abs/10.1111/1467-6451.00204",
          publishedAt: new Date("2026-10-13T17:58:00Z"),
          createdAt: new Date("2026-10-13T18:06:00Z"),
          source: {
            key: "hackernews",
            name: "Hacker News",
            sourceFamily: "COMMUNITY",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      // 4. Project launch / announcement: MountX dynamic language
      const mountxLaunchSignal = {
        id: "ns-mountx-1",
        signalType: "EMERGING_TECH",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "MountX: A self-hosted dynamic language compiling to C99",
        sanitizedExcerpt: "MountX: A self-hosted dynamic language compiling to C99",
        problemSummary: "MountX: A self-hosted dynamic language compiling to C99",
        canonicalUrl: "https://github.com/mountxlang-eng/mountxlang",
        createdAt: new Date("2026-10-13T18:06:00Z"),
        rawSignal: {
          id: "raw-mountx-1",
          title: "MountX: A self-hosted dynamic language compiling to C99",
          sourceUrl: "https://github.com/mountxlang-eng/mountxlang",
          publishedAt: new Date("2026-10-13T17:58:53Z"),
          createdAt: new Date("2026-10-13T18:06:00Z"),
          source: {
            key: "hackernews",
            name: "Hacker News",
            sourceFamily: "COMMUNITY",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      // 5. Generic technical Q&A: OpenCL local size performance advice
      const openclQuestionSignal = {
        id: "ns-opencl-1",
        signalType: "PAIN",
        purchaseIntent: false,
        actorRole: null,
        sourceTitle: "Why does adding local size improve performance in OpenCL?",
        sanitizedExcerpt: "[advice] Why does adding local size improve performance in OpenCL?",
        problemSummary: "Why does adding local size improve performance in OpenCL?",
        canonicalUrl: "https://stackoverflow.com/questions/80009772/why-does-adding-local-size-improve-performance-in-opencl",
        createdAt: new Date("2026-10-13T18:06:00Z"),
        rawSignal: {
          id: "raw-opencl-1",
          title: "Why does adding local size improve performance in OpenCL?",
          sourceUrl: "https://stackoverflow.com/questions/80009772/why-does-adding-local-size-improve-performance-in-opencl",
          publishedAt: new Date("2026-10-13T17:53:53Z"),
          createdAt: new Date("2026-10-13T18:06:00Z"),
          source: {
            key: "stackexchange",
            name: "Stack Exchange & Stack Overflow",
            sourceFamily: "COMMUNITY",
            isEnabled: true,
            policyStatus: "ALLOWED",
          },
        },
      };

      it("retains the concrete Rotex sensor breakdown as a qualified hypothesis with specific buyer and validation experiment", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: { findMany: async () => [rotexSignal] },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        expect(feed.opportunityHypotheses).toHaveLength(1);

        const hyp = feed.opportunityHypotheses[0];
        expect(hyp.title).toContain("Rotex HPSU");
        expect(hyp.observedFacts[0]).toContain("permanently reports Unbekannt");
        // Must NOT use generic "Early Adopter Teams"
        expect(hyp.businessHypothesis.targetAudience).not.toBe("Early Adopter Teams");
        expect(hyp.businessHypothesis.targetAudience).toBe("IoT & Smart HVAC Firmware Engineers");
        // Validation experiment must be tailored, not generic interviews
        expect(hyp.businessHypothesis.validationExperiment).toContain("packet-sniffing decoder prototype");
        expect(hyp.businessHypothesis.purchaseIntentStatus).toBe("UNKNOWN");
      });

      it("excludes academic research papers from opportunity hypotheses", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: { findMany: async () => [vaporwarePaperSignal] },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        expect(feed.opportunityHypotheses).toHaveLength(0);
      });

      it("excludes project / language announcements from opportunity hypotheses", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: { findMany: async () => [mountxLaunchSignal] },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        expect(feed.opportunityHypotheses).toHaveLength(0);
      });

      it("excludes generic technical questions and advice posts from opportunity hypotheses", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: { findMany: async () => [openclQuestionSignal] },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        expect(feed.opportunityHypotheses).toHaveLength(0);
      });

      it("excludes feature requests without user breakdown/friction from opportunity hypotheses", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: { findMany: async () => [ebayFeatureSignal] },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        expect(feed.opportunityHypotheses).toHaveLength(0);
      });

      it("evaluates all 5 live candidates simultaneously and retains ONLY the genuine breakdown (Rotex)", async () => {
        const mockPrisma = {
          opportunity: { findMany: async () => [] },
          normalizedSignal: {
            findMany: async () => [
              rotexSignal,
              ebayFeatureSignal,
              vaporwarePaperSignal,
              mountxLaunchSignal,
              openclQuestionSignal,
            ],
          },
        };

        const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });
        expect(feed.success).toBe(true);
        // Exactly 1 hypothesis qualifies
        expect(feed.opportunityHypotheses).toHaveLength(1);
        expect(feed.opportunityHypotheses[0].title).toContain("Rotex HPSU");
      });
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
