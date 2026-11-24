import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export interface DiscourseForumTarget {
  host: string;
  name: string;
}

export function selectDiscourseForum(query: string): DiscourseForumTarget {
  const q = query.toLowerCase();
  if (/\b(terraform|vault|nomad|consul|packer|state lock|hashicorp)\b/.test(q)) {
    return { host: "discuss.hashicorp.com", name: "HashiCorp Discuss" };
  }
  if (/\b(prometheus|grafana|opentelemetry|loki|tempo|cardinality|datadog|monitoring|observability)\b/.test(q)) {
    return { host: "community.grafana.com", name: "Grafana Community" };
  }
  if (/\b(cuda|pytorch|gpu memory|out of memory python)\b/.test(q)) {
    return { host: "discuss.pytorch.org", name: "PyTorch Forums" };
  }
  if (/\b(llm|vllm|rag|prompt|agent|langchain|token|context window|huggingface|vector|gpu)\b/.test(q)) {
    return { host: "discuss.huggingface.co", name: "Hugging Face Forums" };
  }
  return { host: "discuss.kubernetes.io", name: "Kubernetes Discuss" };
}

const NON_PROBLEM_TOPIC_RE = /\b(exam prep|study plan|certification|certified:|associate \(\d+\)|practice test)\b/i;

export class DiscourseAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "discourse";
  public readonly name = "Engineering Discourse Forums";
  public readonly adapterType = "DISCOURSE_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official public Discourse /search.json API across Kubernetes, HashiCorp, Grafana, PyTorch, and Hugging Face engineering forums. Captures practitioner production failures, cost spikes, and operational workarounds.";
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
    const forum = selectDiscourseForum(query);
    const effectiveQuery = query || "workaround timeout memory leak";

    logger.info(
      `Fetching Discourse signals from ${forum.host} (limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`,
    );

    try {
      const searchQ = `${effectiveQuery} order:latest`;
      const url = `https://${forum.host}/search.json?q=${encodeURIComponent(searchQ)}&page=${page}`;
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
      const posts = Array.isArray(json?.posts) ? json.posts : [];
      const topics = Array.isArray(json?.topics) ? json.topics : [];

      const topicMap = new Map<number, any>();
      for (const topic of topics) {
        if (topic && typeof topic.id === "number") {
          topicMap.set(topic.id, topic);
        }
      }

      const seenTopicIds = new Set<number>();
      const signals: RawIngestSignal[] = [];
      const forumPrefix = forum.host.split(".")[1] || "discourse";

      for (const post of posts) {
        if (!post || (!post.topic_id && !post.id)) continue;
        const topicId = typeof post.topic_id === "number" ? post.topic_id : post.id;
        if (seenTopicIds.has(topicId)) continue;
        seenTopicIds.add(topicId);

        const topic = topicMap.get(topicId);
        const titleStr = String(topic?.title || topic?.fancy_title || post.blurb || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const blurbStr = String(post.blurb || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (!titleStr) continue;
        if (NON_PROBLEM_TOPIC_RE.test(`${titleStr} ${blurbStr}`)) continue;

        const slugPart = topic?.slug ? `${topic.slug}/${topicId}` : String(topicId);
        const sourceUrl = `https://${forum.host}/t/${slugPart}`;
        const combined =
          blurbStr && !blurbStr.toLowerCase().startsWith(titleStr.toLowerCase().slice(0, 20))
            ? `${titleStr} — ${blurbStr}`
            : titleStr;
        const pubRaw = post.created_at || topic?.created_at;
        const pubDate = pubRaw ? new Date(pubRaw) : new Date();

        signals.push({
          externalId: `discourse-${forumPrefix}-${topicId}`,
          sourceKey: this.sourceKey,
          sourceUrl,
          authorFingerprint: String(post.username || "discourse_user"),
          title: titleStr.slice(0, 150),
          rawContent: combined.slice(0, 280),
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          metadata: {
            forumHost: forum.host,
            forumName: forum.name,
            topicId,
            postNumber: post.post_number || 1,
            likeCount: post.like_count || 0,
            replyCount: topic?.reply_count || 0,
          },
        });

        if (signals.length >= limit) break;
      }

      return signals;
    } catch (err: any) {
      logger.warn("Live Discourse fetch failed or unreachable", {
        forum: forum.host,
        error: err?.message,
      });
      return [];
    }
  }
}
