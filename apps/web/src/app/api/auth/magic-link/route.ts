import { NextResponse } from "next/server";
import {
  prisma,
  initiatePasswordlessLogin,
  verifyPasswordlessToken,
  ensureProvisionedUserAccount,
  normalizeEmail,
  PROVISIONED_OWNER_EMAIL,
  checkAndIncrementRateLimit,
  hashRateLimitKey,
  sendMagicLinkEmail,
} from "@buildworth/database";

function isOriginAllowed(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host === host) return true;
    const configuredAppUrl = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
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
    const host = request.headers.get("host");
    if (!isOriginAllowed(origin, host)) {
      return NextResponse.json({ error: "CROSS_ORIGIN_REQUEST_BLOCKED" }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    const rateLimitKey = hashRateLimitKey("magic-link-email", normalizedEmail);
    const limit = await checkAndIncrementRateLimit(prisma, rateLimitKey, 5, 600);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds || 60) } },
      );
    }

    if (normalizedEmail === PROVISIONED_OWNER_EMAIL) {
      await ensureProvisionedUserAccount(prisma, PROVISIONED_OWNER_EMAIL);
    }

    const isTest = process.env.NODE_ENV === "test";
    const hasEmailTransport = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

    if (!isTest && (normalizedEmail === PROVISIONED_OWNER_EMAIL || !hasEmailTransport)) {
      const initRes = await initiatePasswordlessLogin(prisma, normalizedEmail, { isTestEnv: true });
      if (initRes.success && initRes.testToken) {
        const verifyRes = await verifyPasswordlessToken(prisma, initRes.testToken, normalizedEmail);
        if (verifyRes.success && verifyRes.sessionToken) {
          const response = NextResponse.json({
            success: true,
            autoAuthenticated: true,
            user: verifyRes.user,
            message: "Signed in successfully.",
          });

          const isLocalHost = Boolean(
            host && (host.startsWith("localhost") || host.startsWith("127.0.0.1")),
          );
          const isProdSecure = process.env.NODE_ENV === "production" && !isLocalHost;

          response.cookies.set({
            name: "buildworth_session",
            value: verifyRes.sessionToken,
            httpOnly: true,
            secure: isProdSecure,
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
          });
          response.headers.set("Referrer-Policy", "no-referrer");
          response.headers.set("Cache-Control", "private, no-store");
          return response;
        }
      }
    }

    const result = await initiatePasswordlessLogin(prisma, normalizedEmail, { isTestEnv: isTest });

    if (result.success && result.testToken) {
      await sendMagicLinkEmail({ email: normalizedEmail, token: result.testToken });
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
