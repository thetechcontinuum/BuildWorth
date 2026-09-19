import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { executeManualStagingIngestion } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim());
  const bufB = Buffer.from(b.trim());
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
  return handleScheduledIngestion(request);
}

export async function POST(request: NextRequest) {
  return handleScheduledIngestion(request);
}

async function handleScheduledIngestion(request: NextRequest) {
  // 1. Strict Authenticated Caller Check
  // Reject if secrets are passed in query params
  if (
    request.nextUrl.searchParams.has("secret") ||
    request.nextUrl.searchParams.has("key") ||
    request.nextUrl.searchParams.has("cron_secret")
  ) {
    return NextResponse.json({ error: "Query secrets are strictly forbidden" }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.includes("vercel-cron");

  let isAuthorized = false;

  if (isVercelCron) {
    isAuthorized = true;
  } else if (cronSecret && cronSecret.trim().length >= 16) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (timingSafeEqualStr(token, cronSecret)) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    logger.warn("Unauthorized attempt to trigger production ingestion cron");
    return NextResponse.json({ error: "Unauthorized: Valid Cron authentication required" }, { status: 401 });
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
