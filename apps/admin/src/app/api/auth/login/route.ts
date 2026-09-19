import { NextRequest, NextResponse } from "next/server";
import { prisma, initiatePasswordlessLogin, recordAuditLog } from "@buildworth/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "Invalid email format." }, { status: 400 });
    }

    // Check if user exists and is an admin
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== "ADMIN") {
      // Do not reveal whether user exists or is admin to unauthenticated caller
      return NextResponse.json({
        success: true,
        message: "If this account is an authorized administrator, a login verification token has been generated.",
      });
    }

    // Automatic verification token display is strictly restricted to an explicitly
    // enabled localhost-only test mode (ENABLE_LOCALHOST_DEV_TOKEN=true) and disabled by default.
    // It is NEVER returned on Preview, Staging, or Production.
    const isLocalhostExplicitDev =
      process.env.NODE_ENV !== "production" &&
      process.env.ENABLE_LOCALHOST_DEV_TOKEN === "true" &&
      (request.headers.get("host")?.startsWith("localhost:") || request.headers.get("host")?.startsWith("127.0.0.1:"));

    const result = await initiatePasswordlessLogin(prisma, email, {
      isTestEnv: isLocalhostExplicitDev,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Authentication service unavailable: email delivery failed.",
        },
        { status: 503 },
      );
    }

    // In preview/production or when dev token is not explicitly enabled, verify email delivery configuration
    if (!isLocalhostExplicitDev) {
      const hasEmailConfig = Boolean(
        process.env.RESEND_API_KEY ||
        process.env.SENDGRID_API_KEY ||
        process.env.SMTP_HOST
      );
      if (!hasEmailConfig) {
        // Fail closed: Never return token or pretend email was delivered if transport is missing
        return NextResponse.json(
          {
            success: false,
            error: "Authentication service unavailable: email transport is not configured.",
          },
          { status: 503 }
        );
      }
    }

    await recordAuditLog({
      userId: user.id,
      action: "ADMIN_LOGIN_INITIATED",
      entityType: "USER",
      entityId: user.id,
      reason: "Passwordless admin authentication link requested",
      details: { email },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: "If this account is an authorized administrator, a login verification token has been generated.",
      testToken: isLocalhostExplicitDev ? result.testToken : undefined,
    });
  } catch (error: any) {
    console.error("[/api/auth/login Error]:", error);
    return NextResponse.json({ success: false, error: "Authentication service error" }, { status: 500 });
  }
}
