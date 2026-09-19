import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const run = await prisma.ingestionRun.findUnique({
      where: { id: params.id },
    });

    if (!run) {
      return NextResponse.json({ error: "Ingestion run not found" }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({ run }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch ingestion run" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
