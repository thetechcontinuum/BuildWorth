import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@buildworth/database";
import { executeManualStagingIngestion } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";
import { addStoredOpportunity } from "@/lib/opportunity-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkAuthorization(request: NextRequest): { authorized: boolean; reason?: string } {
  // Reject production
  if (process.env.VERCEL_ENV === "production" || process.env.BUILDWORTH_ENV === "production") {
    return { authorized: false, reason: "PRODUCTION_REJECTED" };
  }

  // Never accept secrets in query parameters
  if (
    request.nextUrl.searchParams.has("secret") ||
    request.nextUrl.searchParams.has("key") ||
    request.nextUrl.searchParams.has("cron_secret")
  ) {
    return { authorized: false, reason: "QUERY_SECRET_FORBIDDEN" };
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    return { authorized: false, reason: "CRON_SECRET_UNCONFIGURED" };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, reason: "MISSING_BEARER_TOKEN" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!timingSafeEqualStr(token, cronSecret)) {
    return { authorized: false, reason: "INVALID_SECRET" };
  }

  return { authorized: true };
}

export async function POST(request: NextRequest) {
  const auth = checkAuthorization(request);
  if (!auth.authorized) {
    if (auth.reason === "PRODUCTION_REJECTED") {
      return NextResponse.json(
        { error: "Manual staging ingestion is forbidden in production environment" },
        { status: 403, headers: NO_CACHE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  // Require valid Idempotency-Key
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "Invalid or missing Idempotency-Key header. Must be 8-128 alphanumeric/dash characters." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  logger.info("Executing staging manual ingestion endpoint", { idempotencyKey });

  try {
    const result = await executeManualStagingIngestion(prisma, {
      idempotencyKey,
      executionTimeoutMs: 50000,
    });

    if (result.failureCode === "CONCURRENT_RUN_IN_PROGRESS") {
      return NextResponse.json(
        { error: "Another ingestion run is currently in progress", run: result },
        { status: 409, headers: NO_CACHE_HEADERS },
      );
    }

    if (result.failureCode === "NO_ACTIVE_SOURCES") {
      return NextResponse.json(
        { error: "NO_ACTIVE_SOURCES", message: "No active approved sources configured in staging database", run: result },
        { status: 422, headers: NO_CACHE_HEADERS },
      );
    }

    if (result.failureCode === "AI_PROVIDER_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "AI_PROVIDER_NOT_CONFIGURED", message: "Staging AI provider is not configured", run: result },
        { status: 503, headers: NO_CACHE_HEADERS },
      );
    }

    // Sync newly published opportunities into memory store for immediate UI visibility
    if (result.publishedSlugs && result.publishedSlugs.length > 0) {
      for (const slug of result.publishedSlugs) {
        const opp = await prisma.opportunity.findUnique({
          where: { slug },
          include: { scorecards: { include: { dimensions: true } } },
        });
        if (opp) {
          const scorecard = opp.scorecards[0];
          addStoredOpportunity({
            slug: opp.slug,
            title: opp.title,
            summary: opp.oneSentenceSummary,
            industry: opp.industry,
            customerType: opp.customerType,
            opportunityScore: scorecard?.opportunityScore || 85,
            confidenceScore: scorecard?.evidenceConfidenceScore || 80,
            publicationQualityStatus: opp.publicationQualityStatus,
            isDemoFixture: false,
            costRange: {
              minMinor: opp.estimatedMvpCostMinCents,
              maxMinor: opp.estimatedMvpCostMaxCents,
              currency: "USD",
            },
            timeToMvpWeeks: {
              min: opp.estimatedTimeToMvpMinWeeks,
              max: opp.estimatedTimeToMvpMaxWeeks,
            },
            buyer: opp.economicBuyer,
            signalsCount: 5,
            recommendedExperiment: opp.recommendedNextExperiment,
            jobsToBeDone: opp.jobsToBeDone,
            narrowMvpScope: opp.narrowMvpScope,
            existingWorkflow: opp.existingWorkflow,
            buyingTrigger: opp.buyingTrigger,
            dimensionBreakdown: (scorecard?.dimensions || []).map((dim: any) => ({
              name: dim.name,
              score: dim.score,
              maxScore: dim.maxScore,
              explanation: dim.explanation,
            })),
            publishedAt: opp.createdAt.toISOString(),
            evidenceLinks: [],
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: result.status === "COMPLETED",
        run: result,
      },
      {
        status: result.status === "COMPLETED" ? 200 : 500,
        headers: NO_CACHE_HEADERS,
      },
    );
  } catch (error) {
    logger.error("Unhandled error in staging ingestion endpoint", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal ingestion failure",
      },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
