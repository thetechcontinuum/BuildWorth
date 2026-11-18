import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

const PROBLEM_KEYWORDS_RE =
  /\b(workaround|migration|migrating|bottleneck|oom|memory leak|latency|cost|expensive|outage|incident|debugging|failing|timeout|replaced|alternative|scaling|slow|broken)\b/i;

function mapQueryToDevToTag(query: string): string {
  const q = query.toLowerCase();
  if (/\b(kubernetes|k8s|pod|oom|oomkilled|argocd|helm)\b/.test(q)) return "kubernetes";
  if (/\b(aws|egress|lambda|s3|iam|eks)\b/.test(q)) return "aws";
  if (/\b(cloud|finops|terraform|snowflake)\b/.test(q)) return "cloud";
  if (/\b(database|postgres|postgresql|clickhouse|sql|kafka|vector)\b/.test(q)) return "database";
  if (/\b(ai|llm|prompt|rag|agent|vllm|gpu|cuda|langchain)\b/.test(q)) return "ai";
  if (/\b(security|soc2|compliance|cve|vuln)\b/.test(q)) return "security";
  if (/\b(docker|container)\b/.test(q)) return "docker";
  if (/\b(datadog|prometheus|opentelemetry|monitoring|observability)\b/.test(q)) return "monitoring";
  if (/\b(performance|latency|memory|rust|slow)\b/.test(q)) return "performance";
  return "devops";
}

export class DevToAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "devto";
  public readonly name = "DEV Community Engineering";
  public readonly adapterType = "DEVTO_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Official public Forem / DEV.to REST API (https://dev.to/api/articles). Captures practitioner post-mortems, migration guides, and production tooling workarounds.";
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
    const tag = mapQueryToDevToTag(query);

    logger.info(`Fetching DEV.to articles (tag ${tag}, limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`);

    try {
      const perPage = Math.min(limit * 2, 30);
      const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}&page=${page}&top=30`;
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
      if (!Array.isArray(json)) {
        return [];
      }

      const validArticles = json.filter(
        (item: any) => item && item.id && item.title && (item.canonical_url || item.url),
      );

      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3);

      let selected = validArticles;
      if (query && options.searchType === "HISTORICAL_CORROBORATION") {
        selected = validArticles.filter((item: any) => {
          const tagsStr = Array.isArray(item.tag_list) ? item.tag_list.join(" ") : String(item.tags || "");
          const haystack = `${item.title || ""} ${item.description || ""} ${tagsStr}`.toLowerCase();
          return queryTerms.length > 0 ? queryTerms.some((t) => haystack.includes(t)) : haystack.includes(query.toLowerCase());
        });
      } else {
        const matched = validArticles.filter((item: any) => {
          const tagsStr = Array.isArray(item.tag_list) ? item.tag_list.join(" ") : String(item.tags || "");
          const haystack = `${item.title || ""} ${item.description || ""} ${tagsStr}`;
          const lowerHaystack = haystack.toLowerCase();
          const matchesQuery =
            queryTerms.length > 0 && queryTerms.some((t) => lowerHaystack.includes(t));
          const matchesProblem = PROBLEM_KEYWORDS_RE.test(haystack);
          return matchesQuery || matchesProblem;
        });
        if (matched.length > 0) {
          selected = matched;
        }
      }

      return selected.slice(0, limit).map((item: any) => {
        const titleStr = String(item.title || "").trim();
        const descStr = String(item.description || "").trim();
        const combined =
          descStr && !descStr.toLowerCase().startsWith(titleStr.toLowerCase().slice(0, 20))
            ? `${titleStr} — ${descStr}`
            : titleStr;
        const pubRaw = item.published_timestamp || item.published_at;
        const pubDate = pubRaw ? new Date(pubRaw) : new Date();

        return {
          externalId: `devto-${item.id}`,
          sourceKey: this.sourceKey,
          sourceUrl: String(item.canonical_url || item.url),
          authorFingerprint: String(item.user?.username || "devto_user"),
          title: titleStr.slice(0, 150),
          rawContent: combined.replace(/\s+/g, " ").trim().slice(0, 280),
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          metadata: {
            tag,
            tags: item.tag_list || item.tags,
            positiveReactionsCount: item.positive_reactions_count || 0,
            commentsCount: item.comments_count || 0,
          },
        };
      });
    } catch (err: any) {
      logger.warn("Live DEV.to fetch failed or unreachable", { error: err?.message });
      return [];
    }
  }
}
