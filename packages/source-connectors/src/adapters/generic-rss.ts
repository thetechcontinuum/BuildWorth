import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, SourceAccessMethod } from "../types.js";
import { safeFetch } from "../safe-fetch.js";
import { logger } from "@buildworth/observability";
import { detectPromptInjection, sanitizeToPlainText } from "@buildworth/shared";

export interface GenericRssConfig {
  sourceKey: string;
  name: string;
  feedUrl: string;
  rateLimitPerMinute?: number;
  termsNotes?: string;
  attributionRequired?: boolean;
  permittedExcerptLength?: number;
  sourceFamily?: string;
  language?: string;
  region?: string;
  topics?: string[];
}

/**
 * Generic RSS Adapter.
 *
 * Security & Reliability Guarantees:
 * 1. Safe HTTP fetch with Connection Pinning & SSRF defense (loopback, private, link-local, cloud metadata blocked).
 * 2. Safe bounded XML parsing with external entity expansion strictly disabled.
 * 3. Payload size caps (1MB) and network timeout enforcement.
 * 4. Treats fetched text as UNTRUSTED input: flags potential prompt injection without fabricating content.
 * 5. Returns genuine items only; never returns synthetic fallback items.
 */
export class GenericRssAdapter extends BaseSourceAdapter {
  public readonly sourceKey: string;
  public readonly name: string;
  public readonly adapterType = "GENERIC_RSS" as const;
  public readonly accessMethod: SourceAccessMethod = "RSS";
  public readonly rateLimitPerMinute: number;
  public readonly termsNotes: string;
  public readonly attributionRequired: boolean;
  public readonly feedUrl: string;
  public readonly permittedExcerptLength: number;
  public readonly sourceFamily: string;
  public readonly language: string;
  public readonly region?: string;
  public readonly topics: string[];

  constructor(config: GenericRssConfig) {
    super();
    this.sourceKey = config.sourceKey;
    this.name = config.name;
    this.feedUrl = config.feedUrl;
    this.rateLimitPerMinute = config.rateLimitPerMinute || 60;
    this.termsNotes = config.termsNotes || "Public RSS syndication feed with source attribution.";
    this.attributionRequired = config.attributionRequired ?? true;
    this.permittedExcerptLength = config.permittedExcerptLength || 280;
    this.sourceFamily = config.sourceFamily || "COMMUNITY";
    this.language = config.language || "en";
    this.region = config.region;
    this.topics = config.topics || [];
  }

  /**
   * Safely decodes XML entities and strips XML/HTML tags without executing external entities.
   */
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
    logger.info(`Fetching Generic RSS signals from ${this.name} (${this.feedUrl}, limit: ${limit})...`);

    try {
      const response = await safeFetch(this.feedUrl, {
        timeoutMs: 8000,
        maxSizeBytes: 1024 * 1024, // 1MB maximum
        maxRedirects: 3,
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "BuildWorth-Market-Intelligence/1.0",
        },
      });

      if (response.status < 200 || response.status >= 300) {
        logger.warn(`Generic RSS feed returned status ${response.status}`, { url: this.feedUrl });
        return [];
      }

      const xml = response.data;

      // Safe XML check: Reject XML if it contains DTD entity definitions to prevent XXE attacks
      if (/<!ENTITY/i.test(xml) || /<!DOCTYPE[^>]*\[/i.test(xml)) {
        logger.warn(`Generic RSS feed rejected due to suspicious DTD/ENTITY declarations (XXE defense)`, { url: this.feedUrl });
        return [];
      }

      // Match item blocks safely
      const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
      if (itemBlocks.length === 0) {
        return [];
      }

      const signals: RawIngestSignal[] = [];

      for (const block of itemBlocks) {
        // Extract title
        const titleMatch =
          block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
          block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const rawTitle = titleMatch ? this.sanitizeXmlText(titleMatch[1] || "") : "";

        // Extract link / URL
        const linkTagMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
        const linkBodyMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        let rawUrl = (linkTagMatch?.[1] || linkBodyMatch?.[1] || "").trim();
        rawUrl = rawUrl.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();

        // Extract guid / id
        const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || block.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
        const rawGuid = guidMatch ? this.sanitizeXmlText(guidMatch[1] || "") : rawUrl;

        // Extract description / content
        const descMatch =
          block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ||
          block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
          block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
          block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        const rawDesc = descMatch ? this.sanitizeXmlText(descMatch[1] || "") : rawTitle;

        // Extract pubDate
        const pubDateMatch =
          block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
          block.match(/<published>([\s\S]*?)<\/published>/i) ||
          block.match(/<updated>([\s\S]*?)<\/updated>/i) ||
          block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
        const rawPubDate = pubDateMatch ? new Date(this.sanitizeXmlText(pubDateMatch[1] || "")) : new Date();

        // Extract author
        const creatorMatch =
          block.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/i) ||
          block.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ||
          block.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
        const author = creatorMatch ? this.sanitizeXmlText(creatorMatch[1] || "") : this.name;

        if (!rawUrl || (!rawTitle && !rawDesc)) {
          continue;
        }

        // Apply query filter if provided
        if (query && query.trim().length > 0) {
          const qLower = query.trim().toLowerCase();
          if (!rawTitle.toLowerCase().includes(qLower) && !rawDesc.toLowerCase().includes(qLower)) {
            continue;
          }
        }

        // Check for prompt injection in untrusted text (record flag, do not alter original text)
        const combinedUntrustedText = `${rawTitle} ${rawDesc}`;
        const promptInjectionDetected = detectPromptInjection(combinedUntrustedText);

        const externalId = `${this.sourceKey}-${rawGuid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}`;
        const sanitizedContent = sanitizeToPlainText(rawDesc, this.permittedExcerptLength);

        signals.push({
          externalId,
          sourceKey: this.sourceKey,
          sourceUrl: rawUrl,
          authorFingerprint: author.slice(0, 80),
          promptInjectionDetected,
          title: rawTitle ? rawTitle.slice(0, 150) : undefined,
          rawContent: sanitizedContent,
          publishedAt: isNaN(rawPubDate.getTime()) ? new Date() : rawPubDate,
          metadata: {
            feedUrl: this.feedUrl,
            sourceFamily: this.sourceFamily,
            language: this.language,
            region: this.region,
            topics: this.topics,
            promptInjectionDetected,
          },
        });

        if (signals.length >= limit) {
          break;
        }
      }

      return signals;
    } catch (err: any) {
      logger.warn(`Generic RSS fetch error for ${this.name}`, { error: err?.message });
      return [];
    }
  }
}
