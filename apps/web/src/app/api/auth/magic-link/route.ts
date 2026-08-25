import { NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { initiatePasswordlessLogin } from "@buildworth/database";
import { checkAndIncrementRateLimit, hashRateLimitKey } from "@buildworth/database";
import { sendMagicLinkEmail } from "@buildworth/database";

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const configuredAppUrl = new URL(process.env.APP_URL || "http://localhost:3000");
    if (originUrl.origin === configuredAppUrl.origin) return true;
    if (process.env.NODE_ENV !== "production") {
      if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 415 });
    }

    const origin = request.headers.get("origin");
    if (!isOriginAllowed(origin)) {
      return NextResponse.json({ error: "CROSS_ORIGIN_REQUEST_BLOCKED" }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const rateLimitKey = hashRateLimitKey("magic-link-email", email);
    const limit = await checkAndIncrementRateLimit(prisma, rateLimitKey, 5, 600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds || 60) } }
      );
    }

    const isTest = process.env.NODE_ENV === "test";
    const result = await initiatePasswordlessLogin(prisma, email, { isTestEnv: isTest });

    if (result.success && result.testToken) {
      await sendMagicLinkEmail({ email, token: result.testToken });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      ...(isTest && result.testToken ? { testToken: result.testToken } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
