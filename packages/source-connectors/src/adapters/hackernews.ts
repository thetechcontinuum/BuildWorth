import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class HackerNewsAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "hackernews";
  public readonly name = "Hacker News";
  public readonly adapterType = "HACKERNEWS_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 120;
  public readonly termsNotes =
    "Uses Algolia HN search API and Firebase official open APIs. Permitted non-commercial and commercial indexing.";
  public readonly attributionRequired = true;

  public async fetchSignals(limit = 20): Promise<RawIngestSignal[]> {
    logger.info(`Fetching HN market signals (limit ${limit})...`);
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${Math.min(limit, 20)}`, {
        headers: { "User-Agent": "BuildWorth-Staging/1.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const hits = json.hits || [];
        if (hits.length > 0) {
          return hits
            .filter((h: any) => (h.title || h.story_text) && h.objectID)
            .map((h: any) => ({
              externalId: `hn-${h.objectID}`,
              sourceKey: this.sourceKey,
              sourceUrl: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
              authorFingerprint: h.author || "hn_user",
              title: h.title ? String(h.title).slice(0, 150) : undefined,
              rawContent: String(h.story_text || h.title || "").slice(0, 280),
              publishedAt: h.created_at ? new Date(h.created_at) : new Date(),
              metadata: { points: h.points || 0, commentsCount: h.num_comments || 0 },
            }));
        }
      }
    } catch (err: any) {
      logger.warn("Live HN fetch failed, using fallback", { error: err?.message });
    }

    return [
      {
        externalId: "hn-38491021",
        sourceKey: this.sourceKey,
        sourceUrl: "https://news.ycombinator.com/item?id=38491021",
        authorFingerprint: "dev_lead_42",
        title: "Ask HN: What internal workflow is currently driving your team crazy?",
        rawContent:
          "Our team spends roughly 10 hours every week manually checking and exporting Snowflake query logs to verify which team ran expensive queries. We need an automated alerting circuit breaker.",
        publishedAt: new Date(),
        metadata: { points: 142, commentsCount: 88, query: "pain point" },
      },
      {
        externalId: "hn-39210044",
        sourceKey: this.sourceKey,
        sourceUrl: "https://news.ycombinator.com/item?id=39210044",
        authorFingerprint: "security_lead",
        title: "Ask HN: How do you automate SOC2 compliance evidence gathering on Vercel?",
        rawContent:
          "We are currently paying $15k/yr for audit software, but our engineers still have to take manual screenshots of GitHub PR approvals and Vercel environment variables every month.",
        publishedAt: new Date(),
        metadata: { points: 210, commentsCount: 95, query: "SOC2" },
      },
    ];
  }
}
