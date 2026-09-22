import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { executeManualStagingIngestion, verifyCronAuthorization } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleScheduledIngestion(request);
}

export async function POST(request: NextRequest) {
  return handleScheduledIngestion(request);
}

async function handleScheduledIngestion(request: NextRequest) {
  // 1. Strict Authenticated Caller Check via shared verifyCronAuthorization
  const hasQueryParamsSecret =
    request.nextUrl.searchParams.has("secret") ||
    request.nextUrl.searchParams.has("key") ||
    request.nextUrl.searchParams.has("cron_secret");

  const authResult = verifyCronAuthorization({
    authorizationHeader: request.headers.get("authorization"),
    hasQueryParamsSecret,
    serverCronSecret: process.env.CRON_SECRET,
    userAgent: request.headers.get("user-agent"),
    vercelCronHeader: request.headers.get("x-vercel-cron"),
    vercelCronSchedule: request.headers.get("x-vercel-cron-schedule"),
  });

  if (!authResult.authorized) {
    if (authResult.statusCode === 403) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }
    logger.warn("Unauthorized attempt to trigger production ingestion cron", {
      statusCode: authResult.statusCode,
      hasAuthHeader: !!request.headers.get("authorization"),
    });
    return NextResponse.json(
      { error: authResult.error || "Unauthorized: Valid Cron authentication required" },
      { status: authResult.statusCode },
    );
  }

  // Diagnostic metadata only - attacker-controlled headers must never replace Authorization
  if (authResult.diagnostics?.hasVercelCronHeader || authResult.diagnostics?.cronSchedule) {
    logger.info("Cron invocation authenticated with Vercel diagnostic headers present", {
      hasVercelCronHeader: authResult.diagnostics.hasVercelCronHeader,
      cronSchedule: authResult.diagnostics.cronSchedule,
    });
  }

  logger.info("Executing scheduled production ingestion job...");

  // Generate bounded idempotency key matching current 6-hour window or exact trigger
  const hourBucket = Math.floor(Date.now() / (6 * 3600 * 1000));
  const idempotencyKey = `cron-prod-ingest-${hourBucket}-${new Date().toISOString().slice(0, 10)}`;

  try {
    const result = await executeManualStagingIngestion(prisma, {
      idempotencyKey,
      workerId: "cron-worker-" + crypto.randomBytes(4).toString("hex"),
      leaseDurationMs: 45000,
      executionTimeoutMs: 50000,
      maxSources: 3,
      maxFetchItems: 25,
      maxRawSignals: 20,
      maxCandidates: 3,
      maxPublishedOpportunities: 3,
      // Strictly approved genuine sources only:
      targetSourceKeys: ["hackernews", "github", "krasia"],
      cleanSyntheticPrior: false,
    });

    logger.info("Scheduled production ingestion completed", {
      runId: result.runId,
      status: result.status,
      counters: result.counters,
    });

    return NextResponse.json({
      success: result.status === "COMPLETED",
      runId: result.runId,
      status: result.status,
      failureCode: result.failureCode || null,
      counters: result.counters,
      publishedSlugs: result.publishedSlugs,
      startedAt: result.startedAt,
      completedAt: result.completedAt || null,
    });
  } catch (error: any) {
    logger.error("Error executing scheduled production ingestion job", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_INGESTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error during ingestion",
      },
      { status: 500 },
    );
  }
}
