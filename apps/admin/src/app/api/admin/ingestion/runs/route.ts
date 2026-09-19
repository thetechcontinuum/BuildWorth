import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (status && ["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
    where.status = status;
  }

  try {
    const [total, runs] = await Promise.all([
      prisma.ingestionRun.count({ where }),
      prisma.ingestionRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json(
      {
        runs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch ingestion runs" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
