import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import {
  verifyPersistentUnsubscribeToken,
  revokePersistentUnsubscribeToken,
} from "@buildworth/opportunity-engine";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";

// GET /api/watchlist/notifications/unsubscribe?token=...
// Scanner-safe: never performs mutations on GET
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "MISSING_UNSUBSCRIBE_TOKEN" },
        {
          status: 400,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }

    const verifyResult = await verifyPersistentUnsubscribeToken(prisma, token);
    if (!verifyResult.valid || !verifyResult.userId) {
      return NextResponse.json(
        { error: "INVALID_OR_EXPIRED_TOKEN" },
        {
          status: 400,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "Referrer-Policy": "no-referrer",
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "TOKEN_VERIFIED: Submit POST to confirm unsubscription.",
        valid: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error: any) {
    logger.error(`GET /api/watchlist/notifications/unsubscribe error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/watchlist/notifications/unsubscribe
// Explicit user confirmation mutation
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const { token } = body;
    if (!token) {
      return NextResponse.json({ error: "MISSING_UNSUBSCRIBE_TOKEN" }, { status: 400 });
    }

    const verifyResult = await verifyPersistentUnsubscribeToken(prisma, token);
    if (!verifyResult.valid || !verifyResult.userId) {
      return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
    }

    const userId = verifyResult.userId;

    // Mutate preferences atomically
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: false,
        instantEnabled: false,
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
      },
      update: {
        emailEnabled: false,
        instantEnabled: false,
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
      },
    });

    // Durable revocation: invalidate token post consumption
    await revokePersistentUnsubscribeToken(prisma, token);

    return NextResponse.json(
      {
        success: true,
        message: "SUCCESSFULLY_UNSUBSCRIBED",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error: any) {
    logger.error(`POST /api/watchlist/notifications/unsubscribe error: ${error?.message}`);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
