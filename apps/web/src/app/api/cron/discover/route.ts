import { NextRequest, NextResponse } from "next/server";
import { executeIntelligencePipeline } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60 seconds execution for AI discovery

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Verify CRON_SECRET if configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("Unauthorized attempt to trigger /api/cron/discover");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("Executing 06:00 AM Cron Discovery Job for new startup opportunities...");

  try {
    const summary = await executeIntelligencePipeline();
    logger.info("06:00 AM Cron Discovery Job completed successfully.", {
      sourcesScanned: summary.sourcesScanned,
      signalsIngested: summary.totalSignalsIngested,
      opportunitiesSynthesized: summary.opportunitiesSynthesized.length,
      durationMs: summary.executionTimeMs
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: summary.executionTimeMs,
      opportunitiesCount: summary.opportunitiesSynthesized.length,
      opportunities: summary.opportunitiesSynthesized.map(o => ({
        slug: o.slug,
        title: o.title,
        opportunityScore: o.scorecard.opportunityScore,
        confidenceScore: o.scorecard.evidenceConfidenceScore,
        economicBuyer: o.economicBuyer
      }))
    });
  } catch (error) {
    logger.error("Error executing 06:00 AM discovery cron job", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error executing discovery cron"
    }, { status: 500 });
  }
}
