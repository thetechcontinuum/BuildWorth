import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

function stripXmlText(chunk: string): string {
  return chunk
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export class ProductHuntAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "producthunt";
  public readonly name = "Product Hunt";
  public readonly adapterType = "PRODUCTHUNT_GRAPHQL" as const;
  public readonly accessMethod = "GRAPHQL" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Uses Product Hunt GraphQL API and public Atom launch feeds. Collects launch feedback and competitor gap observations.";
  public readonly attributionRequired = true;

  public async fetchSignals(
    optionsOrLimit?: number | FetchSignalsOptions,
    explicitQuery?: string,
  ): Promise<RawIngestSignal[]> {
    const options: FetchSignalsOptions =
      typeof optionsOrLimit === "number"
        ? { limit: optionsOrLimit, query: explicitQuery }
        : optionsOrLimit || {};

    const limit = Math.min(options.limit || 20, 25);
    const query = (options.query || explicitQuery || "").trim().toLowerCase();

    logger.info(`Fetching Product Hunt launch feedback signals (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      const res = await fetch("https://www.producthunt.com/feed", {
        headers: {
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
          "Accept": "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      if (!res || !res.ok || typeof res.text !== "function") {
        return [];
      }

      const xml = await res.text();
      if (!xml) return [];

      const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
      const signals: RawIngestSignal[] = [];

      for (const entry of entries) {
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/i);
        const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const linkMatch =
          entry.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
          entry.match(/<link[^>]*href=["']([^"']+)["']/i);
        const contentMatch =
          entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
          entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        const publishedMatch =
          entry.match(/<published>([\s\S]*?)<\/published>/i) ||
          entry.match(/<updated>([\s\S]*?)<\/updated>/i);
        const authorMatch = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);

        const rawTitle = titleMatch ? stripXmlText(titleMatch[1] || "") : "";
        const sourceUrl = linkMatch ? (linkMatch[1] || "").trim() : "";
        const rawBody = contentMatch ? stripXmlText(contentMatch[1] || "") : "";
        const rawId = idMatch ? stripXmlText(idMatch[1] || "") : sourceUrl;

        if (!rawTitle || !sourceUrl) continue;

        if (query) {
          const terms = query.split(/\s+/).filter((t) => t.length >= 3);
          const textToMatch = `${rawTitle} ${rawBody}`.toLowerCase();
          const matched = textToMatch.includes(query) || (terms.length > 0 && terms.some((t) => textToMatch.includes(t)));
          if (!matched) continue;
        }

        const slugOrId =
          rawId.replace(/^https?:\/\/(www\.)?producthunt\.com\/(posts\/)?/i, "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) ||
          sourceUrl.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);

        const combined =
          rawBody && !rawBody.toLowerCase().startsWith(rawTitle.toLowerCase().slice(0, 20))
            ? `${rawTitle} — ${rawBody}`
            : rawTitle;

        const pubDate = publishedMatch ? new Date(stripXmlText(publishedMatch[1] || "")) : new Date();

        signals.push({
          externalId: `ph-${slugOrId}`,
          sourceKey: this.sourceKey,
          sourceUrl,
          authorFingerprint: authorMatch ? stripXmlText(authorMatch[1] || "") : "ph_maker",
          title: rawTitle.slice(0, 150),
          rawContent: combined.slice(0, 280),
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
        });

        if (signals.length >= limit) break;
      }

      return signals;
    } catch (err: any) {
      logger.warn("Live Product Hunt feed fetch failed or unreachable", { error: err?.message });
      return [];
    }
  }
}
