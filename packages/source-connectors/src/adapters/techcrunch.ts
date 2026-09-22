import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

/**
 * TechCrunch Adapter (North America & Global Venture / Startup Ecosystem).
 *
 * Status: REVIEW_REQUIRED (Kept disabled pending formal RSS-use compliance & publisher terms confirmation).
 */
export class TechCrunchAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "techcrunch";
  public readonly name = "TechCrunch";
  public readonly adapterType = "GENERIC_RSS" as const;
  public readonly accessMethod = "RSS" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Feed available via techcrunch.com/feed/; kept disabled with status REVIEW_REQUIRED pending formal RSS commercial use and syndication compliance review.";
  public readonly attributionRequired = true;

  public override getHealth() {
    return {
      ...super.getHealth(),
      isEnabled: false,
      policyStatus: "REVIEW_REQUIRED" as any,
      errorMessage: "Source disabled pending formal RSS commercial use and syndication compliance confirmation.",
    };
  }

  public async fetchSignals(_limit = 20, _query?: string): Promise<RawIngestSignal[]> {
    logger.info("TechCrunch adapter skipped: source disabled under REVIEW_REQUIRED status");
    return [];
  }
}
