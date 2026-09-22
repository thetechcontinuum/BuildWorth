import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { safeFetch } from "../safe-fetch.js";
import { logger } from "@buildworth/observability";
import { detectPromptInjection, sanitizeToPlainText } from "@buildworth/shared";

/**
 * Silicon Canals Adapter (Europe / Benelux Tech & Startup Ecosystem).
 *
 * Guarantees:
 * 1. Safe HTTP fetch with SSRF defense & timeout caps.
 * 2. 280-char sanitized excerpts; preserved publication timestamps.
 * 3. Never fabricates fallback or synthetic items.
 * 4. European regional focus and attribution.
 */
export class SiliconCanalsAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "siliconcanals";
  public readonly name = "Silicon Canals";
  public readonly adapterType = "GENERIC_RSS" as const;
  public readonly accessMethod = "RSS" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official public RSS feed via siliconcanals.com/feed/. Editorial European tech and startup intelligence with attribution.";
  public readonly attributionRequired = true;

  private sanitizeXmlText(xmlChunk: string): string {
    return xmlChunk
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  public async fetchSignals(limit = 20, query?: string): Promise<RawIngestSignal[]> {
    logger.info(`Fetching Silicon Canals European market signals (limit ${limit})...`);

    try {
      const response = await safeFetch("https://siliconcanals.com/feed/", {
        timeoutMs: 8000,
        maxSizeBytes: 1024 * 1024,
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
        },
      });

      if (response.status < 200 || response.status >= 300) {
        logger.warn("Silicon Canals feed returned non-200 status", { status: response.status });
        return [];
      }

      const xml = response.data;
      if (/<!ENTITY/i.test(xml) || /<!DOCTYPE[^>]*\[/i.test(xml)) {
        logger.warn("Silicon Canals XML rejected due to DTD/ENTITY declarations (XXE defense)");
        return [];
      }

      const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
      if (itemBlocks.length === 0) return [];

      const signals: RawIngestSignal[] = [];

      for (const block of itemBlocks) {
        const titleMatch =
          block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
          block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const linkMatch =
          block.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) ||
          block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const guidMatch =
          block.match(/<guid[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/guid>/i) ||
          block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
        const descMatch =
          block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
          block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
          block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i);
        const pubDateMatch =
          block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
          block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
        const creatorMatch =
          block.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/i) ||
          block.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

        const rawTitle = titleMatch ? this.sanitizeXmlText(titleMatch[1] || "") : "";
        const rawUrl = linkMatch ? (linkMatch[1] || "").trim() : "";
        const guid = guidMatch ? this.sanitizeXmlText(guidMatch[1] || "") : rawUrl;
        const rawDesc = descMatch ? this.sanitizeXmlText(descMatch[1] || "") : rawTitle;
        const pubDate = pubDateMatch ? new Date(this.sanitizeXmlText(pubDateMatch[1] || "")) : new Date();
        const creator = creatorMatch ? this.sanitizeXmlText(creatorMatch[1] || "") : "Silicon Canals";

        if (!rawUrl || (!rawTitle && !rawDesc)) continue;

        if (query && query.trim().length > 0) {
          const qLower = query.trim().toLowerCase();
          if (!rawTitle.toLowerCase().includes(qLower) && !rawDesc.toLowerCase().includes(qLower)) {
            continue;
          }
        }

        const externalIdMatch = rawUrl.match(/siliconcanals\.com\/([^/?#]+)/i);
        const externalId =
          externalIdMatch && externalIdMatch[1]
            ? `siliconcanals-${externalIdMatch[1].slice(0, 48)}`
            : `siliconcanals-${guid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`;

        const promptInjectionDetected = detectPromptInjection(`${rawTitle} ${rawDesc}`);
        const sanitizedContent = sanitizeToPlainText(rawDesc, 280);

        signals.push({
          externalId,
          sourceKey: this.sourceKey,
          sourceUrl: rawUrl,
          authorFingerprint: creator.slice(0, 80),
          title: rawTitle ? rawTitle.slice(0, 150) : undefined,
          rawContent: sanitizedContent,
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          promptInjectionDetected,
          metadata: {
            market: "Europe",
            sourceFamily: "DISCOVERY",
            language: "en",
            creator,
            evidenceCategory: "DISCOVERY",
          },
        });

        if (signals.length >= limit) break;
      }

      return signals;
    } catch (err: any) {
      logger.warn("Silicon Canals fetch failed", { error: err?.message });
      return [];
    }
  }
}
