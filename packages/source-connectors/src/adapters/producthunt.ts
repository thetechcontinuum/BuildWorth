import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class ProductHuntAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "producthunt";
  public readonly name = "Product Hunt";
  public readonly adapterType = "PRODUCTHUNT_GRAPHQL" as const;
  public readonly accessMethod = "GRAPHQL" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Uses Product Hunt GraphQL API and public launch feeds. Collects launch feedback and competitor gap observations.";
  public readonly attributionRequired = true;

  public async fetchSignals(limit = 20, _query?: string): Promise<RawIngestSignal[]> {
    logger.info(`Fetching Product Hunt launch feedback signals (limit ${limit})...`);
    // Unconfigured without GraphQL API credentials - produce zero items safely
    return [];
  }
}

