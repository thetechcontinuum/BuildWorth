import { NextRequest, NextResponse } from "next/server";
import { prisma, verifyPasswordlessToken, recordAuditLog } from "@buildworth/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;

    if (!token || token.length < 32) {
      return NextResponse.json({ success: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const verificationResult = await verifyPasswordlessToken(prisma, token, email);
    if (!verificationResult.success || !verificationResult.sessionToken || !verificationResult.user) {
      return NextResponse.json({ success: false, error: verificationResult.error || "INVALID_OR_EXPIRED_TOKEN" }, { status: 401 });
    }

    // Role check: Only ADMIN role is permitted into apps/admin
    if (verificationResult.user.role !== "ADMIN") {
      await recordAuditLog({
        userId: verificationResult.user.id,
        action: "ADMIN_LOGIN_REJECTED_NON_ADMIN",
        entityType: "USER",
        entityId: verificationResult.user.id,
        reason: `User with role ${verificationResult.user.role} attempted admin console access`,
        details: { email: verificationResult.user.email, role: verificationResult.user.role },
      });

      return NextResponse.json({
        success: false,
        error: "FORBIDDEN: Account does not have administrator privileges.",
      }, { status: 403 });
    }

    await recordAuditLog({
      userId: verificationResult.user.id,
      action: "ADMIN_LOGGED_IN",
      entityType: "USER",
      entityId: verificationResult.user.id,
      reason: "Successful administrator authentication",
      details: { email: verificationResult.user.email },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const isSecure = process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_ADMIN_URL?.startsWith("http://localhost");
    const response = NextResponse.json({
      success: true,
      user: verificationResult.user,
    });

    // Set secure admin_session cookie
    response.cookies.set("admin_session", verificationResult.sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
