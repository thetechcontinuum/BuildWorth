import { describe, it, expect, vi } from "vitest";
import { sourceRegistry } from "../src/registry.js";
import { runAdapterIngestion } from "../src/runner.js";
import { KrAsiaAdapter } from "../src/adapters/krasia.js";
import { E27Adapter } from "../src/adapters/e27.js";
import { deriveIndependenceKey } from "../src/sanitizer.js";

describe("Source Registry & Adapters", () => {
  it("has 6 registered adapters by default including Asian discovery sources", () => {
    const adapters = sourceRegistry.getAllAdapters();
    expect(adapters.length).toBe(6);
    expect(sourceRegistry.getAdapter("krasia")).toBeDefined();
    expect(sourceRegistry.getAdapter("e27")).toBeDefined();
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
});
