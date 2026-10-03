import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@buildworth/database";
import { executeManualStagingIngestion, verifyCronAuthorization, getDailyCronIdempotencyKey } from "@buildworth/opportunity-engine";
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

  // Deterministic per-UTC-day idempotency key shared across primary Vercel Cron and fallback schedulers,
  // with support for authorized explicit idempotency keys and on-demand force retries
  let customIdempotencyKey: string | undefined = undefined;
  let forceRetry = false;

  const headerIdempotencyKey = request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key");
  if (headerIdempotencyKey && /^[a-zA-Z0-9_-]+$/.test(headerIdempotencyKey.trim())) {
    customIdempotencyKey = headerIdempotencyKey.trim();
  }

  if (request.method === "POST") {
    try {
      const body = await request.clone().json().catch(() => null);
      if (body && typeof body === "object") {
        if (body.idempotencyKey && typeof body.idempotencyKey === "string" && /^[a-zA-Z0-9_-]+$/.test(body.idempotencyKey.trim())) {
          customIdempotencyKey = body.idempotencyKey.trim();
        }
        if (body.force === true || body.forceRetry === true) {
          forceRetry = true;
        }
      }
    } catch {
      // Body parsing optional
    }
  }

  const idempotencyKey = customIdempotencyKey || getDailyCronIdempotencyKey();

  try {
    const result = await executeManualStagingIngestion(prisma, {
      idempotencyKey,
      forceRetry,
      workerId: "cron-worker-" + crypto.randomBytes(4).toString("hex"),
      leaseDurationMs: 40000,
      executionTimeoutMs: 38000,
      maxSources: 10,
      maxFetchItems: 40,
      maxRawSignals: 25,
      maxCandidates: 5,
      maxPublishedOpportunities: 3,
      // Strictly approved genuine sources only (prioritizing new sources, no synthetic, no Product Hunt):
      targetSourceKeys: [
        "ted",
        "stackexchange",
        "cisakev",
        "arxiv",
        "samgov",
        "hackernews",
        "github",
        "krasia",
        "siliconcanals",
        "lobsters",
      ],
      cleanSyntheticPrior: false,
    });

    logger.info("Scheduled production ingestion completed", {
      runId: result.runId,
      status: result.status,
      counters: result.counters,
    });

    if (result.status === "COMPLETED") {
      try {
        revalidatePath("/");
        revalidatePath("/opportunities");
        revalidateTag("discovery-feed");
      } catch (revErr: any) {
        logger.warn("Cache revalidation notice after cron execution", { error: revErr?.message });
      }
    }

    return NextResponse.json({
      success: result.status === "COMPLETED",
      runId: result.runId,
      status: result.status,
      failureCode: result.failureCode || null,
      counters: result.counters,
      perSourceStats: result.summary?.perSourceStats || null,
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
