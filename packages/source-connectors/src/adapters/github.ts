import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class GitHubIssuesAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "github";
  public readonly name = "GitHub Issues & Discussions";
  public readonly adapterType = "GITHUB_REST" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 80;
  public readonly termsNotes =
    "Uses GitHub REST/GraphQL API with Personal Access Tokens. Extracts publicly indexed repository problem issues.";
  public readonly attributionRequired = true;

  public async fetchSignals(limit = 20, query?: string): Promise<RawIngestSignal[]> {
    logger.info(`Fetching GitHub issues signals (limit ${limit}${query ? `, query: ${query}` : ""})...`);
    try {
      const q =
        query && query.trim().length > 0
          ? `is:public is:issue state:open ${query.trim()}`
          : `is:public is:issue state:open sort:updated`;

      const res = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 20)}`,
        {
          headers: { "User-Agent": "BuildWorth-Staging/1.0" },
        },
      );
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          return items
            .filter((item: any) => item.html_url && (item.title || item.body))
            .map((item: any) => ({
              externalId: `gh-${item.id}`,
              sourceKey: this.sourceKey,
              sourceUrl: item.html_url,
              authorFingerprint: item.user?.login || "gh_user",
              title: item.title ? String(item.title).slice(0, 150) : undefined,
              rawContent: String(item.body || item.title || "").slice(0, 280),
              publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
              metadata: { comments: item.comments || 0 },
            }));
        }
      }
    } catch (err: any) {
      logger.warn("Live GitHub fetch failed or unconfigured", { error: err?.message });
    }

    return [];
  }
}

