import { NextRequest, NextResponse } from "next/server";
import { prisma, inviteUser } from "@buildworth/database";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await assertAdminMutation(request, "INVITE_USER", "USER", "NEW");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { email, name, role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR: A valid email address is required." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    if (role && !["USER", "ADMIN", "REVIEWER"].includes(role)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR: Unsupported role specified. Supported roles: USER, ADMIN, REVIEWER." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const isLocalhostDev =
      process.env.NODE_ENV !== "production" &&
      process.env.ENABLE_LOCALHOST_DEV_TOKEN === "true" &&
      (request.headers.get("host")?.startsWith("localhost:") || request.headers.get("host")?.startsWith("127.0.0.1:"));

    const result = await inviteUser(prisma, {
      rawEmail: email.trim(),
      name: typeof name === "string" ? name.trim() : null,
      role: role || "USER",
      actorId: auth.admin.id,
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
      isLocalhostDev: Boolean(isLocalhostDev),
    });

    if (!result.success) {
      const status = result.error === "USER_ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json(
        { error: result.message, code: result.error },
        { status, headers: NO_CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        user: result.user,
        invitationSent: result.invitationSent,
        testToken: result.testToken,
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error: any) {
    console.error("[/api/admin/users/invite Error]:", error);
    return NextResponse.json(
      { error: "Internal server error inviting user." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
