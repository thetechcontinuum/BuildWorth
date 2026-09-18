import { NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { resolveHashedServerSession } from "@buildworth/database";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/buildworth_session=([^;]+)/);
    const sessionToken = match && match[1] ? decodeURIComponent(match[1]) : null;

    if (!sessionToken) {
      return NextResponse.json(
        { user: null },
        { status: 200, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const sessionUser = await resolveHashedServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        { user: null },
        { status: 200, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      {
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.name || sessionUser.email.split("@")[0],
          role: sessionUser.role,
          tier: sessionUser.tier,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
