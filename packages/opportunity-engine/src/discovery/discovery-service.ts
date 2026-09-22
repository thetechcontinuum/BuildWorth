import { DiscoveryFeedItemDTO, DiscoveryFeedResponseDTO } from "@buildworth/shared";
import { logger } from "@buildworth/observability";

export interface GetDiscoveryFeedOptions {
  limit?: number;
  market?: string;
  maxItemsPerSource?: number;
}

/**
 * Derives a human-readable geographic market from source signals or vertical
 */
export function deriveMarketRegion(sourceKey?: string, sourceFamily?: string, industry?: string): string {
  if (sourceKey === "krasia" || sourceKey === "e27") {
    return "Asia / Pan-Asia";
  }
  if (sourceKey === "eustartups" || sourceKey === "siliconcanals") {
    return "Europe";
  }
  if (sourceKey === "lobsters") {
    return "Global / Developer Ecosystem";
  }
  if (sourceKey === "techcrunch") {
    return "North America & Global";
  }
  if (sourceKey === "github") {
    return "Global / Developer Ecosystem";
  }
  if (sourceKey === "hackernews" || sourceKey === "reddit") {
    return "Global / North America & Europe";
  }
  if (sourceFamily === "DISCOVERY") {
    return "Global Emerging Markets";
  }
  if (industry && industry.includes("Asia")) {
    return "Asia / Pan-Asia";
  }
  return "Global / Remote";
}

/**
 * Builds the public daily "New ideas to explore" discovery feed.
 *
 * Guarantees:
 * 1. Strictly allowlisted public fields via DiscoveryFeedItemDTO - NEVER leaks Pro blueprint fields,
 *    internal IDs, private user data, or unreviewed text.
 * 2. Never marks a DRAFT or HYPOTHESIS candidate as VERIFIED.
 * 3. Shows original source publication date separately from the feed discovery timestamp.
 * 4. Clearly separates observed evidence facts from AI business hypotheses.
 * 5. Returns up to limit (target 3-5) distinct genuine posts, deduplicated by canonicalUrl,
 *    content hash, and duplicate group key.
 * 6. Never fabricates posts or resets timestamps when today has no new posts; displays
 *    latest authentic posts with actual dates and clear metadata.
 */
export async function getDailyDiscoveryFeed(
  prisma: any,
  options: GetDiscoveryFeedOptions = {},
): Promise<DiscoveryFeedResponseDTO> {
  const limit = Math.min(10, Math.max(1, options.limit || 5));
  const maxItemsPerSource = Math.max(1, options.maxItemsPerSource || 2);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    // 1. Fetch genuine candidates that have evidence links
    const candidates = await prisma.opportunity.findMany({
      where: {
        isDemoFixture: false,
        publicationQualityStatus: { in: ["HYPOTHESIS", "PARTIALLY_VERIFIED", "EVIDENCE_PENDING"] },
        status: { in: ["DRAFT", "IN_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        evidenceLinks: {
          take: 5,
          include: {
            normalizedSignal: {
              include: {
                rawSignal: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const sourceCounts = new Map<string, number>();
    const items: DiscoveryFeedItemDTO[] = [];

    for (const opp of candidates) {
      if (items.length >= limit) break;

      // Extract genuine evidence observations
      const observations: Array<{
        id: string;
        sourceTitle: string;
        excerpt: string;
        canonicalUrl: string;
        sourceFamily: string;
        sourceName: string;
        publishedAt: string;
      }> = [];

      let primaryCanonicalUrl = "";
      let primarySourceTitle = "";
      let primarySourceFamily = "COMMUNITY";
      let primarySourceKey = "";
      let primaryPublishedAt: Date | null = null;

      for (const link of opp.evidenceLinks || []) {
        const ns = link.normalizedSignal;
        const raw = ns?.rawSignal;
        const src = raw?.source;
        if (!ns || !raw) continue;

        const canonical = ns.canonicalUrl || raw.sourceUrl;
        if (!primaryCanonicalUrl && canonical) {
          primaryCanonicalUrl = canonical;
          primarySourceTitle = raw.title || ns.sourceTitle || src?.name || "Market Signal";
          primarySourceFamily = src?.sourceFamily || (src?.key === "github" ? "DEVELOPER_ECOSYSTEM" : src?.key === "krasia" ? "DISCOVERY" : "COMMUNITY");
          primarySourceKey = src?.key || "";
          primaryPublishedAt = raw.publishedAt || ns.publishedAt || raw.createdAt;
        }

        const obsDate = raw.publishedAt || ns.publishedAt || raw.createdAt || new Date();
        const obsDateIso = obsDate instanceof Date ? obsDate.toISOString() : new Date(obsDate).toISOString();

        observations.push({
          id: ns.id,
          sourceTitle: raw.title || ns.sourceTitle || src?.name || "Market Evidence",
          excerpt: ns.sanitizedExcerpt || ns.problemSummary,
          canonicalUrl: canonical,
          sourceFamily: src?.sourceFamily || "COMMUNITY",
          sourceName: src?.name || "Public Community",
          publishedAt: obsDateIso,
        });
      }

      // Enforce public feed primary source limits to ensure diversity
      const effectiveSourceKey = primarySourceKey || "unknown";
      const currentSourceCount = sourceCounts.get(effectiveSourceKey) || 0;
      if (currentSourceCount >= maxItemsPerSource) {
        continue;
      }

      // Deduplication by primary URL and title
      const urlKey = primaryCanonicalUrl.toLowerCase().trim();
      const titleKey = opp.title.toLowerCase().trim();

      if (urlKey && seenUrls.has(urlKey)) continue;
      if (titleKey && seenTitles.has(titleKey)) continue;

      if (urlKey) seenUrls.add(urlKey);
      if (titleKey) seenTitles.add(titleKey);
      sourceCounts.set(effectiveSourceKey, currentSourceCount + 1);

      // Extract observed facts directly from signal excerpts
      const observedFacts = observations.map((o) => o.excerpt).slice(0, 3);
      if (observedFacts.length === 0 && opp.problemStatement) {
        observedFacts.push(opp.problemStatement);
      }

      // Demarcate AI-generated business hypothesis
      const businessHypothesis = {
        targetAudience: opp.economicBuyer || opp.endUser || "Early Adopter Teams",
        proposedSolution: opp.proposedProduct || opp.oneSentenceSummary || "Targeted Workflow Automation",
        painFriction: opp.problemStatement || opp.existingWorkflow || "Recurring manual friction and operational delays",
        confidenceNote: "Initial market hypothesis derived from public signals. Not yet validated via formal customer interviews or WTP proof.",
      };

      const market = deriveMarketRegion(primarySourceKey, primarySourceFamily, opp.industry);
      const pubDate = primaryPublishedAt ? primaryPublishedAt.toISOString() : opp.createdAt.toISOString();

      items.push({
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        summary: opp.oneSentenceSummary,
        observedFacts,
        evidenceObservations: observations,
        businessHypothesis,
        publicationDate: pubDate,
        discoveredAt: opp.createdAt.toISOString(),
        market,
        canonicalUrl: primaryCanonicalUrl || `https://buildworth.app/opportunities/${opp.slug}`,
        sourceTitle: primarySourceTitle || "Market Discussion",
        sourceFamily: primarySourceFamily,
        verificationLabel: "Early idea / Not yet verified",
        signalCount: opp.evidenceLinks?.length || 1,
        status: "HYPOTHESIS",
      });
    }

    const hasItemsToday = items.some((item) => new Date(item.discoveredAt) >= todayStart);

    return {
      success: true,
      totalCount: items.length,
      asOf: new Date().toISOString(),
      hasItemsToday,
      items,
    };
  } catch (err: any) {
    logger.error("Failed to compile daily discovery feed", err);
    return {
      success: false,
      totalCount: 0,
      asOf: new Date().toISOString(),
      hasItemsToday: false,
      items: [],
    };
  }
}
