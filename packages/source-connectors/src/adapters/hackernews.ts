import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
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

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 20, 20);
    const query = options.query || explicitQuery;
    const page = options.page || 0;

    logger.info(`Fetching HN market signals (limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`);
    try {
      let url = "";
      if (query && query.trim().length > 0) {
        url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query.trim())}&tags=story&hitsPerPage=${limit}&page=${page}`;
      } else {
        url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${limit}&page=${page}`;
      }

      if (options.checkpoint) {
        const ts = parseInt(options.checkpoint, 10);
        if (!isNaN(ts) && ts > 0) {
          url += `&numericFilters=created_at_i<${ts}`;
        }
      }

      const res = await fetch(url, {
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
              metadata: {
                points: h.points || 0,
                commentsCount: h.num_comments || 0,
                createdAtI: h.created_at_i,
                page,
              },
            }));
        }
      }
    } catch (err: any) {
      logger.warn("Live HN fetch failed or unconfigured", { error: err?.message });
    }

    return [];
  }
}

