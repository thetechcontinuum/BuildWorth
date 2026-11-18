import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export class RedditAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "reddit";
  public readonly name = "Reddit Tech & Ops";
  public readonly adapterType = "REDDIT_OAUTH" as const;
  public readonly accessMethod = "OAUTH_API" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Uses Reddit public subreddit search JSON & OAuth 2.0 API under developer terms. Excerpts limited to 280 chars with permalink citation.";
  public readonly attributionRequired = true;

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 15, 25);
    const query = (options.query || explicitQuery || "").trim();
    const effectiveQuery =
      query || "workaround OR expensive OR bottleneck OR outage OR migration OR timeout";

    logger.info(`Fetching Reddit signals from target communities (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      const subreddits = "devops+sre+kubernetes+dataengineering+aws+sysadmin+LocalLLaMA+PostgreSQL";
      const url = `https://www.reddit.com/r/${subreddits}/search.json?q=${encodeURIComponent(effectiveQuery)}&restrict_sr=1&sort=new&t=month&limit=${limit}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
          "Accept": "application/json",
        },
      });

      if (!res || !res.ok || typeof res.json !== "function") {
        return [];
      }

      const json = await res.json();
      const children = Array.isArray(json?.data?.children) ? json.data.children : [];

      return children
        .filter((child: any) => child?.data && !child.data.stickied && child.data.id && child.data.title)
        .slice(0, limit)
        .map((child: any) => {
          const post = child.data;
          const titleStr = String(post.title || "").trim();
          const bodyStr = String(post.selftext || "").trim();
          const combined = bodyStr ? `${titleStr} — ${bodyStr}` : titleStr;
          const sourceUrl = post.permalink
            ? `https://www.reddit.com${post.permalink}`
            : String(post.url || `https://www.reddit.com/comments/${post.id}`);

          return {
            externalId: `rd-${post.id}`,
            sourceKey: this.sourceKey,
            sourceUrl,
            authorFingerprint: String(post.author || "reddit_user"),
            title: titleStr.slice(0, 150),
            rawContent: combined.replace(/\s+/g, " ").trim().slice(0, 280),
            publishedAt: post.created_utc ? new Date(post.created_utc * 1000) : new Date(),
            metadata: {
              subreddit: post.subreddit,
              score: post.score || 0,
              numComments: post.num_comments || 0,
            },
          };
        });
    } catch (err: any) {
      logger.warn("Live Reddit fetch failed or unreachable", { error: err?.message });
      return [];
    }
  }
}
