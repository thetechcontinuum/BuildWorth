import { NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { revokeHashedServerSession } from "@buildworth/database";

export async function POST(request: Request) {
  try {
    const sessionCookie = request.headers.get("cookie") || "";
    const match = sessionCookie.match(/buildworth_session=([^;]+)/);
    const rawSessionToken = match ? match[1] : null;

    if (rawSessionToken) {
      await revokeHashedServerSession(prisma, rawSessionToken);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete("buildworth_session");
    return response;
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
