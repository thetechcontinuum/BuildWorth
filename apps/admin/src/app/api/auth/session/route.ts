import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return NextResponse.json({ admin: null }, { status: 200, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json(
    {
      admin: {
        id: auth.admin.id,
        email: auth.admin.email,
        name: auth.admin.name || auth.admin.email.split("@")[0],
        role: auth.admin.role,
      },
    },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
