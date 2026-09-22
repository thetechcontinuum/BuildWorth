import { describe, it, expect, vi } from "vitest";
import { sourceRegistry } from "../src/registry.js";
import { runAdapterIngestion } from "../src/runner.js";
import { KrAsiaAdapter } from "../src/adapters/krasia.js";
import { E27Adapter } from "../src/adapters/e27.js";
import { deriveIndependenceKey } from "../src/sanitizer.js";
import * as safeFetchModule from "../src/safe-fetch.js";

describe("Source Registry & Adapters", () => {
  it("has 10 registered adapters by default including Asian, European, and developer discovery sources", () => {
    const adapters = sourceRegistry.getAllAdapters();
    expect(adapters.length).toBe(10);
    expect(sourceRegistry.getAdapter("krasia")).toBeDefined();
    expect(sourceRegistry.getAdapter("e27")).toBeDefined();
    expect(sourceRegistry.getAdapter("eustartups")).toBeDefined();
    expect(sourceRegistry.getAdapter("siliconcanals")).toBeDefined();
    expect(sourceRegistry.getAdapter("lobsters")).toBeDefined();
    expect(sourceRegistry.getAdapter("techcrunch")).toBeDefined();
  });

  it("returns zero items cleanly when external API is unreachable or unconfigured", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const mockFetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("fetch failed"));

    const result = await runAdapterIngestion(adapter);
    expect(result.totalIngested).toBe(0);
    expect(result.signals.length).toBe(0);

    mockFetch.mockRestore();
  });

  it("successfully ingests and sanitizes real API responses when available", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          {
            objectID: "99991234",
            title: "Ask HN: How do you handle multi-cloud secret rotation?",
            story_text: "Our team struggles with synchronizing KMS keys across AWS and GCP securely.",
            author: "cloud_eng",
            created_at: "2026-09-15T12:00:00Z",
            points: 55,
            num_comments: 23,
          },
        ],
      }),
    } as any);

    const result = await runAdapterIngestion(adapter);
    expect(result.totalIngested).toBe(1);
    expect(result.signals[0]?.externalId).toBe("hn-99991234");
    expect(result.signals[0]?.canonicalUrl).toBe("https://news.ycombinator.com/item?id=99991234");
    expect(result.signals[0]?.sanitizedExcerpt).toBeDefined();
    expect(result.signals[0]?.contentHash).toBeDefined();

    mockFetch.mockRestore();
  });

  describe("KrASIA RSS Adapter", () => {
    it("parses RSS feed XML, extracts Asian market metadata, and caps excerpt to 280 chars", async () => {
      const adapter = new KrAsiaAdapter();
      expect(adapter.sourceKey).toBe("krasia");
      expect(adapter.adapterType).toBe("KRASIA_RSS");
      expect(adapter.accessMethod).toBe("RSS");

      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>KrASIA</title>
  <item>
    <title><![CDATA[Singapore fintech unicorn expands cross-border B2B settlement]]></title>
    <link>https://kr-asia.com/singapore-fintech-unicorn-expands-cross-border-b2b-settlement</link>
    <guid>https://kr-asia.com/?p=164999</guid>
    <pubDate>Thu, 17 Sep 2026 08:30:00 +0000</pubDate>
    <dc:creator><![CDATA[Nikkei Asia]]></dc:creator>
    <description><![CDATA[The Singapore-headquartered digital payments infrastructure provider has launched automated real-time reconciliation across ASEAN currencies to eliminate cross-border friction for enterprise merchants.]]></description>
  </item>
</channel>
</rss>`;

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: async () => mockXml,
      } as any);

      const signals = await adapter.fetchSignals();
      expect(signals.length).toBe(1);

      const sig = signals[0];
      expect(sig.externalId).toBe("krasia-singapore-fintech-unicorn-expands-cross-border-b2b-settlement");
      expect(sig.sourceUrl).toBe("https://kr-asia.com/singapore-fintech-unicorn-expands-cross-border-b2b-settlement");
      expect(sig.title).toBe("Singapore fintech unicorn expands cross-border B2B settlement");
      expect(sig.rawContent.length).toBeLessThanOrEqual(280);
      expect(sig.authorFingerprint).toBe("Nikkei Asia");
      expect(sig.metadata?.market).toBe("Asia / Pan-Asia");
      expect(sig.metadata?.countryFocus).toBe("Southeast Asia");
      expect(sig.metadata?.language).toBe("en");
      expect(sig.metadata?.isSyndicated).toBe(true);
      expect(sig.metadata?.syndicationPartner).toBe("Nikkei Asia");
      expect(sig.metadata?.evidenceCategory).toBe("DISCOVERY");

      mockFetch.mockRestore();
    });

    it("deduplicates syndicated stories by attributing independence to the syndication partner", () => {
      const key1 = deriveIndependenceKey(
        "krasia",
        "krasia-article-1",
        "https://kr-asia.com/article-1",
        "Nikkei Asia",
        { syndicationPartner: "Nikkei Asia" },
      );

      const key2 = deriveIndependenceKey(
        "krasia",
        "krasia-article-2",
        "https://kr-asia.com/article-2",
        "Nikkei Asia",
        { syndicationPartner: "Nikkei Asia" },
      );

      expect(key1.key).toBe("syndication:nikkei-asia");
      expect(key2.key).toBe("syndication:nikkei-asia");
      expect(key1.method).toBe("SYNDICATION_PARTNER");
    });
  });

  describe("e27 Adapter (Access Verification & Restriction Handling)", () => {
    it("reports disabled status with documented Cloudflare 403 challenge blockers", () => {
      const adapter = new E27Adapter();
      expect(adapter.sourceKey).toBe("e27");
      expect(adapter.adapterType).toBe("E27_API");
      const health = adapter.getHealth();
      expect(health.isEnabled).toBe(false);
      expect(health.errorMessage).toContain("Cloudflare 403 challenge");
    });

    it("returns zero items cleanly without fabricating mock data when access is restricted", async () => {
      const adapter = new E27Adapter();
      const signals = await adapter.fetchSignals();
      expect(signals.length).toBe(0);
    });
  });

  describe("EU-Startups Adapter (Access Verification & Restriction Handling)", () => {
    it("reports disabled status with documented Cloudflare 403 challenge blockers", () => {
      const adapter = sourceRegistry.getAdapter("eustartups");
      expect(adapter).toBeDefined();
      expect(adapter?.sourceKey).toBe("eustartups");
      expect(adapter?.adapterType).toBe("GENERIC_RSS");
      const health = adapter?.getHealth();
      expect(health?.isEnabled).toBe(false);
      expect(health?.errorMessage).toContain("Cloudflare HTTP/2 403 challenge");
    });

    it("returns zero items cleanly without fabricating mock data when access is restricted", async () => {
      const adapter = sourceRegistry.getAdapter("eustartups");
      expect(adapter).toBeDefined();
      const signals = await adapter!.fetchSignals();
      expect(signals.length).toBe(0);
    });
  });

  describe("Silicon Canals RSS Adapter (Europe)", () => {
    it("parses RSS XML, assigns Europe market, and enforces 280-char sanitized excerpts", async () => {
      const adapter = sourceRegistry.getAdapter("siliconcanals");
      expect(adapter).toBeDefined();

      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Silicon Canals</title>
  <item>
    <title><![CDATA[Amsterdam AI compliance startup secures €3M to automate EU AI Act audits]]></title>
    <link>https://siliconcanals.com/amsterdam-ai-compliance-startup-secures-funding/</link>
    <guid>https://siliconcanals.com/?p=9821</guid>
    <pubDate>Mon, 21 Sep 2026 11:00:00 +0000</pubDate>
    <dc:creator><![CDATA[Editorial Team]]></dc:creator>
    <description><![CDATA[The Netherlands-based regulatory automation firm has developed continuous model monitoring tools to assist enterprise compliance teams with forthcoming European risk assessments.]]></description>
  </item>
</channel>
</rss>`;

      const mockSafeFetch = vi.spyOn(safeFetchModule, "safeFetch").mockResolvedValueOnce({
        status: 200,
        headers: { "content-type": "application/rss+xml" },
        data: mockXml,
        finalUrl: "https://siliconcanals.com/feed/",
        pinnedIp: "104.26.14.7",
      });

      const signals = await adapter!.fetchSignals();
      expect(signals.length).toBe(1);
      const sig = signals[0];
      expect(sig.sourceKey).toBe("siliconcanals");
      expect(sig.sourceUrl).toBe("https://siliconcanals.com/amsterdam-ai-compliance-startup-secures-funding/");
      expect(sig.title).toContain("Amsterdam AI compliance startup");
      expect(sig.rawContent.length).toBeLessThanOrEqual(280);
      expect(sig.metadata?.market).toBe("Europe");
      expect(sig.metadata?.sourceFamily).toBe("DISCOVERY");

      mockSafeFetch.mockRestore();
    });
  });

  describe("Lobsters RSS Adapter (Global Developer Community)", () => {
    it("models as COMMUNITY and separates discussion URL from external article link", async () => {
      const adapter = sourceRegistry.getAdapter("lobsters");
      expect(adapter).toBeDefined();

      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Lobsters</title>
  <item>
    <title><![CDATA[Database connection pool exhaustion under serverless spiky workloads]]></title>
    <link>https://example-eng-blog.com/serverless-db-pool-exhaustion</link>
    <guid>https://lobste.rs/s/abc123/database_connection_pool_exhaustion</guid>
    <comments>https://lobste.rs/s/abc123/database_connection_pool_exhaustion#comments</comments>
    <pubDate>Sun, 20 Sep 2026 14:00:00 +0000</pubDate>
    <author>infra_dev</author>
    <description><![CDATA[Detailed analysis of how lambda concurrency spikes overwhelm RDS postgres connection pools without proxy layers.]]></description>
  </item>
</channel>
</rss>`;

      const mockSafeFetch = vi.spyOn(safeFetchModule, "safeFetch").mockResolvedValueOnce({
        status: 200,
        headers: { "content-type": "application/rss+xml" },
        data: mockXml,
        finalUrl: "https://lobste.rs/rss",
        pinnedIp: "104.21.32.1",
      });

      const signals = await adapter!.fetchSignals();
      expect(signals.length).toBe(1);
      const sig = signals[0];
      expect(sig.sourceKey).toBe("lobsters");
      expect(sig.sourceUrl).toBe("https://example-eng-blog.com/serverless-db-pool-exhaustion");
      expect(sig.metadata?.discussionUrl).toBe("https://lobste.rs/s/abc123/database_connection_pool_exhaustion");
      expect(sig.metadata?.externalArticleUrl).toBe("https://example-eng-blog.com/serverless-db-pool-exhaustion");
      expect(sig.metadata?.sourceFamily).toBe("COMMUNITY");
      expect(sig.metadata?.market).toBe("Global / Developer Ecosystem");

      mockSafeFetch.mockRestore();
    });
  });

  describe("TechCrunch Adapter (REVIEW_REQUIRED status)", () => {
    it("reports disabled status under REVIEW_REQUIRED pending RSS compliance review", () => {
      const adapter = sourceRegistry.getAdapter("techcrunch");
      expect(adapter).toBeDefined();
      const health = adapter!.getHealth();
      expect(health.isEnabled).toBe(false);
      expect(health.policyStatus).toBe("REVIEW_REQUIRED");
      expect(health.errorMessage).toContain("compliance confirmation");
    });

    it("returns zero items cleanly without fabricating fallback items", async () => {
      const adapter = sourceRegistry.getAdapter("techcrunch");
      const signals = await adapter!.fetchSignals();
      expect(signals.length).toBe(0);
    });
  });
});
