import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { logger } from "@buildworth/observability";

export class KrAsiaAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "krasia";
  public readonly name = "KrASIA";
  public readonly adapterType = "KRASIA_RSS" as const;
  public readonly accessMethod = "RSS" as const;
  public readonly rateLimitPerMinute = 60;
  public readonly termsNotes =
    "Official public RSS feed via console.kr-asia.com/feed. Permitted editorial news discovery with attribution.";
  public readonly attributionRequired = true;

  private stripHtml(html: string): string {
    return html
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

  private detectMarketFocus(text: string): { market: string; countryFocus?: string } {
    const lower = text.toLowerCase();
    let countryFocus: string | undefined;

    if (lower.includes("singapore") || lower.includes("sea ") || lower.includes("southeast asia")) {
      countryFocus = "Southeast Asia";
    } else if (lower.includes("china") || lower.includes("beijing") || lower.includes("shanghai") || lower.includes("shenzhen")) {
      countryFocus = "China";
    } else if (lower.includes("japan") || lower.includes("tokyo")) {
      countryFocus = "Japan";
    } else if (lower.includes("indonesia") || lower.includes("jakarta")) {
      countryFocus = "Indonesia";
    } else if (lower.includes("india") || lower.includes("bengaluru") || lower.includes("delhi")) {
      countryFocus = "India";
    } else if (lower.includes("korea") || lower.includes("seoul")) {
      countryFocus = "South Korea";
    }

    return {
      market: "Asia / Pan-Asia",
      countryFocus,
    };
  }

  private detectSyndication(creator: string, text: string): { isSyndicated: boolean; syndicationPartner?: string } {
    const knownPartners = [
      "Nikkei Asia",
      "36Kr",
      "IPO Zaozhidao",
      "EqualOcean",
      "Tech in Asia",
      "DealStreetAsia",
      "Reuters",
      "Bloomberg",
      "Kyodo News",
    ];

    for (const partner of knownPartners) {
      if (creator.toLowerCase().includes(partner.toLowerCase()) || text.toLowerCase().includes(`via ${partner.toLowerCase()}`)) {
        return { isSyndicated: true, syndicationPartner: partner };
      }
    }

    return { isSyndicated: false };
  }

  public async fetchSignals(limit = 20, query?: string): Promise<RawIngestSignal[]> {
    logger.info(`Fetching KrASIA market signals (limit ${limit}${query ? `, query: ${query}` : ""})...`);
    try {
      const res = await fetch("https://console.kr-asia.com/feed", {
        headers: { "User-Agent": "BuildWorth-Staging/1.0" },
      });

      if (!res.ok) {
        logger.warn("KrASIA feed responded with error status", { status: res.status });
        return [];
      }

      const xml = await res.text();
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

      if (itemBlocks.length === 0) {
        return [];
      }

      const signals: RawIngestSignal[] = [];

      for (const block of itemBlocks) {
        const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || block.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
        const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
        const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const descMatch =
          block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
          block.match(/<description>([\s\S]*?)<\/description>/i) ||
          block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i);
        const creatorMatch = block.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/i) || block.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);

        const rawTitle = titleMatch ? this.stripHtml(titleMatch[1] || "") : "";
        const rawUrl = linkMatch ? (linkMatch[1] || "").trim() : "";
        const guid = guidMatch ? (guidMatch[1] || "").trim() : rawUrl;
        const creator = creatorMatch ? this.stripHtml(creatorMatch[1] || "") : "KrASIA Editorial";
        const rawDesc = descMatch ? this.stripHtml(descMatch[1] || "") : rawTitle;
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1] || "") : new Date();

        if (!rawUrl || (!rawTitle && !rawDesc)) continue;

        if (query && query.trim().length > 0) {
          const qLower = query.trim().toLowerCase();
          const combined = `${rawTitle} ${rawDesc}`.toLowerCase();
          if (!combined.includes(qLower)) {
            continue;
          }
        }

        const externalIdMatch = rawUrl.match(/kr-asia\.com\/([^/?#]+)/i);
        const externalId = externalIdMatch ? `krasia-${externalIdMatch[1]}` : `krasia-${guid.replace(/[^a-zA-Z0-9-]/g, "")}`;

        const combinedText = `${rawTitle} ${rawDesc}`;
        const { market, countryFocus } = this.detectMarketFocus(combinedText);
        const { isSyndicated, syndicationPartner } = this.detectSyndication(creator, combinedText);

        signals.push({
          externalId,
          sourceKey: this.sourceKey,
          sourceUrl: rawUrl,
          authorFingerprint: creator,
          title: rawTitle.slice(0, 150),
          rawContent: rawDesc.slice(0, 280),
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          metadata: {
            market,
            countryFocus,
            language: "en",
            creator,
            isSyndicated,
            syndicationPartner,
            evidenceCategory: "DISCOVERY",
          },
        });

        if (signals.length >= limit) break;
      }

      return signals;
    } catch (err: any) {
      logger.warn("Live KrASIA fetch failed or unreachable", { error: err?.message });
      return [];
    }
  }
}
