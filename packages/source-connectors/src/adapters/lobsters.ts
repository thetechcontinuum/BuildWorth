import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal } from "../types.js";
import { safeFetch } from "../safe-fetch.js";
import { logger } from "@buildworth/observability";
import { detectPromptInjection, sanitizeToPlainText } from "@buildworth/shared";

/**
 * Lobsters Adapter (Global Developer Community & Friction).
 *
 * Guarantees:
 * 1. Modeled as a COMMUNITY aggregator.
 * 2. Clearly separates Lobsters discussion/comments URL from the submitted external article link.
 * 3. Safe HTTP fetch with SSRF defense & timeout caps.
 * 4. 280-char sanitized excerpts; preserved publication timestamps.
 * 5. Global / Developer Ecosystem metadata attribution.
 */
export class LobstersAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "lobsters";
  public readonly name = "Lobsters";
  public readonly adapterType = "GENERIC_RSS" as const;
  public readonly accessMethod = "RSS" as const;
  public readonly rateLimitPerMinute = 30;
  public readonly termsNotes =
    "Official public RSS feed via lobste.rs/rss. Community developer discussions and external technical problem articles.";
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
    logger.info(`Fetching Lobsters developer signals (limit ${limit})...`);

    try {
      const response = await safeFetch("https://lobste.rs/rss", {
        timeoutMs: 8000,
        maxSizeBytes: 1024 * 1024,
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
        },
      });

      if (response.status < 200 || response.status >= 300) {
        logger.warn("Lobsters feed returned non-200 status", { status: response.status });
        return [];
      }

      const xml = response.data;
      if (/<!ENTITY/i.test(xml) || /<!DOCTYPE[^>]*\[/i.test(xml)) {
        logger.warn("Lobsters XML rejected due to DTD/ENTITY declarations (XXE defense)");
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
        const commentsMatch =
          block.match(/<comments><!\[CDATA\[([\s\S]*?)\]\]><\/comments>/i) ||
          block.match(/<comments[^>]*>([\s\S]*?)<\/comments>/i);
        const descMatch =
          block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
          block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        const pubDateMatch =
          block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
          block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
        const authorMatch =
          block.match(/<author><!\[CDATA\[([\s\S]*?)\]\]><\/author>/i) ||
          block.match(/<author[^>]*>([\s\S]*?)<\/author>/i) ||
          block.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

        const rawTitle = titleMatch ? this.sanitizeXmlText(titleMatch[1] || "") : "";
        const externalArticleUrl = linkMatch ? (linkMatch[1] || "").trim() : "";
        const discussionUrl = guidMatch
          ? this.sanitizeXmlText(guidMatch[1] || "").trim()
          : commentsMatch
            ? this.sanitizeXmlText(commentsMatch[1] || "").trim()
            : externalArticleUrl;

        const rawDesc = descMatch ? this.sanitizeXmlText(descMatch[1] || "") : rawTitle;
        const pubDate = pubDateMatch ? new Date(this.sanitizeXmlText(pubDateMatch[1] || "")) : new Date();
        const author = authorMatch ? this.sanitizeXmlText(authorMatch[1] || "") : "Lobsters Community";

        // In Lobsters RSS, <link> is often the external article URL, and <guid> is the lobste.rs/s/<id> discussion URL
        const primaryUrl = externalArticleUrl || discussionUrl;
        if (!primaryUrl || (!rawTitle && !rawDesc)) continue;

        if (query && query.trim().length > 0) {
          const qLower = query.trim().toLowerCase();
          if (!rawTitle.toLowerCase().includes(qLower) && !rawDesc.toLowerCase().includes(qLower)) {
            continue;
          }
        }

        const externalIdMatch = discussionUrl.match(/lobste\.rs\/s\/([a-zA-Z0-9]+)/i);
        const externalId =
          externalIdMatch && externalIdMatch[1]
            ? `lobsters-${externalIdMatch[1]}`
            : `lobsters-${primaryUrl.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`;

        const promptInjectionDetected = detectPromptInjection(`${rawTitle} ${rawDesc}`);
        const sanitizedContent = sanitizeToPlainText(rawDesc, 280);

        signals.push({
          externalId,
          sourceKey: this.sourceKey,
          sourceUrl: primaryUrl,
          authorFingerprint: author.slice(0, 80),
          title: rawTitle ? rawTitle.slice(0, 150) : undefined,
          rawContent: sanitizedContent,
          publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
          promptInjectionDetected,
          metadata: {
            market: "Global / Developer Ecosystem",
            sourceFamily: "COMMUNITY",
            externalArticleUrl,
            discussionUrl,
            language: "en",
            author,
            evidenceCategory: "DEVELOPER_FRICTION",
          },
        });

        if (signals.length >= limit) break;
      }

      return signals;
    } catch (err: any) {
      logger.warn("Lobsters fetch failed", { error: err?.message });
      return [];
    }
  }
}
