import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ status: "ok", sources }, { headers: NO_CACHE_HEADERS });
}
