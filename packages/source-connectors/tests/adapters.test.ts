import { describe, it, expect, vi } from "vitest";
import { sourceRegistry } from "../src/registry.js";
import { runAdapterIngestion } from "../src/runner.js";
import { KrAsiaAdapter } from "../src/adapters/krasia.js";
import { E27Adapter } from "../src/adapters/e27.js";
import { deriveIndependenceKey } from "../src/sanitizer.js";
import * as safeFetchModule from "../src/safe-fetch.js";

describe("Source Registry & Adapters", () => {
  it("has 15 registered adapters by default including procurement, security, research, and developer sources", () => {
    const adapters = sourceRegistry.getAllAdapters();
    expect(adapters.length).toBe(15);
    expect(sourceRegistry.getAdapter("krasia")).toBeDefined();
    expect(sourceRegistry.getAdapter("e27")).toBeDefined();
    expect(sourceRegistry.getAdapter("eustartups")).toBeDefined();
    expect(sourceRegistry.getAdapter("siliconcanals")).toBeDefined();
    expect(sourceRegistry.getAdapter("lobsters")).toBeDefined();
    expect(sourceRegistry.getAdapter("techcrunch")).toBeDefined();
    expect(sourceRegistry.getAdapter("ted")).toBeDefined();
    expect(sourceRegistry.getAdapter("samgov")).toBeDefined();
    expect(sourceRegistry.getAdapter("stackexchange")).toBeDefined();
    expect(sourceRegistry.getAdapter("cisakev")).toBeDefined();
    expect(sourceRegistry.getAdapter("arxiv")).toBeDefined();
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

  it("uses search_by_date endpoint for both generic and query-based searches", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const requestedUrls: string[] = [];
    const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        json: async () => ({ hits: [] }),
      } as any;
    });

    // Generic fetch
    await adapter.fetchSignals({ limit: 10, page: 0 });
    expect(requestedUrls[0]).toContain("https://hn.algolia.com/api/v1/search_by_date?tags=story");

    // Query fetch
    await adapter.fetchSignals({ limit: 5, query: "kubernetes monitoring", page: 1 });
    expect(requestedUrls[1]).toContain("https://hn.algolia.com/api/v1/search_by_date?query=kubernetes%20monitoring");
    expect(requestedUrls[1]).not.toContain("/api/v1/search?");

    mockFetch.mockRestore();
  });

  it("HackerNewsAdapter queries for newer signals using created_at_i> timestamp when checkpoint or since is provided", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const requestedUrls: string[] = [];
    const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        json: async () => ({ hits: [] }),
      } as any;
    });

    const checkpointTs = "1727654400";
    await adapter.fetchSignals({ limit: 10, checkpoint: checkpointTs });
    expect(requestedUrls[0]).toContain(`numericFilters=created_at_i>${checkpointTs}`);
    expect(requestedUrls[0]).not.toContain("numericFilters=created_at_i<");

    // With Date since
    const sinceDate = new Date("2026-09-29T12:00:00Z");
    const expectedTs = Math.floor(sinceDate.getTime() / 1000);
    await adapter.fetchSignals({ limit: 5, since: sinceDate });
    expect(requestedUrls[1]).toContain(`numericFilters=created_at_i>${expectedTs}`);

    mockFetch.mockRestore();
  });

  it("GitHubIssuesAdapter queries for newer issues using updated:> when checkpoint or since is provided", async () => {
    const adapter = sourceRegistry.getAdapter("github");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const requestedUrls: string[] = [];
    const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        json: async () => ({ items: [] }),
      } as any;
    });

    const checkpointIso = "2026-09-29T10:00:00.000Z";
    await adapter.fetchSignals({ limit: 10, checkpoint: checkpointIso });
    expect(requestedUrls[0]).toContain(encodeURIComponent(`updated:>${checkpointIso}`));
    expect(requestedUrls[0]).not.toContain(encodeURIComponent(`updated:<${checkpointIso}`));

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

  describe("TED Europa Tenders Adapter", () => {
    it("fetches and parses European tender notices from TED search API", async () => {
      const adapter = sourceRegistry.getAdapter("ted");
      expect(adapter).toBeDefined();

      const mockResponse = {
        notices: [
          {
            "notice-identifier": "notice-12345",
            "publication-number": "600123-2026",
            "publication-date": "2026-09-25+02:00",
            links: {
              html: { ENG: "https://ted.europa.eu/en/notice/-/detail/600123-2026" },
            },
            "notice-title": {
              eng: "Cloud Infrastructure and Security Monitoring Services for Public Agency",
            },
            "title-lot": {
              eng: ["Lot 1: Managed SIEM & SOC Monitoring", "Lot 2: Multi-Cloud Infrastructure Hosting"],
            },
          },
        ],
      };

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const signals = await adapter!.fetchSignals({ limit: 5 });
      expect(signals.length).toBe(1);
      expect(signals[0].externalId).toBe("ted-600123-2026");
      expect(signals[0].sourceKey).toBe("ted");
      expect(signals[0].sourceUrl).toBe("https://ted.europa.eu/en/notice/-/detail/600123-2026");
      expect(signals[0].title).toContain("Cloud Infrastructure");
      expect(signals[0].rawContent).toContain("Notice 600123-2026");
      expect(signals[0].rawContent).toContain("Lots/Scope: Lot 1: Managed SIEM & SOC Monitoring; Lot 2: Multi-Cloud Infrastructure Hosting");
      expect(signals[0].rawContent).toContain("Publication date: 2026-09-25+02:00");

      mockFetch.mockRestore();
    });
  });

  describe("SAM.gov Federal Contracting Adapter", () => {
    it("returns empty array cleanly when SAM_GOV_API_KEY is not set", async () => {
      const oldKey = process.env.SAM_GOV_API_KEY;
      delete process.env.SAM_GOV_API_KEY;

      const adapter = sourceRegistry.getAdapter("samgov");
      expect(adapter).toBeDefined();

      const signals = await adapter!.fetchSignals();
      expect(signals.length).toBe(0);

      if (oldKey) process.env.SAM_GOV_API_KEY = oldKey;
    });

    it("parses federal contracting solicitations when API key is provided", async () => {
      process.env.SAM_GOV_API_KEY = "test_key";
      const adapter = sourceRegistry.getAdapter("samgov");
      expect(adapter).toBeDefined();

      const mockResponse = {
        opportunitiesData: [
          {
            noticeId: "sol-9988",
            title: "Zero Trust Architecture Assessment Solicitation",
            description: "Agency requires vendor to implement automated identity verification.",
            department: "Department of Transportation",
            uiLink: "https://sam.gov/opp/sol-9988/view",
            postedDate: "2026-09-28",
          },
        ],
      };

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const signals = await adapter!.fetchSignals({ limit: 5 });
      expect(signals.length).toBe(1);
      expect(signals[0].externalId).toBe("samgov-sol-9988");
      expect(signals[0].title).toBe("Zero Trust Architecture Assessment Solicitation");
      expect(signals[0].sourceUrl).toBe("https://sam.gov/opp/sol-9988/view");

      mockFetch.mockRestore();
      delete process.env.SAM_GOV_API_KEY;
    });
  });

  describe("Stack Exchange Adapter", () => {
    it("parses developer questions with tags and canonical URL", async () => {
      const adapter = sourceRegistry.getAdapter("stackexchange");
      expect(adapter).toBeDefined();

      const mockResponse = {
        items: [
          {
            question_id: 887766,
            title: "Memory leak in nodejs worker threads when parsing large json payloads",
            creation_date: 1790900000,
            tags: ["node.js", "memory-leaks"],
            link: "https://stackoverflow.com/questions/887766/memory-leak-in-nodejs",
            owner: { display_name: "dev_alice" },
            score: 5,
            answer_count: 2,
            is_answered: true,
          },
        ],
      };

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const signals = await adapter!.fetchSignals({ limit: 5 });
      expect(signals.length).toBe(1);
      expect(signals[0].externalId).toBe("so-887766");
      expect(signals[0].sourceKey).toBe("stackexchange");
      expect(signals[0].sourceUrl).toBe("https://stackoverflow.com/questions/887766/memory-leak-in-nodejs");
      expect(signals[0].rawContent).toContain("[node.js, memory-leaks]");

      mockFetch.mockRestore();
    });
  });

  describe("CISA KEV Vulnerabilities Adapter", () => {
    it("fetches and parses known exploited vulnerabilities from CISA KEV catalog", async () => {
      const adapter = sourceRegistry.getAdapter("cisakev");
      expect(adapter).toBeDefined();

      const mockResponse = {
        count: 1,
        vulnerabilities: [
          {
            cveID: "CVE-2026-99999",
            vendorProject: "Acme Corp",
            product: "Acme Gateway",
            vulnerabilityName: "Authentication Bypass in Admin Portal",
            dateAdded: "2026-09-29",
            shortDescription: "Acme Gateway contains an authentication bypass flaw allowing arbitrary remote command execution.",
            dueDate: "2026-10-15",
          },
        ],
      };

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const signals = await adapter!.fetchSignals({ limit: 5 });
      expect(signals.length).toBe(1);
      expect(signals[0].externalId).toBe("cisa-CVE-2026-99999");
      expect(signals[0].sourceKey).toBe("cisakev");
      expect(signals[0].sourceUrl).toBe("https://nvd.nist.gov/vuln/detail/CVE-2026-99999");
      expect(signals[0].title).toContain("CVE-2026-99999: Acme Corp Acme Gateway");

      mockFetch.mockRestore();
    });
  });

  describe("arXiv Research Preprints Adapter", () => {
    it("fetches and parses scientific preprints from Atom XML feed", async () => {
      const adapter = sourceRegistry.getAdapter("arxiv");
      expect(adapter).toBeDefined();

      const mockAtomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2609.99887v1</id>
    <title>Efficient Speculative Decoding for Edge AI Accelerators</title>
    <summary>We propose a novel quantization-aware speculative decoding framework reducing inference latency by 45%.</summary>
    <published>2026-09-27T10:00:00Z</published>
    <link href="https://arxiv.org/abs/2609.99887v1" rel="alternate" type="text/html"/>
    <author><name>Dr. Jane Doe</name></author>
  </entry>
</feed>`;

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtomXml,
      } as any);

      const signals = await adapter!.fetchSignals({ limit: 5 });
      expect(signals.length).toBe(1);
      expect(signals[0].externalId).toBe("arxiv-2609.99887v1");
      expect(signals[0].sourceKey).toBe("arxiv");
      expect(signals[0].sourceUrl).toBe("https://arxiv.org/abs/2609.99887v1");
      expect(signals[0].title).toBe("Efficient Speculative Decoding for Edge AI Accelerators");
      expect(signals[0].rawContent).toContain("speculative decoding");

      mockFetch.mockRestore();
    });
  });
});

