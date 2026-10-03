import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export class TedTendersAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "ted";
  public readonly name = "TED Europa Tenders";
  public readonly adapterType = "TED_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Official TED Europa public search API v3. European public procurement and tenders demonstrating public buyer demand and contract budgets.";
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
    const query = (options.query || explicitQuery || "").trim();

    logger.info(`Fetching TED Europa tender notices (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      // Build query string
      let expertQuery = "publication-date >= 20260901";
      if (query) {
        expertQuery = `(${expertQuery}) AND notice-title ~ "${query.replace(/"/g, "")}"`;
      }

      const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
        },
        body: JSON.stringify({
          query: expertQuery,
          page: options.page || 1,
          limit,
          fields: ["notice-identifier", "title-lot", "notice-title", "publication-date"],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const notices = json.notices || [];
        if (notices.length > 0) {
          return notices.map((n: any) => {
            const noticeId = n["notice-identifier"] || n["publication-number"] || Math.random().toString(36).slice(2);
            const pubNum = n["publication-number"] || noticeId;
            const titlesObj = n["notice-title"] || {};
            const lotTitlesObj = n["title-lot"] || {};
            // Prefer English, then first available title
            const rawTitle =
              titlesObj.eng ||
              Object.values(titlesObj)[0] ||
              (Array.isArray(lotTitlesObj.eng) ? lotTitlesObj.eng[0] : null) ||
              (lotTitlesObj.fra && lotTitlesObj.fra[0]) ||
              (lotTitlesObj.deu && lotTitlesObj.deu[0]) ||
              `EU Public Procurement Notice ${pubNum}`;

            const pubDateStr = n["publication-date"];
            let publishedAt = new Date();
            if (pubDateStr) {
              const str = String(pubDateStr).trim();
              const plusPart = str.split("+")[0] ?? str;
              const datePart = plusPart.split("T")[0] ?? plusPart;
              const parsed = new Date(`${datePart}T00:00:00Z`);
              if (!isNaN(parsed.getTime())) {
                publishedAt = parsed;
              }
            }

            // Extract lots or detailed scopes if present
            const lots: string[] = [];
            if (lotTitlesObj && typeof lotTitlesObj === "object") {
              const allLots = Object.values(lotTitlesObj).flat().filter(Boolean);
              for (const lot of allLots) {
                if (typeof lot === "string" && lot.trim().length > 0 && !lots.includes(lot.trim())) {
                  lots.push(lot.trim());
                }
              }
            }

            const lotSummary = lots.length > 0 ? `Lots/Scope: ${lots.slice(0, 3).join("; ")}` : "";
            const dateInfo = pubDateStr ? `Publication date: ${pubDateStr}.` : "";
            const tenderInfo = `European Union Public Procurement Tender [Notice ${pubNum}].`;

            const fullContent = [rawTitle, tenderInfo, lotSummary, dateInfo].filter(Boolean).join(" | ").trim();

            const canonicalUrl =
              (n.links && n.links.html && (n.links.html.ENG || n.links.html.DEU || n.links.html.FRA || Object.values(n.links.html)[0])) ||
              `https://ted.europa.eu/en/notice/-/detail/${pubNum}`;

            return {
              externalId: `ted-${pubNum}`,
              sourceKey: this.sourceKey,
              sourceUrl: canonicalUrl,
              authorFingerprint: "ted_europa",
              title: String(rawTitle).slice(0, 150),
              rawContent: fullContent.slice(0, 500),
              publishedAt,
              metadata: {
                noticeIdentifier: n["notice-identifier"],
                publicationNumber: n["publication-number"],
                source: "ted",
              },
            };
          });
        }
      }
    } catch (err: any) {
      logger.warn("Live TED fetch failed or unreachable", { error: err?.message });
    }

    return [];
  }
}
