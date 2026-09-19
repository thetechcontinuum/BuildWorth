import { NextRequest, NextResponse } from "next/server";
import { prisma, revokeHashedServerSession } from "@buildworth/database";
import { getSessionTokenFromRequest, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    await revokeHashedServerSession(prisma, token).catch(() => {});
  }

  const response = NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  response.cookies.delete("admin_session");
  response.cookies.delete("buildworth_session");
  return response;
}
