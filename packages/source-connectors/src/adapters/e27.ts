import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class E27Adapter extends BaseSourceAdapter {
  public readonly sourceKey = "e27";
  public readonly name = "e27";
  public readonly adapterType = "E27_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Access blocked by publisher Cloudflare 403 bot protection and robots.txt AI training restrictions. Kept disabled until official partnership API is provisioned.";
  public readonly attributionRequired = true;

  public override getHealth() {
    return {
      ...super.getHealth(),
      isEnabled: false,
      errorMessage: "Publisher access blocked: Cloudflare 403 challenge and lack of public open RSS/API.",
    };
  }

  public async fetchSignals(_limit = 20, _query?: string): Promise<RawIngestSignal[]> {
    logger.info("e27 adapter skipped: source disabled due to Cloudflare 403 bot restrictions and lack of official API");
    // Return empty array cleanly without fabricating mock items
    return [];
  }
}
