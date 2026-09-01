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
    return NextResponse.json(
      {
        success: true,
        cleaned: stats,
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
