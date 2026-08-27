import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";

// GET /api/watchlist
export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to view your watchlist." },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            Vary: "Cookie",
          },
        },
      );
    }

    const watches = await prisma.savedOpportunity.findMany({
      where: { userId: sessionUser.id },
      include: {
        opportunity: {
          select: {
            id: true,
            title: true,
            slug: true,
            industry: true,
            publicationQualityStatus: true,
            decisionRecommendation: true,
            scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
            oneSentenceSummary: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        radarEvaluations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            changeEvent: {
              include: {
                items: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        watches,
        userTier: sessionUser.tier,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          Vary: "Cookie",
        },
      },
    );
  } catch (error: any) {
    logger.error(`GET /api/watchlist error: ${error?.message}`);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  }
}

// POST /api/watchlist
export async function POST(request: NextRequest) {
  try {
    // 1. Session Authentication
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to add an opportunity to your watchlist." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
        },
      );
    }

    // 2. CSRF / Origin Verification
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: "FORBIDDEN: Cross-site request rejected." },
          { status: 403 },
        );
      }
    }

    // 3. Request Body Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const {
      opportunityId,
      radarEnabled = true,
      alertCadence = sessionUser.tier === "PRO" ? "INSTANT" : "WEEKLY_DIGEST",
      minimumSeverity = "MEDIUM",
      minimumConfidenceDelta = 5,
      alertOnStatusChange = true,
      alertOnRecommendationChange = true,
      alertOnNewWtpEvidence = true,
      alertOnCostChange = true,
      alertOnCompetitorChange = true,
      alertOnRiskChange = true,
    } = body;

    if (!opportunityId || typeof opportunityId !== "string") {
      return NextResponse.json({ error: "MISSING_OPPORTUNITY_ID" }, { status: 400 });
    }

    // 4. Verify Opportunity Exists & is Publicly Accessible
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "OPPORTUNITY_NOT_FOUND" }, { status: 404 });
    }

    // 5. Check if already saved (idempotent repeat)
    const existingWatch = await prisma.savedOpportunity.findUnique({
      where: {
        userId_opportunityId: {
          userId: sessionUser.id,
          opportunityId,
        },
      },
    });

    if (existingWatch) {
      return NextResponse.json(
        {
          success: true,
          watch: existingWatch,
          message: "OPPORTUNITY_ALREADY_WATCHED",
        },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
        },
      );
    }

    // 6. Transactional Capacity Enforcement (Free max 3, Pro max 50)
    // We execute inside an isolated transaction with per-user PostgreSQL advisory lock
    const watch = await prisma.$transaction(async (tx: any) => {
      const lockKey =
        Math.abs(
          sessionUser.id
            .split("")
            .reduce((acc: number, char: string) => (acc << 5) - acc + char.charCodeAt(0), 0),
        ) % 2147483647;

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

      // Recheck active watches count under lock
      const currentWatches = await tx.savedOpportunity.count({
        where: { userId: sessionUser.id },
      });

      const isPro = sessionUser.tier === "PRO";
      const maxAllowed = isPro ? 50 : 3;

      if (currentWatches >= maxAllowed) {
        throw new Error(
          `WATCHLIST_LIMIT_EXCEEDED: You can watch up to ${maxAllowed} opportunities on the ${sessionUser.tier} plan.`,
        );
      }

      // Record immutable ledger entry for append-only audit tracking
      await tx.usageLedger.create({
        data: {
          userId: sessionUser.id,
          entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
          unitsConsumed: 1,
          resourceId: opportunityId,
          actionContext: "RADAR_WATCHLIST_ADD",
          periodBucketKey: new Date().toISOString().slice(0, 7),
        },
      });

      // 7. Insert SavedOpportunity Watch Record
      return await tx.savedOpportunity.create({
        data: {
          userId: sessionUser.id,
          opportunityId,
          radarEnabled: !!radarEnabled,
          alertCadence: isPro ? alertCadence : "WEEKLY_DIGEST",
          minimumSeverity,
          minimumConfidenceDelta: Math.max(1, Number(minimumConfidenceDelta) || 5),
          alertOnStatusChange: !!alertOnStatusChange,
          alertOnRecommendationChange: !!alertOnRecommendationChange,
          alertOnNewWtpEvidence: !!alertOnNewWtpEvidence,
          alertOnCostChange: !!alertOnCostChange,
          alertOnCompetitorChange: !!alertOnCompetitorChange,
          alertOnRiskChange: !!alertOnRiskChange,
          lastEvaluatedRevisionId: opportunity.currentRevisionId || null,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        watch,
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error: any) {
    if (error?.message?.includes("WATCHLIST_LIMIT_EXCEEDED")) {
      return NextResponse.json(
        {
          error: error.message,
          upgradeRequired: true,
        },
        {
          status: 403,
          headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
        },
      );
    }
    logger.error(`POST /api/watchlist error: ${error?.message}`);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  }
}
