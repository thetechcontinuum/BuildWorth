import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

const LEMMY_INSTANCES = ["lemmy.world", "programming.dev"];

export class LemmyAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "lemmy";
  public readonly name = "Lemmy Dev & Self-Hosted";
  public readonly adapterType = "LEMMY_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official public Lemmy v3 JSON search API (lemmy.world & programming.dev). Captures developer, self-hosted, and systems engineering operational pain and workarounds.";
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
    const page = options.page && options.page > 0 ? options.page : 1;
    const effectiveQuery = query || "kubernetes OR selfhosted OR backup OR monitoring";

    logger.info(
      `Fetching Lemmy developer signals (limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`,
    );

    for (const host of LEMMY_INSTANCES) {
      try {
        const url = `https://${host}/api/v3/search?q=${encodeURIComponent(effectiveQuery)}&type_=Posts&sort=New&limit=${limit}&page=${page}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "BuildWorth-Market-Intelligence/1.0",
            "Accept": "application/json",
          },
        });

        if (!res || !res.ok || typeof res.json !== "function") {
          continue;
        }

        const json = await res.json();
        const items = Array.isArray(json?.posts) ? json.posts : [];
        if (items.length === 0) continue;

        const signals: RawIngestSignal[] = [];
        for (const item of items) {
          const post = item?.post;
          if (!post || !post.id || !post.name || post.removed || post.deleted || post.nsfw) {
            continue;
          }

          const titleStr = String(post.name || "").replace(/\s+/g, " ").trim();
          const bodyStr = String(post.body || "").replace(/\s+/g, " ").trim();
          const combined =
            bodyStr && !bodyStr.toLowerCase().startsWith(titleStr.toLowerCase().slice(0, 20))
              ? `${titleStr} — ${bodyStr}`
              : titleStr;
          const sourceUrl = String(post.ap_id || post.url || `https://${host}/post/${post.id}`);
          const pubDate = post.published ? new Date(post.published) : new Date();

          signals.push({
            externalId: `lemmy-${post.id}`,
            sourceKey: this.sourceKey,
            sourceUrl,
            authorFingerprint: String(item?.creator?.name || "lemmy_user"),
            title: titleStr.slice(0, 150),
            rawContent: combined.slice(0, 280),
            publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
            metadata: {
              instance: host,
              community: item?.community?.name || "general",
              score: item?.counts?.score || 0,
              comments: item?.counts?.comments || 0,
            },
          });

          if (signals.length >= limit) break;
        }

        if (signals.length > 0) {
          return signals;
        }
      } catch (err: any) {
        logger.warn("Live Lemmy fetch failed or unreachable", { host, error: err?.message });
      }
    }

    return [];
  }
}
