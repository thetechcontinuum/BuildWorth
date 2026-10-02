import { BaseSourceAdapter } from "./base.js";
import { RawIngestSignal, FetchSignalsOptions } from "../types.js";
import { logger } from "@buildworth/observability";

export class ArxivAdapter extends BaseSourceAdapter {
  public readonly sourceKey = "arxiv";
  public readonly name = "arXiv Research Preprints";
  public readonly adapterType = "ARXIV_API" as const;
  public readonly accessMethod = "API" as const;
  public readonly rateLimitPerMinute = 20; // arXiv recommends 1 req / 3s
  public readonly termsNotes =
    "Official arXiv API (export.arxiv.org). Scientific and technical research preprints showing emerging technology trends and research breakthroughs.";
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

    logger.info(`Fetching arXiv research preprints (limit ${limit}${query ? `, query: ${query}` : ""})...`);

    try {
      let searchQuery = "cat:cs.AI OR cat:cs.SE OR cat:cs.CR";
      if (query) {
        searchQuery = `all:${encodeURIComponent(query)}`;
      }

      const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&sortBy=submittedDate&sortOrder=descending&start=${options.page ? (options.page - 1) * limit : 0}&max_results=${limit}`;

      const res = await fetch(url, {
        headers: { "User-Agent": "BuildWorth-Market-Intelligence/1.0" },
      });

      if (res.ok) {
        const xml = await res.text();
        const entries = this.parseAtomEntries(xml);
        return entries.map((entry) => ({
          externalId: `arxiv-${entry.id}`,
          sourceKey: this.sourceKey,
          sourceUrl: entry.link || `https://arxiv.org/abs/${entry.id}`,
          authorFingerprint: entry.author || "arxiv_researcher",
          title: String(entry.title).slice(0, 150),
          rawContent: String(entry.summary || entry.title).slice(0, 280),
          publishedAt: entry.published ? new Date(entry.published) : new Date(),
          metadata: {
            arxivId: entry.id,
            categories: entry.categories,
            primaryCategory: entry.primaryCategory,
          },
        }));
      }
    } catch (err: any) {
      logger.warn("Live arXiv fetch failed or unreachable", { error: err?.message });
    }

    return [];
  }

  private parseAtomEntries(xml: string): Array<{
    id: string;
    title: string;
    summary: string;
    published?: string;
    link?: string;
    author?: string;
    categories?: string[];
    primaryCategory?: string;
  }> {
    const entries: Array<{
      id: string;
      title: string;
      summary: string;
      published?: string;
      link?: string;
      author?: string;
      categories?: string[];
      primaryCategory?: string;
    }> = [];

    const entryBlocks = xml.split("<entry>");
    // Skip the first split since it precedes <entry>
    for (let i = 1; i < entryBlocks.length; i++) {
      const rawBlock = entryBlocks[i];
      if (!rawBlock) continue;
      const block = rawBlock.split("</entry>")[0];
      if (!block) continue;

      const rawIdMatch = block.match(/<id>(.*?)<\/id>/);
      const rawId = (rawIdMatch && rawIdMatch[1]) ? rawIdMatch[1].trim() : "";
      // arXiv ids look like http://arxiv.org/abs/2609.12345v1
      const id = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "");

      const titleMatch = block.match(/<title>(.*?)<\/title>/s);
      const title = (titleMatch && titleMatch[1]) ? titleMatch[1].replace(/[\r\n\t]+/g, " ").trim() : "arXiv Preprint";

      const summaryMatch = block.match(/<summary>(.*?)<\/summary>/s);
      const summary = (summaryMatch && summaryMatch[1]) ? summaryMatch[1].replace(/[\r\n\t]+/g, " ").trim() : title;

      const publishedMatch = block.match(/<published>(.*?)<\/published>/);
      const published = (publishedMatch && publishedMatch[1]) ? publishedMatch[1].trim() : undefined;

      const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*rel="alternate"/);
      const link = (linkMatch && linkMatch[1]) ? linkMatch[1].trim() : rawId;

      const authorMatch = block.match(/<author>.*?<name>(.*?)<\/name>.*?<\/author>/s);
      const author = (authorMatch && authorMatch[1]) ? authorMatch[1].trim() : undefined;

      entries.push({
        id: id || Math.random().toString(36).slice(2),
        title,
        summary,
        published,
        link: link.startsWith("http") ? link : `https://arxiv.org/abs/${id}`,
        author,
      });
    }

    return entries;
  }
}
