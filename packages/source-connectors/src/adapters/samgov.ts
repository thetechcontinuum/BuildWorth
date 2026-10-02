import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export class SamGovAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "samgov";
  public readonly name = "SAM.gov Federal Contracting";
  public readonly adapterType = "SAMGOV_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official SAM.gov Federal Contract Opportunities API. Requires API key (SAM_GOV_API_KEY). Tracks federal contract demand, solicitations, and procurement budgets.";
  public readonly attributionRequired = true;

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 10, 20);
    const apiKey = process.env.SAM_GOV_API_KEY;

    if (!apiKey) {
      logger.info("SAM_GOV_API_KEY not configured; skipping live SAM.gov fetch.");
      return [];
    }

    try {
      const today = new Date();
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) => {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      };

      const postedFrom = formatDate(past30);
      const postedTo = formatDate(today);

      let url = `https://api.sam.gov/opportunities/v2/search?api_key=${apiKey}&postedFrom=${postedFrom}&postedTo=${postedTo}&limit=${limit}`;
      if (options.query || explicitQuery) {
        url += `&q=${encodeURIComponent(options.query || explicitQuery || "")}`;
      }

      const res = await fetch(url, {
        headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
      });

      if (res.ok) {
        const json = await res.json();
        const opps = json.opportunitiesData || [];
        return opps.map((opp: any) => {
          const noticeId = opp.noticeId || opp.solicitationNumber || Math.random().toString(36).slice(2);
          const title = opp.title || "Federal Contract Opportunity";
          const desc = opp.description || opp.synopsis || title;
          const canonicalUrl = opp.uiLink || `https://sam.gov/opp/${noticeId}/view`;

          return {
            externalId: `samgov-${noticeId}`,
            sourceKey: this.sourceKey,
            sourceUrl: canonicalUrl,
            authorFingerprint: opp.department || opp.subTier || "us_federal_agency",
            title: String(title).slice(0, 150),
            rawContent: String(desc).slice(0, 280),
            publishedAt: opp.postedDate ? new Date(opp.postedDate) : new Date(),
            metadata: {
              noticeId,
              department: opp.department,
              subTier: opp.subTier,
              office: opp.office,
              type: opp.type,
            },
          };
        });
      }
    } catch (err: any) {
      logger.warn("Live SAM.gov fetch error", { error: err?.message });
    }

    return [];
  }
}
