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

  public async fetchSignals(limit = 20): Promise<RawIngestSignal[]> {
    logger.info(`Fetching Product Hunt launch feedback signals (limit ${limit})...`);
    return [
      {
        externalId: "ph-post-7712",
        sourceKey: this.sourceKey,
        sourceUrl: "https://producthunt.com/posts/example-saas-tool#comment-889",
        authorFingerprint: "saas_founder_99",
        title: "Comment on Tool Launch: Missing Enterprise Multi-Tenant Support",
        rawContent:
          "Looks great for small teams, but without SSO, SCIM provisioning, and multi-tenant audit logs, we cannot adopt this in our 200-person company.",
        publishedAt: new Date(),
        metadata: { product: "example-saas", votes: 450 },
      },
    ];
  }
}
