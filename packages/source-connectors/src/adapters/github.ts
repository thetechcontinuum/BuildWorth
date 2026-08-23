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

  public async fetchSignals(limit = 20): Promise<RawIngestSignal[]> {
    logger.info(`Fetching GitHub issues signals (limit ${limit})...`);
    return [
      {
        externalId: "gh-issue-98214",
        sourceKey: this.sourceKey,
        sourceUrl: "https://github.com/example-org/devops-tools/issues/98214",
        authorFingerprint: "platform_eng",
        title: "Feature Request: Automated Stripe invoice reconciliation webhook handler",
        rawContent:
          "Current workaround requires running a cron job in Python that parses CSV exports from Stripe and updates our SQL database. It fails silently when Stripe adds new tax fields.",
        publishedAt: new Date(),
        metadata: { repo: "example-org/devops-tools", labels: ["friction", "workaround"] },
      },
    ];
  }
}
