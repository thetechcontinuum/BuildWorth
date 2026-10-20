import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

function stripHnHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, " $1 ")
    .replace(/<code>([\s\S]*?)<\/code>/gi, " $1 ")
    .replace(/<p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const rawPage = options.page ?? 0;
    // Algolia search API is 0-indexed (page 0 = hits 0-19). If caller provides 1-indexed page (e.g. 1), map to 0.
    const page = rawPage > 0 ? rawPage - 1 : 0;

    logger.info(`Fetching HN market signals (limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`);
    try {
      let url = "";
      const tagsParam = query && query.trim().length > 0 ? "tags=(story,comment)" : "tags=story";
      if (query && query.trim().length > 0) {
        // Algolia treats multi-word queries as strict boolean AND; clean boolean noise and cap at 2-3 significant words
        const cleanedQuery = query
          .trim()
          .replace(/\b(OR|AND|NOT)\b/gi, " ")
          .replace(/["()]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !["alternative", "alternatives"].includes(w.toLowerCase()))
          .slice(0, 3)
          .join(" ");
        const qParam = encodeURIComponent(cleanedQuery || query.trim());
        url = `https://hn.algolia.com/api/v1/search_by_date?query=${qParam}&${tagsParam}&hitsPerPage=${limit}&page=${page}`;
      } else {
        url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${limit}&page=${page}`;
      }

      if (options.since) {
        const ts = Math.floor(options.since.getTime() / 1000);
        if (!isNaN(ts) && ts > 0) {
          url += `&numericFilters=created_at_i>${ts}`;
        }
      } else if (options.checkpoint) {
        const ts = parseInt(options.checkpoint, 10);
        if (!isNaN(ts) && ts > 0) {
          url += `&numericFilters=created_at_i>${ts}`;
        }
      }

      const collectedHits: any[] = [];
      const res = await fetch(url, {
        headers: { "User-Agent": "BuildWorth-Staging/1.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const hits = json.hits || [];
        for (const h of hits) {
          if (h && h.objectID) {
            collectedHits.push(h);
          }
        }
      }

      // If strict date filter yielded 0 hits for a targeted practitioner query, fall back to recent search ONLY during historical corroboration
      if (collectedHits.length === 0 && url.includes("numericFilters=") && query && options.searchType === "HISTORICAL_CORROBORATION") {
        const fbUrl = url.replace(/&numericFilters=[^&]+/, "");
        const fbRes = await fetch(fbUrl, {
          headers: { "User-Agent": "BuildWorth-Staging/1.0" },
        });
        if (fbRes.ok) {
          const fbJson = await fbRes.json();
          for (const h of fbJson.hits || []) {
            if (h && h.objectID) {
              collectedHits.push(h);
            }
          }
        }
      }

      if (collectedHits.length > 0) {
        return collectedHits
          .filter((h: any) => {
            if (!h.objectID || !(h.title || h.story_title || h.story_text || h.comment_text)) return false;
            const parentTitle = String(h.story_title || h.title || "").toLowerCase();
            if (
              parentTitle.includes("who is hiring") ||
              parentTitle.includes("who wants to be hired") ||
              parentTitle.includes("seeking freelancer") ||
              parentTitle.includes("ask hn: who is hiring")
            ) {
              return false;
            }
            return true;
          })
          .slice(0, limit)
          .map((h: any) => {
            const titleStr = stripHnHtml(h.title || h.story_title || "");
            const storyStr = stripHnHtml(h.story_text || "");
            const commentStr = stripHnHtml(h.comment_text || "");

            let rawContent = "";
            if (commentStr && commentStr.length >= 10) {
              rawContent = titleStr ? `${titleStr} — ${commentStr}` : commentStr;
            } else if (storyStr && storyStr.length >= 10) {
              rawContent = titleStr && !storyStr.toLowerCase().startsWith(titleStr.toLowerCase().slice(0, 20))
                ? `${titleStr} — ${storyStr}`
                : storyStr;
            } else {
              rawContent = titleStr;
            }

            const itemUrl = h.story_id
              ? `https://news.ycombinator.com/item?id=${h.objectID}`
              : (h.url || `https://news.ycombinator.com/item?id=${h.objectID}`);

            return {
              externalId: `hn-${h.objectID}`,
              sourceKey: this.sourceKey,
              sourceUrl: itemUrl,
              authorFingerprint: h.author || "hn_user",
              title: titleStr ? titleStr.slice(0, 150) : undefined,
              rawContent: rawContent.slice(0, 280),
              publishedAt: h.created_at ? new Date(h.created_at) : new Date(),
              metadata: {
                points: h.points || 0,
                commentsCount: h.num_comments || 0,
                createdAtI: h.created_at_i,
                storyId: h.story_id,
                page,
              },
            };
          });
      }
    } catch (err: any) {
      logger.warn("Live HN fetch failed or unconfigured", { error: err?.message });
    }

    return [];
  }
}

