import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { generateUnsubscribeToken } from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";

// GET /api/watchlist/notifications/preferences
export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to manage notification preferences." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
        },
      );
    }

    let pref = await prisma.notificationPreference.findUnique({
      where: { userId: sessionUser.id },
    });

    if (!pref) {
      pref = await prisma.notificationPreference.create({
        data: {
          userId: sessionUser.id,
          unsubscribeToken: generateUnsubscribeToken(sessionUser.id),
        },
      });
    }

    return NextResponse.json(
      { success: true, preferences: pref, userTier: sessionUser.tier },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error: any) {
    logger.error(`GET /api/watchlist/notifications/preferences error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

// PATCH /api/watchlist/notifications/preferences
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: You must be signed in to update notification preferences." },
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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const isPro = sessionUser.tier === "PRO";
    const updateData: any = {};

    if (body.emailEnabled !== undefined) updateData.emailEnabled = !!body.emailEnabled;
    if (body.instantEnabled !== undefined) {
      updateData.instantEnabled = isPro ? !!body.instantEnabled : false;
    }
    if (body.dailyDigestEnabled !== undefined) {
      updateData.dailyDigestEnabled = isPro ? !!body.dailyDigestEnabled : false;
    }
    if (body.weeklyDigestEnabled !== undefined) {
      updateData.weeklyDigestEnabled = !!body.weeklyDigestEnabled;
    }
    if (body.timezone !== undefined) updateData.timezone = String(body.timezone).slice(0, 50);
    if (body.quietHoursStart !== undefined) {
      updateData.quietHoursStart =
        body.quietHoursStart === null
          ? null
          : Math.max(0, Math.min(23, Number(body.quietHoursStart)));
    }
    if (body.quietHoursEnd !== undefined) {
      updateData.quietHoursEnd =
        body.quietHoursEnd === null ? null : Math.max(0, Math.min(23, Number(body.quietHoursEnd)));
    }

    const pref = await prisma.notificationPreference.upsert({
      where: { userId: sessionUser.id },
      create: {
        userId: sessionUser.id,
        unsubscribeToken: generateUnsubscribeToken(sessionUser.id),
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json(
      { success: true, preferences: pref },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error: any) {
    logger.error(`PATCH /api/watchlist/notifications/preferences error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
