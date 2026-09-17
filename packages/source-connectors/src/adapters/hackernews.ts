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
      logger.warn("Live HN fetch failed or unconfigured", { error: err?.message });
    }

    return [];
  }
}

