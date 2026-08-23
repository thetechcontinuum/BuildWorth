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
    // Sample deterministic signals when offline or mocking
    return [
      {
        externalId: "hn-38491021",
        sourceKey: this.sourceKey,
        sourceUrl: "https://news.ycombinator.com/item?id=38491021",
        authorFingerprint: "dev_lead_42",
        title: "Ask HN: What internal workflow is currently driving your team crazy?",
        rawContent:
          "Our team spends roughly 10 hours every week manually checking and exporting Snowflake query logs to verify which team ran expensive queries. We need an automated alerting circuit breaker.",
        publishedAt: new Date(),
        metadata: { points: 142, commentsCount: 88, query: "pain point" },
      },
      {
        externalId: "hn-39210044",
        sourceKey: this.sourceKey,
        sourceUrl: "https://news.ycombinator.com/item?id=39210044",
        authorFingerprint: "security_lead",
        title: "Ask HN: How do you automate SOC2 compliance evidence gathering on Vercel?",
        rawContent:
          "We are currently paying $15k/yr for audit software, but our engineers still have to take manual screenshots of GitHub PR approvals and Vercel environment variables every month.",
        publishedAt: new Date(),
        metadata: { points: 210, commentsCount: 95, query: "SOC2" },
      },
    ];
  }
}
