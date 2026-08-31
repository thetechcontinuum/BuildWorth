import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@buildworth/database";

export const dynamic = "force-dynamic";

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
  if (process.env.VERCEL_ENV === "production" || process.env.BUILDWORTH_ENV === "production") {
    return { authorized: false, reason: "PRODUCTION_REJECTED" };
  }

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

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
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

  const runId = params.runId;
  if (!runId) {
    return NextResponse.json({ error: "Missing runId parameter" }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const run = await prisma.ingestionRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return NextResponse.json({ error: "Ingestion run not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json(
    {
      success: true,
      run: {
        id: run.id,
        idempotencyKey: run.idempotencyKey,
        status: run.status,
        failureCode: run.failureCode,
        attemptCount: run.attemptCount,
        counters: {
          fetched: run.totalFetched,
          deduplicated: run.totalDeduplicated,
          rawSignals: run.rawSignalsCount,
          candidates: run.candidatesCount,
          published: run.publishedCount,
        },
        publishedSlugs: run.publishedSlugs,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        failedAt: run.failedAt,
        summary: run.summary,
      },
    },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
