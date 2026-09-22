import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { getDailyDiscoveryFeed } from "@buildworth/opportunity-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 5;

    const feed = await getDailyDiscoveryFeed(prisma, { limit });

    return NextResponse.json(feed, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        totalCount: 0,
        asOf: new Date().toISOString(),
        hasItemsToday: false,
        items: [],
        error: "INTERNAL_FEED_ERROR",
      },
      { status: 500 },
    );
  }
}
