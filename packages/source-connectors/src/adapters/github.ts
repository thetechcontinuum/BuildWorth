import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
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
    const page = options.page || 1;

    logger.info(`Fetching GitHub issues signals (limit ${limit}, page ${page}${query ? `, query: ${query}` : ""})...`);
    try {
      const defaultProblemQuery =
        '("workaround" OR "bottleneck" OR "manual process" OR "memory leak" OR "rate limit" OR "timeout" OR "cost spike" OR "migration")';
      let q =
        query && query.trim().length > 0
          ? `is:public is:issue state:open ${query.trim()}`
          : `is:public is:issue state:open ${defaultProblemQuery} sort:updated`;

      if (options.since) {
        q += ` updated:>${options.since.toISOString()}`;
      } else if (options.checkpoint) {
        const cpDate = new Date(options.checkpoint);
        if (!isNaN(cpDate.getTime())) {
          q += ` updated:>${cpDate.toISOString()}`;
        }
      }

      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      const headers: Record<string, string> = {
        "User-Agent": "BuildWorth-Market-Intelligence/1.0",
        "Accept": "application/vnd.github.v3+json",
      };
      if (token && token.trim().length > 0) {
        headers["Authorization"] = `Bearer ${token.trim()}`;
      }

      const res = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${limit}&page=${page}`,
        { headers },
      );
      if (res.status === 403 || res.status === 429) {
        logger.warn("GitHub search rate limited or requires authentication", { status: res.status });
        return [];
      }
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          const isBotOrChoreIssue = (item: any): boolean => {
            const login = String(item.user?.login || "").toLowerCase();
            if (login.endsWith("[bot]") || login === "dependabot" || login === "renovate" || login === "github-actions") {
              return true;
            }
            const combined = `${item.title || ""} ${item.body || ""}`;
            if (
              /\bready-for-agent\b/i.test(combined) ||
              /:robot:\s*_?ai text below/i.test(combined) ||
              /\bParent:\s*#\d+/i.test(combined) ||
              /\bEpic\s*#\d+/i.test(combined) ||
              /\bCreate a branch and open a PR\b/i.test(combined)
            ) {
              return true;
            }
            return false;
          };

          const validItems = items.filter(
            (item: any) => item.html_url && (item.title || item.body) && !isBotOrChoreIssue(item),
          );

          return validItems.map((item: any) => {
            const titleStr = item.title ? String(item.title).trim() : "";
            const bodyStr = item.body ? String(item.body).trim() : "";
            const combinedContent =
              titleStr && bodyStr && !bodyStr.toLowerCase().startsWith(titleStr.toLowerCase().slice(0, 20))
                ? `${titleStr} — ${bodyStr}`
                : String(bodyStr || titleStr || "");

            return {
              externalId: `gh-${item.id}`,
              sourceKey: this.sourceKey,
              sourceUrl: item.html_url,
              authorFingerprint: item.user?.login || "gh_user",
              title: titleStr ? titleStr.slice(0, 150) : undefined,
              rawContent: combinedContent.slice(0, 280),
              publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
              metadata: {
                comments: item.comments || 0,
                updatedAt: item.updated_at,
                page,
              },
            };
          });
        }
      }
    } catch (err: any) {
      logger.warn("Live GitHub fetch failed or unconfigured", { error: err?.message });
    }

    return [];
  }
}

