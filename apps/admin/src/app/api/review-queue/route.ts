import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { status: { in: ["DRAFT", "IN_REVIEW"] }, isDemoFixture: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    {
      status: "ok",
      queueCount: opportunities.length,
      items: opportunities,
    },
    { headers: NO_CACHE_HEADERS },
  );
}
