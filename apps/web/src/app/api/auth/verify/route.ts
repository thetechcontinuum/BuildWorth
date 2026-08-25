import { NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { verifyPasswordlessToken } from "@buildworth/database";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 415 });
    }

    const body = await request.json();
    const { token, email } = body || {};

    if (!token || typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
    }

    const result = await verifyPasswordlessToken(prisma, token, email);

    if (!result.success || !result.sessionToken) {
      return NextResponse.json({ error: result.error || "VERIFICATION_FAILED" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    const isProd = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: "buildworth_session",
      value: result.sessionToken,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
