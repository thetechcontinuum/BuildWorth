import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

const JOB_SPAM_RE =
  /\b(remotejobs|cloudjobs|devopsjobs|techjobs|we'?re hiring|now hiring|apply here|job opening|hiring alert|remote it systems administrator)\b/i;

const PROBLEM_KEYWORDS_RE =
  /\b(workaround|migration|migrating|bottleneck|oom|memory leak|latency|cost|expensive|outage|incident|debugging|failing|timeout|replaced|alternative|scaling|slow|broken|pain|friction|bug|crash)\b/i;

function stripMastodonHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapQueryToMastodonTag(query: string): string {
  const q = query.toLowerCase();
  if (/\b(kubernetes|k8s|oomkilled|argocd|helm)\b/.test(q)) return "kubernetes";
  if (/\b(terraform|iac|opentofu)\b/.test(q)) return "terraform";
  if (/\b(aws|egress|cloud)\b/.test(q)) return "aws";
  if (/\b(postgres|postgresql|database|sql|clickhouse|snowflake|kafka)\b/.test(q)) return "postgresql";
  if (/\b(prometheus|grafana|opentelemetry|datadog|monitoring|observability)\b/.test(q)) return "observability";
  if (/\b(vllm|llm|prompt|rag|agent|gpu|cuda|langchain|vector)\b/.test(q)) return "llm";
  if (/\b(security|soc2|compliance|cve)\b/.test(q)) return "infosec";
  if (/\b(docker|container)\b/.test(q)) return "docker";
  return "devops";
}

export class MastodonAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "mastodon";
  public readonly name = "Hachyderm Engineering Community";
  public readonly adapterType = "MASTODON_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official public Mastodon REST API via hachyderm.io public tag timelines. Captures practitioner DevOps, SRE, Cloud, and AI engineering pain signals.";
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
    const tag = mapQueryToMastodonTag(query);

    logger.info(
      `Fetching Hachyderm Mastodon signals (tag #${tag}, limit ${limit}${query ? `, query: ${query}` : ""})...`,
    );

    try {
      const fetchLimit = Math.min(limit * 2, 40);
      const url = `https://hachyderm.io/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${fetchLimit}`;
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
      if (!Array.isArray(json)) return [];

      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3);

      const cleanPosts = json
        .filter((item: any) => {
          if (!item || !item.id || !item.content) return false;
          if (item.account?.bot === true) return false;
          if (item.language && item.language !== "en") return false;
          const tagNames = Array.isArray(item.tags)
            ? item.tags.map((t: any) => String(t?.name || "").toLowerCase())
            : [];
          if (tagNames.some((t: string) => t.endsWith("jobs") || t === "hiring" || t === "jobsearch")) {
            return false;
          }
          const plain = stripMastodonHtml(item.content);
          if (plain.length < 25 || JOB_SPAM_RE.test(plain)) return false;
          return true;
        })
        .map((item: any) => ({
          item,
          plain: stripMastodonHtml(item.content),
        }));

      const problemPosts = cleanPosts.filter(({ plain }) => {
        const lower = plain.toLowerCase();
        const matchesQuery = queryTerms.length > 0 && queryTerms.some((t) => lower.includes(t));
        return matchesQuery || PROBLEM_KEYWORDS_RE.test(plain);
      });

      const selected =
        problemPosts.length > 0
          ? problemPosts
          : options.searchType === "HISTORICAL_CORROBORATION"
            ? []
            : cleanPosts;

      return selected.slice(0, limit).map(({ item, plain }) => {
        const firstSentence = plain.split(/(?<=[.!?])\s+/)[0] || plain;
        const titleStr = firstSentence.slice(0, 140).trim();
        const pubDate = item.created_at ? new Date(item.created_at) : new Date();

        return {
          externalId: `mastodon-${item.id}`,
          sourceKey: this.sourceKey,
          sourceUrl: String(item.url || item.uri || `https://hachyderm.io/@${item.account?.username || "user"}/${item.id}`),
          authorFingerprint: String(item.account?.acct || item.account?.username || "mastodon_user"),
          title: titleStr,
          rawContent: plain.slice(0, 280),
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          metadata: {
            instance: "hachyderm.io",
            tag,
            favouritesCount: item.favourites_count || 0,
            repliesCount: item.replies_count || 0,
            reblogsCount: item.reblogs_count || 0,
          },
        };
      });
    } catch (err: any) {
      logger.warn("Live Mastodon fetch failed or unreachable", { tag, error: err?.message });
      return [];
    }
  }
}
