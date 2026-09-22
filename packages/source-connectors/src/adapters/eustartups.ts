import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class EUStartupsAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "eustartups";
  public readonly name = "EU-Startups";
  public readonly adapterType = "GENERIC_RSS" as const;
  public readonly accessMethod = "RSS" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Access blocked by publisher Cloudflare HTTP/2 403 bot protection. Verification failed on live feed probe; kept disabled per policy.";
  public readonly attributionRequired = true;

  public override getHealth() {
    return {
      ...super.getHealth(),
      isEnabled: false,
      errorMessage: "Publisher access blocked: Cloudflare HTTP/2 403 challenge on /feed/ endpoint.",
    };
  }

  public async fetchSignals(_limit = 20, _query?: string): Promise<RawIngestSignal[]> {
    logger.info("EU-Startups adapter skipped: source disabled due to Cloudflare 403 bot protection");
    return [];
  }
}
