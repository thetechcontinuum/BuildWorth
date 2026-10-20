import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

function stripSeHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, " $1 ")
    .replace(/<code>([\s\S]*?)<\/code>/gi, " $1 ")
    .replace(/<p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class StackExchangeAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "stackexchange";
  public readonly name = "Stack Exchange & Stack Overflow";
  public readonly adapterType = "STACKEXCHANGE_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Official Stack Exchange REST API v2.3. CC BY-SA 4.0 license with attribution required. Captures recurring technical problems, workarounds, and tool failures.";
  public readonly attributionRequired = true;

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 10, 20);
    const query = (options.query || explicitQuery || "").trim();

    logger.info(`Fetching Stack Exchange technical questions (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      let fromDateSec: number;
      if (options.since && !isNaN(options.since.getTime())) {
        fromDateSec = Math.floor(options.since.getTime() / 1000);
      } else if (options.checkpoint) {
        const cpNum = parseInt(options.checkpoint, 10);
        if (!isNaN(cpNum) && cpNum > 0) {
          fromDateSec = cpNum > 2000000000 ? Math.floor(cpNum / 1000) : cpNum;
        } else {
          const cpDate = new Date(options.checkpoint);
          fromDateSec = !isNaN(cpDate.getTime()) ? Math.floor(cpDate.getTime() / 1000) : Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
        }
      } else {
        fromDateSec = Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
      }

      // Guard against future timestamps blocking relevant questions
      const nowSec = Math.floor(Date.now() / 1000);
      if (fromDateSec > nowSec) {
        fromDateSec = nowSec - 86400 * 7;
      }

      const effectiveQuery = query || "workaround bottleneck timeout memory leak rate limit migration";
      const sortParam = query ? "relevance" : "votes";
      const page = options.page || 1;

      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=${sortParam}&fromdate=${fromDateSec}&q=${encodeURIComponent(effectiveQuery)}&site=stackoverflow&pagesize=${limit}&page=${page}&filter=withbody`;

      let res = await fetch(url, {
        headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
      });

      if (res.ok) {
        let json = await res.json();
        let items = json.items || [];
        if (items.length === 0 && fromDateSec > 0 && query && options.searchType === "HISTORICAL_CORROBORATION") {
          const fbUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(effectiveQuery)}&site=stackoverflow&pagesize=${limit}&page=${page}&filter=withbody`;
          const fbRes = await fetch(fbUrl, {
            headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
          });
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            items = fbJson.items || [];
          }
        }
        return items
          .filter((q: any) => q.question_id && q.title)
          .map((q: any) => {
            const titleClean = stripSeHtml(q.title);
            const bodyClean = stripSeHtml(q.body || "");
            const tags = Array.isArray(q.tags) ? q.tags.join(", ") : "";

            let rawContent = "";
            if (bodyClean && bodyClean.length >= 15) {
              rawContent = `${titleClean} — ${bodyClean}`;
            } else if (tags) {
              rawContent = `[${tags}] ${titleClean}`;
            } else {
              rawContent = titleClean;
            }

            const publishedAt = q.creation_date ? new Date(q.creation_date * 1000) : new Date();

            return {
              externalId: `so-${q.question_id}`,
              sourceKey: this.sourceKey,
              sourceUrl: q.link || `https://stackoverflow.com/questions/${q.question_id}`,
              authorFingerprint: q.owner?.display_name || "stack_user",
              title: titleClean.slice(0, 150),
              rawContent: rawContent.slice(0, 280),
              publishedAt,
              metadata: {
                questionId: q.question_id,
                tags: q.tags,
                score: q.score || 0,
                answerCount: q.answer_count || 0,
                viewCount: q.view_count || 0,
                isAnswered: q.is_answered,
              },
            };
          });
      }
    } catch (err: any) {
      logger.warn("Live Stack Exchange fetch failed or unreachable", { error: err?.message });
    }

    return [];
  }
}
