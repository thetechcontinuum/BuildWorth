import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export class CisaKevAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "cisakev";
  public readonly name = "CISA Known Exploited Vulnerabilities";
  public readonly adapterType = "CISAKEV_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official CISA KEV JSON catalog feed (cisa.gov). Verified in-the-wild security vulnerabilities requiring remediation under Binding Operational Directives.";
  public readonly attributionRequired = true;

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 10, 25);
    const query = (options.query || explicitQuery || "").toLowerCase().trim();

    logger.info(`Fetching CISA KEV vulnerabilities (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      const res = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", {
        headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
      });

      if (res.ok) {
        const json = await res.json();
        const vulns = json.vulnerabilities || [];
        // CISA KEV has newest additions at the top or sorted by dateAdded
        const sorted = [...vulns].sort((a: any, b: any) => {
          return new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime();
        });

        let filtered = sorted;
        if (query) {
          filtered = sorted.filter((v: any) => {
            const haystack = `${v.cveID || ""} ${v.vendorProject || ""} ${v.product || ""} ${v.vulnerabilityName || ""} ${v.shortDescription || ""}`.toLowerCase();
            return haystack.includes(query);
          });
        }

        return filtered.slice(0, limit).map((v: any) => {
          const title = `${v.cveID}: ${v.vendorProject} ${v.product} - ${v.vulnerabilityName || "Vulnerability"}`;
          const rawContent = v.shortDescription || title;
          const canonicalUrl = `https://nvd.nist.gov/vuln/detail/${v.cveID}`;
          const publishedAt = v.dateAdded ? new Date(v.dateAdded) : new Date();

          return {
            externalId: `cisa-${v.cveID}`,
            sourceKey: this.sourceKey,
            sourceUrl: canonicalUrl,
            authorFingerprint: "cisa_kev",
            title: String(title).slice(0, 150),
            rawContent: String(rawContent).slice(0, 280),
            publishedAt,
            metadata: {
              cveID: v.cveID,
              vendorProject: v.vendorProject,
              product: v.product,
              dueDate: v.dueDate,
              knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
              notes: v.notes,
            },
          };
        });
      }
    } catch (err: any) {
      logger.warn("Live CISA KEV fetch failed or unreachable", { error: err?.message });
    }

    return [];
  }
}
