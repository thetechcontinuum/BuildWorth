import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const records = await prisma.aiSpendLedgerRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalCostMinorUnits = records.reduce((acc, r) => acc + r.costMinorUnits, 0);

  return NextResponse.json(
    {
      status: "ok",
      totalCostMinorUnits,
      records,
    },
    { headers: NO_CACHE_HEADERS },
  );
}
