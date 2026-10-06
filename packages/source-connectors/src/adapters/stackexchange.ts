import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

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
      let url = "";
      // Calculate 90 days ago epoch seconds to guard against questions from 2019/stale years being ingested on background activity
      const ninetyDaysAgoSec = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

      if (query) {
        url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&fromdate=${ninetyDaysAgoSec}&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=${limit}&filter=default`;
      } else {
        url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&fromdate=${ninetyDaysAgoSec}&site=stackoverflow&pagesize=${limit}&filter=default`;
      }

      const res = await fetch(url, {
        headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
      });

      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        return items
          .filter((q: any) => q.question_id && q.title)
          .map((q: any) => {
            const tags = Array.isArray(q.tags) ? q.tags.join(", ") : "";
            const rawContent = tags ? `[${tags}] ${q.title}` : q.title;
            const publishedAt = q.creation_date ? new Date(q.creation_date * 1000) : new Date();

            return {
              externalId: `so-${q.question_id}`,
              sourceKey: this.sourceKey,
              sourceUrl: q.link || `https://stackoverflow.com/questions/${q.question_id}`,
              authorFingerprint: q.owner?.display_name || "stack_user",
              title: String(q.title).slice(0, 150),
              rawContent: String(rawContent).slice(0, 280),
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
