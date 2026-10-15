import { describe, it, expect } from "vitest";
import {
  isConcreteProblemOrWorkaround,
  scoreCandidateQuality,
  getDailyDiscoveryFeed,
  evaluateResearchLeadPromotion,
} from "../src/discovery/discovery-service.js";

describe("Opportunity Discovery Quality & Candidate Ranking Suite", () => {
  describe("Noise Filtering (isConcreteProblemOrWorkaround)", () => {
    it("disqualifies isolated compiler syntax errors, scalar initializer errors, and type mismatches", () => {
      // Real live production failure example:
      expect(
        isConcreteProblemOrWorkaround({
          title: "GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’",
          sanitizedExcerpt: "[c++, multithreading, gcc, compiler-errors, initialization] GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’",
          signalType: "PAIN",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);

      // Undefined reference / linker error:
      expect(
        isConcreteProblemOrWorkaround({
          title: "error: undefined reference to 'vtable for Widget'",
          sanitizedExcerpt: "Linking fails with undefined reference in local build.",
          signalType: "PAIN",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);

      // Runtime TypeError / NullPointerException in isolated snippet:
      expect(
        isConcreteProblemOrWorkaround({
          title: "TypeError: Cannot read properties of undefined (reading 'map')",
          sanitizedExcerpt: "Uncaught TypeError at App.tsx line 45 when rendering empty array.",
          signalType: "PAIN",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);

      expect(
        isConcreteProblemOrWorkaround({
          title: "NullPointerException at com.example.service.processItem(Service.java:102)",
          sanitizedExcerpt: "Null pointer when passing null argument in unit test.",
          signalType: "PAIN",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);
    });

    it("disqualifies isolated internal API error codes lacking operational workflow context", () => {
      // Real live production failure example:
      expect(
        isConcreteProblemOrWorkaround({
          title: "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
          sanitizedExcerpt: "[speech-to-text, chirp] combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
          signalType: "PAIN",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);
    });

    it("disqualifies beginner styling, spreadsheet linking quirks, and general advice questions", () => {
      expect(
        isConcreteProblemOrWorkaround({
          title: "Similar Link Between Excel Files Update When Not Asked",
          sanitizedExcerpt: "Excel updates links across sheets unexpectedly in desktop version.",
          signalType: "UNCLASSIFIED",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);

      expect(
        isConcreteProblemOrWorkaround({
          title: "How do I fix an image \"repeating\" in the background of a HTML website?",
          sanitizedExcerpt: "Image repeats horizontally across body in CSS.",
          signalType: "UNCLASSIFIED",
          sourceKey: "stackexchange",
        }),
      ).toBe(false);
    });

    it("permits authentic operational breakdowns, costly outages, and production workarounds", () => {
      expect(
        isConcreteProblemOrWorkaround({
          title: "Production container OOM-killed: Panel leaks every closed session (+ freezes, peaks, broken image build)",
          sanitizedExcerpt: "Memory continuously ramps up on active clusters, causing pods to get OOM-killed every 4 hours.",
          signalType: "PAIN",
          sourceKey: "github",
        }),
      ).toBe(true);

      expect(
        isConcreteProblemOrWorkaround({
          title: "Postgres query timeout in daily batch reconciliation causing manual recovery hack",
          sanitizedExcerpt: "Engineers spend 3 hours daily writing manual scripts to restart failed data pipeline jobs.",
          signalType: "WORKAROUND",
          sourceKey: "hackernews",
        }),
      ).toBe(true);
    });
  });

  describe("Candidate Quality Scoring (scoreCandidateQuality)", () => {
    it("penalizes and marks isolated compiler errors and internal error codes as NOISE", () => {
      const gccScore = scoreCandidateQuality({
        title: "GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’",
        sanitizedExcerpt: "error: braces around scalar initializer for type ‘unsigned int’",
        signalType: "PAIN",
        sourceKey: "stackexchange",
      });
      expect(gccScore.rankPriority).toBe("NOISE");
      expect(gccScore.totalScore).toBeLessThanOrEqual(0);
      expect(gccScore.noisePenalty).toBeLessThanOrEqual(-60);

      const diarizationScore = scoreCandidateQuality({
        title: "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
        sanitizedExcerpt: "code 13 INTERNAL error when calling API",
        signalType: "PAIN",
        sourceKey: "stackexchange",
      });
      expect(diarizationScore.rankPriority).toBe("NOISE");
      expect(diarizationScore.totalScore).toBeLessThanOrEqual(0);
    });

    it("evaluates high-recurrence, costly workarounds, and purchase intent signals as HIGH priority", () => {
      const productionIncidentScore = scoreCandidateQuality({
        title: "Production container OOM-killed: Panel leaks every closed session (+ freezes, peaks, broken image build)",
        sanitizedExcerpt: "Repeatedly happens daily across all production clusters, costing $6,000/mo in unexpected spend and 15 hours wasted debugging.",
        signalType: "PAIN",
        sourceKey: "github",
        metadata: { score: 24, viewCount: 3500 },
      });

      expect(productionIncidentScore.rankPriority).toBe("HIGH");
      expect(productionIncidentScore.totalScore).toBeGreaterThanOrEqual(50);
      expect(productionIncidentScore.recurrenceScore).toBeGreaterThanOrEqual(25);
      expect(productionIncidentScore.costlyWorkaroundScore).toBeGreaterThanOrEqual(20);

      const commercialIntentScore = scoreCandidateQuality({
        title: "Looking for a paid commercial tool to replace fragile custom deployment scripts",
        sanitizedExcerpt: "Willing to pay $500/mo for an enterprise solution. Current hacky workaround fails every sprint.",
        signalType: "PURCHASE_INTENT",
        purchaseIntent: true,
        sourceKey: "reddit",
      });

      expect(commercialIntentScore.rankPriority).toBe("HIGH");
      expect(commercialIntentScore.totalScore).toBeGreaterThanOrEqual(50);
      expect(commercialIntentScore.purchaseIntentScore).toBeGreaterThanOrEqual(40);
    });

    it("evaluates isolated authentic friction without recurrence as LOW priority research lead", () => {
      const singleLeadScore = scoreCandidateQuality({
        title: "Multi-Project Visual Studio Template Error breaking build automation",
        sanitizedExcerpt: "Visual studio fails to expand project parameters during multi-project template creation.",
        signalType: "PAIN",
        sourceKey: "stackexchange",
      });

      expect(singleLeadScore.rankPriority).toBe("LOW");
      expect(singleLeadScore.totalScore).toBeGreaterThan(0);
      expect(singleLeadScore.totalScore).toBeLessThan(25);
    });
  });

  describe("Discovery Feed Candidate Ranking & Promotion Integrity", () => {
    it("ranks high-impact recurring friction above weak single-source items, and completely filters out obscure syntax noise", async () => {
      const now = new Date();

      const mockSignals = [
        // 1. Noise: GCC scalar initializer error -> MUST BE FILTERED OUT
        {
          id: "sig-noise-gcc",
          canonicalUrl: "https://stackoverflow.com/questions/80008575/gcc-scalar-initializer",
          sourceTitle: "GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’",
          sanitizedExcerpt: "[c++, compiler-errors] error: braces around scalar initializer for type ‘unsigned int’",
          problemSummary: "error: braces around scalar initializer for type ‘unsigned int’",
          signalType: "PAIN",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-noise-gcc",
            title: "GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’",
            sourceUrl: "https://stackoverflow.com/questions/80008575/gcc-scalar-initializer",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            source: { key: "stackexchange", name: "Stack Exchange", sourceFamily: "COMMUNITY", isEnabled: true },
          },
        },
        // 2. Noise: Diarization internal error 13 -> MUST BE FILTERED OUT
        {
          id: "sig-noise-diarization",
          canonicalUrl: "https://stackoverflow.com/questions/80008576/speaker-diarization-error",
          sourceTitle: "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
          sanitizedExcerpt: "[speech-to-text] combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
          problemSummary: "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
          signalType: "PAIN",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-noise-diarization",
            title: "combining speaker diarization and speech adaptation causes a code 13 INTERNAL error",
            sourceUrl: "https://stackoverflow.com/questions/80008576/speaker-diarization-error",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            source: { key: "stackexchange", name: "Stack Exchange", sourceFamily: "COMMUNITY", isEnabled: true },
          },
        },
        // 3. Low-Priority Research Lead: Visual Studio template error
        {
          id: "sig-low-template",
          canonicalUrl: "https://stackoverflow.com/questions/80009813/multi-project-template-error",
          sourceTitle: "Multi-Project Visual Studio Template Error breaking build automation",
          sanitizedExcerpt: "Visual studio fails to expand project parameters during multi-project template creation.",
          problemSummary: "Multi-Project Visual Studio Template Error breaking build automation.",
          actorRole: "Software Tooling & Systems Developers",
          signalType: "PAIN",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-low-template",
            title: "Multi-Project Visual Studio Template Error breaking build automation",
            sourceUrl: "https://stackoverflow.com/questions/80009813/multi-project-template-error",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            source: { key: "stackexchange", name: "Stack Exchange", sourceFamily: "COMMUNITY", isEnabled: true },
          },
        },
        // 4. High-Priority Research Lead: Production container OOM-kill and memory leak
        {
          id: "sig-high-oom",
          canonicalUrl: "https://github.com/org/repo/issues/1001",
          sourceTitle: "Production container OOM-killed: Panel leaks every closed session (+ freezes, peaks, broken image build)",
          sanitizedExcerpt: "Memory continuously ramps up on active clusters daily across all teams, costing $4,500/mo cloud spend and 12 hours wasted debugging.",
          problemSummary: "Production container OOM-killed with memory leak across closed sessions in production clusters.",
          actorRole: "Platform Engineering & Site Reliability Teams",
          signalType: "PAIN",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-high-oom",
            title: "Production container OOM-killed: Panel leaks every closed session (+ freezes, peaks, broken image build)",
            sourceUrl: "https://github.com/org/repo/issues/1001",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
            source: { key: "github", name: "GitHub Issues", sourceFamily: "DEVELOPER_ECOSYSTEM", isEnabled: true },
            metadata: { score: 18, viewCount: 2200 },
          },
        },
      ];

      const mockPrisma = {
        opportunity: { findMany: async () => [] },
        normalizedSignal: { findMany: async () => mockSignals },
        rawSignal: { findMany: async () => [] },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5, researchLeadsLimit: 5 });

      // Verify NOISE signals are completely excluded from research leads
      const titles = feed.researchLeads.map((l) => l.title);
      expect(titles).not.toContain("GCC 6.5.0 C++11 compilation of concurrence.h: error: braces around scalar initializer for type ‘unsigned int’");
      expect(titles).not.toContain("combining speaker diarization and speech adaptation causes a code 13 INTERNAL error");

      // Verify research leads count: exactly 2 authentic leads (High-OOM and Low-Template)
      expect(feed.researchLeads).toHaveLength(2);

      // Verify candidate ranking: HIGH priority OOM lead ranks FIRST over LOW priority template lead
      expect(feed.researchLeads[0].title).toContain("Production container OOM-killed");
      expect(feed.researchLeads[0].priorityRank).toBe("HIGH");
      expect(feed.researchLeads[0].candidateScore).toBeGreaterThanOrEqual(50);
      expect(feed.researchLeads[0].verificationStatus).toBe("UNVERIFIED");
      expect(feed.researchLeads[0].isPromoted).toBe(false);

      expect(feed.researchLeads[1].title).toContain("Multi-Project Visual Studio Template Error");
      expect(feed.researchLeads[1].priorityRank).toBe("LOW");
      expect(feed.researchLeads[1].candidateScore).toBeLessThan(feed.researchLeads[0].candidateScore!);

      // Verify uncorroborated items are NEVER promoted to Opportunity Hypotheses:
      expect(feed.opportunityHypotheses).toHaveLength(0);
    });

    it("promotes ONLY when independent sources support the same problem space", async () => {
      const now = new Date();

      const mockCorroboratedSignals = [
        // Signal 1 from GitHub
        {
          id: "sig-kafka-gh",
          canonicalUrl: "https://github.com/apache/kafka-connect/issues/4910",
          sourceTitle: "Kafka consumer lag alert engine partition rebalance deadlock in production",
          sanitizedExcerpt: "Consumer lag spikes during rebalance deadlock causing 3 hours downtime and message backlog across clusters.",
          problemSummary: "Kafka consumer lag alert engine partition rebalance deadlock in production",
          actorRole: "Distributed Systems & Streaming Infrastructure Engineers",
          signalType: "PAIN",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-kafka-gh",
            title: "Kafka consumer lag alert engine partition rebalance deadlock in production",
            sourceUrl: "https://github.com/apache/kafka-connect/issues/4910",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            source: { key: "github", name: "GitHub Issues", sourceFamily: "DEVELOPER_ECOSYSTEM", isEnabled: true },
          },
        },
        // Signal 2 from independent Lobsters discussion confirming the exact same problem
        {
          id: "sig-kafka-lobsters",
          canonicalUrl: "https://lobste.rs/s/kafka-lag-deadlock",
          sourceTitle: "Kafka partition rebalance deadlock and consumer lag alert failure",
          sanitizedExcerpt: "We repeatedly hit kafka partition rebalance deadlock in streaming clusters, leading to manual offsets reset workaround.",
          problemSummary: "Kafka partition rebalance deadlock and consumer lag alert failure",
          actorRole: "Distributed Systems & Streaming Infrastructure Engineers",
          signalType: "WORKAROUND",
          verificationStatus: "VERIFIED",
          publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          rawSignal: {
            id: "raw-kafka-lobsters",
            title: "Kafka partition rebalance deadlock and consumer lag alert failure",
            sourceUrl: "https://lobste.rs/s/kafka-lag-deadlock",
            createdAt: now,
            publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            source: { key: "lobsters", name: "Lobsters", sourceFamily: "COMMUNITY", isEnabled: true },
          },
        },
      ];

      const mockPrisma = {
        opportunity: { findMany: async () => [] },
        normalizedSignal: { findMany: async () => mockCorroboratedSignals },
        rawSignal: { findMany: async () => [] },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });

      // Corroborated across 2 independent sources -> Promoted to Opportunity Hypothesis!
      expect(feed.opportunityHypotheses).toHaveLength(1);
      const hypo = feed.opportunityHypotheses[0];
      expect(hypo.status).toBe("HYPOTHESIS");
      expect(hypo.signalCount).toBe(2);
      expect(hypo.evidenceObservations).toHaveLength(2);
      expect(hypo.verificationLabel).toBe("Early idea / Not yet verified");
      expect(hypo.businessHypothesis?.confidenceNote).toContain("Promoted from Research Lead based on corroboration across 2 independent sources");
    });

    it("returns zero opportunities when none qualify without inventing demand or forcing a daily quota", async () => {
      const mockPrisma = {
        opportunity: { findMany: async () => [] },
        normalizedSignal: { findMany: async () => [] },
        rawSignal: { findMany: async () => [] },
      };

      const feed = await getDailyDiscoveryFeed(mockPrisma as any, { limit: 5 });

      expect(feed.opportunityHypotheses).toEqual([]);
      expect(feed.researchLeads).toEqual([]);
      expect(feed.marketSignals).toEqual([]);
      expect(feed.totalCount).toBe(0);
      expect(feed.hasItemsToday).toBe(false);
    });
  });
});
