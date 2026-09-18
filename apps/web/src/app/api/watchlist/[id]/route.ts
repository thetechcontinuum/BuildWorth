import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";

// PATCH /api/watchlist/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to modify watchlist settings." },
        { status: 401 },
      );
    }

    // CSRF / Origin Verification
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

    const { id } = params;
    const watch = await prisma.savedOpportunity.findFirst({
      where: {
        id,
        userId: sessionUser.id, // Strictly user-isolated
      },
    });

    if (!watch) {
      return NextResponse.json({ error: "WATCHLIST_ITEM_NOT_FOUND" }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const isPro = sessionUser.tier === "PRO";
    const updateData: any = {};

    if (body.radarEnabled !== undefined) updateData.radarEnabled = !!body.radarEnabled;
    if (body.alertCadence !== undefined) {
      updateData.alertCadence = isPro ? body.alertCadence : "WEEKLY_DIGEST";
    }
    if (body.minimumSeverity !== undefined) updateData.minimumSeverity = body.minimumSeverity;
    if (body.minimumConfidenceDelta !== undefined) {
      updateData.minimumConfidenceDelta = Math.max(1, Number(body.minimumConfidenceDelta) || 5);
    }
    if (body.alertOnStatusChange !== undefined)
      updateData.alertOnStatusChange = !!body.alertOnStatusChange;
    if (body.alertOnRecommendationChange !== undefined)
      updateData.alertOnRecommendationChange = !!body.alertOnRecommendationChange;
    if (body.alertOnNewWtpEvidence !== undefined)
      updateData.alertOnNewWtpEvidence = !!body.alertOnNewWtpEvidence;
    if (body.alertOnCostChange !== undefined)
      updateData.alertOnCostChange = !!body.alertOnCostChange;
    if (body.alertOnCompetitorChange !== undefined)
      updateData.alertOnCompetitorChange = !!body.alertOnCompetitorChange;
    if (body.alertOnRiskChange !== undefined)
      updateData.alertOnRiskChange = !!body.alertOnRiskChange;
    if (body.mutedUntil !== undefined) {
      updateData.mutedUntil = body.mutedUntil ? new Date(body.mutedUntil) : null;
    }

    const updated = await prisma.savedOpportunity.update({
      where: { id: watch.id },
      data: updateData,
    });

    return NextResponse.json(
      { success: true, watch: updated },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error: any) {
    logger.error(`PATCH /api/watchlist/[id] error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

// DELETE /api/watchlist/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to remove from watchlist." },
        { status: 401 },
      );
    }

    // CSRF / Origin Verification
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

    const { id } = params;
    const watch = await prisma.savedOpportunity.findFirst({
      where: {
        id,
        userId: sessionUser.id, // Strictly user-isolated
      },
    });

    if (!watch) {
      return NextResponse.json({ error: "WATCHLIST_ITEM_NOT_FOUND" }, { status: 404 });
    }

    // Atomically delete watch and record compensating audit entry safely
    await prisma.$transaction(async (tx: any) => {
      const lockKey =
        Math.abs(
          sessionUser.id
            .split("")
            .reduce((acc: number, char: string) => (acc << 5) - acc + char.charCodeAt(0), 0),
        ) % 2147483647;

      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

      await tx.savedOpportunity.delete({
        where: { id: watch.id },
      });

      // Record compensating ledger entry preserving append-only audit trail
      await tx.usageLedger.create({
        data: {
          userId: sessionUser.id,
          entitlementType: "OPPORTUNITY_RADAR_WATCHLIST",
          unitsConsumed: -1, // Compensating entry
          resourceId: watch.opportunityId,
          actionContext: "RADAR_WATCHLIST_REMOVE",
          periodBucketKey: new Date().toISOString().slice(0, 7),
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "WATCHLIST_ITEM_REMOVED" },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error: any) {
    logger.error(`DELETE /api/watchlist/[id] error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
