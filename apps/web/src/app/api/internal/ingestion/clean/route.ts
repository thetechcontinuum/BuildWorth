import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@buildworth/database";
import { cleanSyntheticStagingOpportunity } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = checkAuthorization(request);
  if (!auth.authorized) {
    if (auth.reason === "PRODUCTION_REJECTED") {
      return NextResponse.json(
        { error: "Forbidden in production environment" },
        { status: 403, headers: NO_CACHE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    logger.info("Cleaning synthetic staging test records...");
    const stats = await cleanSyntheticStagingOpportunity(prisma);

    let ddlStatus = "OK";
    try {
      await prisma.$executeRawUnsafe(`CREATE TYPE "IngestionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');`).catch((e: any) => {
        ddlStatus += ` [type: ${e?.message}]`;
      });
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ingestion_runs" (
            "id" TEXT NOT NULL,
            "idempotencyKey" TEXT NOT NULL,
            "status" "IngestionRunStatus" NOT NULL DEFAULT 'PENDING'::"IngestionRunStatus",
            "failureCode" TEXT,
            "claimToken" TEXT,
            "lockedBy" TEXT,
            "lockedAt" TIMESTAMP(3),
            "lockedUntil" TIMESTAMP(3),
            "attemptCount" INTEGER NOT NULL DEFAULT 0,
            "totalFetched" INTEGER NOT NULL DEFAULT 0,
            "totalDeduplicated" INTEGER NOT NULL DEFAULT 0,
            "rawSignalsCount" INTEGER NOT NULL DEFAULT 0,
            "candidatesCount" INTEGER NOT NULL DEFAULT 0,
            "publishedCount" INTEGER NOT NULL DEFAULT 0,
            "publishedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "summary" JSONB,
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "failedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
        );
      `).catch((e: any) => {
        ddlStatus += ` [table: ${e?.message}]`;
      });
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_key" ON "ingestion_runs"("idempotencyKey");`).catch(() => {});
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ingestion_runs_status_lockedUntil_idx" ON "ingestion_runs"("status", "lockedUntil");`).catch(() => {});
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_idx" ON "ingestion_runs"("idempotencyKey");`).catch(() => {});
    } catch (e: any) {
      ddlStatus = `ERR: ${e?.message}`;
    }

    return NextResponse.json(
      {
        success: true,
        cleaned: stats,
        ddlStatus,
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error: any) {
    logger.error("Error cleaning synthetic staging records", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to clean synthetic records",
      },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
