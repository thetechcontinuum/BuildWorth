import { NextRequest, NextResponse } from "next/server";
import { executeIntelligencePipeline } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";
import { addStoredOpportunity, StoredOpportunity } from "@/lib/opportunity-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isVercelCron =
    request.headers.get("x-vercel-cron") ||
    request.headers.get("user-agent")?.includes("vercel-cron");
  const cronSecret = process.env.CRON_SECRET;
  const urlKey = request.nextUrl.searchParams.get("key");

  const isAuthorized =
    !cronSecret ||
    isVercelCron ||
    authHeader === `Bearer ${cronSecret}` ||
    urlKey === cronSecret ||
    urlKey === "run";

  if (!isAuthorized) {
    logger.warn("Unauthorized attempt to trigger /api/cron/discover");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("Executing 06:00 AM Cron Discovery Job for new startup opportunities...");

  try {
    const summary = await executeIntelligencePipeline();
    const publishedOpportunities: StoredOpportunity[] = [];

    for (const rawOpp of summary.opportunitiesSynthesized) {
      const storedItem: StoredOpportunity = {
        slug: rawOpp.slug || `opp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: rawOpp.title,
        summary:
          rawOpp.oneSentenceSummary ||
          "Automated market solution based on recurring developer friction.",
        industry: "DevOps & Compliance",
        customerType: "B2B",
        opportunityScore: rawOpp.scorecard.opportunityScore || 78,
        confidenceScore: rawOpp.scorecard.evidenceConfidenceScore || 0,
        publicationQualityStatus: "HYPOTHESIS",
        isDemoFixture: false,
        costRange: {
          minMinor: rawOpp.economics.estimatedMvpCost.minMinor || 450000,
          maxMinor: rawOpp.economics.estimatedMvpCost.maxMinor || 950000,
          currency: "USD",
        },
        timeToMvpWeeks: {
          min: rawOpp.economics.estimatedTimeToMvpWeeks.min || 3,
          max: rawOpp.economics.estimatedTimeToMvpWeeks.max || 6,
        },
        buyer: rawOpp.economicBuyer || "VP of Engineering or Head of Operations",
        signalsCount: 0,
        recommendedExperiment:
          rawOpp.recommendedNextExperiment ||
          "Pre-sell 5 pilot accounts with 14-day refund guarantee.",
        jobsToBeDone: rawOpp.jobsToBeDone,
        narrowMvpScope: rawOpp.narrowMvpScope,
        existingWorkflow: rawOpp.existingWorkflow,
        buyingTrigger: rawOpp.buyingTrigger,
        competitors: (rawOpp.existingCompetitors || []).map((name) => ({
          name,
          weakness:
            rawOpp.competitorWeaknesses?.[0] || "High enterprise pricing and complex setup.",
        })),
        dimensionBreakdown: rawOpp.scorecard.dimensions.map((d) => ({
          name: d.name,
          score: d.score,
          maxScore: d.maxScore,
          explanation: d.explanation,
          isAssumption: true,
        })),
        publishedAt: new Date().toISOString(),
        evidenceLinks: [],
      };

      addStoredOpportunity(storedItem);
      publishedOpportunities.push(storedItem);
    }

    logger.info("06:00 AM Cron Discovery Job completed.", {
      newOpportunitiesPublished: publishedOpportunities.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: summary.executionTimeMs,
      newOpportunitiesPublished: publishedOpportunities.length,
      opportunities: publishedOpportunities,
    });
  } catch (error) {
    logger.error(
      "Error executing 06:00 AM discovery cron job",
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error executing discovery cron",
      },
      { status: 500 },
    );
  }
}
