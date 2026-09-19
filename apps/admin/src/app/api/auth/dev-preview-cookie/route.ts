import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host || "";
  const hostname = host.split(":")[0];
  const isLocalhostHost = hostname === "localhost" || hostname === "127.0.0.1";
  const isDevTokenEnabled = process.env.ENABLE_LOCALHOST_DEV_TOKEN === "true";
  const isNotProduction = process.env.NODE_ENV !== "production";
  const isVercelAllowed = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development";

  // Strict gating: Unavailable in Preview, Staging, Production or without explicit localhost token flag
  if (!isLocalhostHost || !isDevTokenEnabled || !isNotProduction || !isVercelAllowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const redirectPath = searchParams.get("redirect") || "/";

  const response = NextResponse.redirect(new URL(redirectPath, request.url));
  response.cookies.set("admin_session", "dev-admin-preview-session-token-2026", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}

