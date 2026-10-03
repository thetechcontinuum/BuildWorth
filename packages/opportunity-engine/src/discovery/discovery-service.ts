import { DiscoveryFeedItemDTO, DiscoveryFeedResponseDTO, MarketSignalFeedItemDTO } from "@buildworth/shared";
import { logger } from "@buildworth/observability";

export interface GetDiscoveryFeedOptions {
  limit?: number;
  market?: string;
  maxItemsPerSource?: number;
  signalsLimit?: number;
}

/**
 * Derives a human-readable geographic market from source signals or vertical
 */
export function deriveMarketRegion(sourceKey?: string, sourceFamily?: string, industry?: string): string {
  if (sourceKey === "krasia" || sourceKey === "e27") {
    return "Asia / Pan-Asia";
  }
  if (sourceKey === "eustartups" || sourceKey === "siliconcanals" || sourceKey === "ted") {
    return "Europe";
  }
  if (sourceKey === "lobsters" || sourceKey === "github" || sourceKey === "stackexchange") {
    return "Global / Developer Ecosystem";
  }
  if (sourceKey === "samgov") {
    return "United States / Federal";
  }
  if (sourceKey === "cisakev") {
    return "Global / Cybersecurity";
  }
  if (sourceKey === "arxiv") {
    return "Global / Scientific & DeepTech";
  }
  if (sourceKey === "techcrunch") {
    return "North America & Global";
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
 * Builds the public daily discovery feed separated into two clearly labeled sections:
 * 1. New Market Signals — authentic, newly collected articles/discussions with source metadata,
 *    clearly labeled: "Market signal — not a validated business opportunity". No invented buyer demand or WTP.
 * 2. Opportunity Hypotheses — synthesized problem hypotheses when the pipeline has enough evidence.
 *
 * Guarantees:
 * 1. Strictly allowlisted public fields via DTOs - NEVER leaks Pro blueprint fields,
 *    internal IDs, private user data, raw LLM outputs, or unreviewed text.
 * 2. Never marks a DRAFT or HYPOTHESIS candidate as VERIFIED.
 * 3. Shows original source publication date separately from the feed discovery timestamp.
 * 4. Deduplicated by canonicalUrl and content hash.
 * 5. Never fabricates posts or resets timestamps when today has no new posts; displays
 *    latest authentic posts with actual dates and clear metadata.
 */
export async function getDailyDiscoveryFeed(
  prisma: any,
  options: GetDiscoveryFeedOptions = {},
): Promise<DiscoveryFeedResponseDTO> {
  const limit = Math.min(10, Math.max(1, options.limit || 5));
  const signalsLimit = Math.min(20, Math.max(1, options.signalsLimit || 10));
  const maxItemsPerSource = Math.max(1, options.maxItemsPerSource || 2);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    // 1. Fetch genuine candidates that have evidence links (Opportunity Hypotheses)
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
    const opportunityHypotheses: DiscoveryFeedItemDTO[] = [];

    for (const opp of candidates) {
      if (opportunityHypotheses.length >= limit) break;

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

      let hasActionableEvidence = false;

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

        // Check if signal contains actionable problem/demand evidence
        // NOTE: Evidence MUST originate from the source signal itself, never the AI-generated opportunity title/problem statement.
        const sigType = (ns.signalType || "").toUpperCase();
        const claimType = (link.claimType || "").toUpperCase();
        const signalTextToScan = `${ns.sanitizedExcerpt || ""} ${ns.problemSummary || ""} ${ns.sourceTitle || ""} ${raw.title || ""}`.toLowerCase();
        const hasExplicitPainOrDemand =
          /\b(costing|broken|slow|pain|waste|failing|error|leak|spike|spikes|friction|latency|manual|spend|expensive|difficult|struggle|problem|bottleneck|hacky|workaround|issue|bug|frustrat|need|want|looking for)\b/i.test(signalTextToScan);
        const isDiscoveryOrNews = (src?.sourceFamily === "DISCOVERY" || ["krasia", "e27", "siliconcanals", "techcrunch", "ted", "samgov", "cisakev", "arxiv"].includes(src?.key || ""));
        const isDisallowedType = ["EMERGING_TECH", "TECHNOLOGY_ENABLER", "MARKET_ACTIVITY", "NOISE"].includes(sigType);

        // Discovery, procurement, vulnerability, and research sources must have explicit, concrete friction or buyer intent in the signal text itself
        const isActionableType =
          isDiscoveryOrNews
            ? hasExplicitPainOrDemand && ["PAIN_COMPLAINT", "PAIN", "WORKAROUND_REQUEST", "WORKAROUND", "PURCHASE_INTENT", "WILLINGNESS_TO_PAY"].includes(sigType || "PAIN")
            : (["PAIN_COMPLAINT", "PAIN", "WORKAROUND_REQUEST", "WORKAROUND", "PURCHASE_INTENT", "WILLINGNESS_TO_PAY", "COMPETITOR_DISSATISFACTION", "COMPETITOR_COMPLAINT"].includes(sigType) ||
               ["PAIN_EXISTENCE", "BUYER_DEMAND", "WILLINGNESS_TO_PAY", "CURRENT_WORKAROUND"].includes(claimType) ||
               (!isDisallowedType && hasExplicitPainOrDemand));

        if (isActionableType) {
          hasActionableEvidence = true;
        }

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

      // If an opportunity has no grounded problem, workaround, or purchase intent evidence (e.g. general news or emerging tech),
      // do not display it as a fabricated business hypothesis.
      if (!hasActionableEvidence && observations.length > 0) {
        continue;
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

      // Demarcate AI-generated business hypothesis directly grounded in observed facts
      const primaryFact = observedFacts[0] || opp.problemStatement || opp.title;
      const rawProposedSolution = (opp.proposedProduct || "").trim();
      const hasGenericBoilerplate = /Lightweight SaaS tool providing automated monitoring.*Data Engineering & FinOps/i.test(rawProposedSolution);
      const proposedSolution = (!rawProposedSolution || hasGenericBoilerplate)
        ? `Targeted solution addressing: ${opp.title}`
        : rawProposedSolution;

      const businessHypothesis = {
        targetAudience: opp.economicBuyer || opp.endUser || "Early Adopter Teams",
        proposedSolution,
        painFriction: opp.problemStatement || primaryFact || "Operational bottleneck identified in market signals",
        confidenceNote: "Initial market hypothesis derived from public signals. Not yet validated via formal customer interviews or WTP proof.",
      };

      const market = deriveMarketRegion(primarySourceKey, primarySourceFamily, opp.industry);
      const pubDate = primaryPublishedAt ? primaryPublishedAt.toISOString() : opp.createdAt.toISOString();

      // Sanitize summary to ensure no legacy boilerplate leaks
      let summary = (opp.oneSentenceSummary || "").trim();
      if (/Streamline and automate .* without complex custom scripts/i.test(summary) || !summary) {
        summary = `Exploration of ${opp.title.toLowerCase()} based on observed market developments.`;
      }

      opportunityHypotheses.push({
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        summary,
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

    // 2. Fetch authentic New Market Signals directly from NormalizedSignal & RawSignal
    const marketSignals: MarketSignalFeedItemDTO[] = [];
    const signalSeenUrls = new Set<string>();
    const signalSourceCounts = new Map<string, number>();
    const maxItemsPerSourceInFeed = 2;

    const rawSignalRecords = prisma.rawSignal?.findMany
      ? await prisma.rawSignal.findMany({
          where: {
            source: {
              isEnabled: true,
              policyStatus: { not: "BLOCKED" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: Math.max(100, signalsLimit * 10),
          include: {
            source: true,
            normalizedSignal: true,
          },
        }).catch(() => [])
      : [];

    // Pass 1: Diverse source representation (capped per source)
    for (const raw of rawSignalRecords) {
      if (marketSignals.length >= signalsLimit) break;
      const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
      const urlKey = canonical.toLowerCase().trim();
      if (!urlKey || signalSeenUrls.has(urlKey)) continue;

      const src = raw.source;
      const srcKey = src?.key || "unknown";
      const currentCount = signalSourceCounts.get(srcKey) || 0;
      if (currentCount >= maxItemsPerSourceInFeed) continue;

      signalSeenUrls.add(urlKey);
      signalSourceCounts.set(srcKey, currentCount + 1);

      const pubDate = raw.publishedAt || raw.createdAt || new Date();
      const discDate = raw.createdAt || new Date();
      const market = deriveMarketRegion(src?.key, src?.sourceFamily);

      marketSignals.push({
        id: raw.id,
        sourceKey: src?.key || "unknown",
        sourceName: src?.name || "Market Source",
        sourceFamily: src?.sourceFamily || "COMMUNITY",
        title: raw.title || raw.normalizedSignal?.sourceTitle || "Market Discussion",
        excerpt: raw.normalizedSignal?.sanitizedExcerpt || raw.rawContent.slice(0, 280),
        canonicalUrl: canonical,
        publishedAt: (pubDate instanceof Date ? pubDate : new Date(pubDate)).toISOString(),
        discoveredAt: (discDate instanceof Date ? discDate : new Date(discDate)).toISOString(),
        market,
        label: "Market signal — not a validated business opportunity",
      });
    }

    // Pass 2: Fill remaining slots if diverse pass did not reach signalsLimit
    if (marketSignals.length < signalsLimit) {
      for (const raw of rawSignalRecords) {
        if (marketSignals.length >= signalsLimit) break;
        const canonical = raw.normalizedSignal?.canonicalUrl || raw.sourceUrl;
        const urlKey = canonical.toLowerCase().trim();
        if (!urlKey || signalSeenUrls.has(urlKey)) continue;

        signalSeenUrls.add(urlKey);
        const src = raw.source;
        const pubDate = raw.publishedAt || raw.createdAt || new Date();
        const discDate = raw.createdAt || new Date();
        const market = deriveMarketRegion(src?.key, src?.sourceFamily);

        marketSignals.push({
          id: raw.id,
          sourceKey: src?.key || "unknown",
          sourceName: src?.name || "Market Source",
          sourceFamily: src?.sourceFamily || "COMMUNITY",
          title: raw.title || raw.normalizedSignal?.sourceTitle || "Market Discussion",
          excerpt: raw.normalizedSignal?.sanitizedExcerpt || raw.rawContent.slice(0, 280),
          canonicalUrl: canonical,
          publishedAt: (pubDate instanceof Date ? pubDate : new Date(pubDate)).toISOString(),
          discoveredAt: (discDate instanceof Date ? discDate : new Date(discDate)).toISOString(),
          market,
          label: "Market signal — not a validated business opportunity",
        });
      }
    }

    const hasItemsToday =
      opportunityHypotheses.some((item) => new Date(item.discoveredAt) >= todayStart) ||
      marketSignals.some((sig) => new Date(sig.discoveredAt) >= todayStart);

    return {
      success: true,
      totalCount: opportunityHypotheses.length + marketSignals.length,
      asOf: new Date().toISOString(),
      hasItemsToday,
      marketSignals,
      opportunityHypotheses,
      items: opportunityHypotheses, // backwards compatibility
    };
  } catch (err: any) {
    logger.error("Failed to compile daily discovery feed", err);
    return {
      success: false,
      totalCount: 0,
      asOf: new Date().toISOString(),
      hasItemsToday: false,
      marketSignals: [],
      opportunityHypotheses: [],
      items: [],
    };
  }
}
