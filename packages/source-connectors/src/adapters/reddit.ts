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

  public async fetchSignals(limit = 20, _query?: string): Promise<RawIngestSignal[]> {
    logger.info(`Fetching Reddit signals from target communities (limit ${limit})...`);
    // Unconfigured without OAuth credentials - produce zero items safely
    return [];
  }
}

