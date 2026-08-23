import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class RedditAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "reddit";
  public readonly name = "Reddit Tech & Ops";
  public readonly adapterType = "REDDIT_OAUTH" as const;
  public readonly accessMethod = "OAUTH_API" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Uses Reddit OAuth 2.0 API under developer terms. Excerpts limited to 280 chars with permalink citation.";
  public readonly attributionRequired = true;

  public async fetchSignals(limit = 20): Promise<RawIngestSignal[]> {
    logger.info(`Fetching Reddit signals from target communities (limit ${limit})...`);
    return [
      {
        externalId: "rd-1f92a10",
        sourceKey: this.sourceKey,
        sourceUrl: "https://reddit.com/r/devops/comments/1f92a10",
        authorFingerprint: "infra_guru",
        title: "Tired of spending Fridays reconciling Terraform drift",
        rawContent:
          "We have 4 AWS accounts and Terraform state files get out of sync constantly. We had an outage last week because someone changed a security group manually in the console. Would pay $200/mo for a tool that just blocks console edits and creates a PR automatically.",
        publishedAt: new Date(),
        metadata: { subreddit: "devops", upvotes: 312, comments: 74 },
      },
    ];
  }
}
