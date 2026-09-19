import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  return NextResponse.json(
    {
      status: "ok",
      app: "buildworth-admin",
      timestamp: new Date().toISOString(),
      adminId: auth.admin.id,
    },
    { headers: NO_CACHE_HEADERS },
  );
}
