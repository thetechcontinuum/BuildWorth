import { NextRequest, NextResponse } from "next/server";
import { prisma, changeUserRole } from "@buildworth/database";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const targetUserId = params.id;
  const auth = await assertAdminMutation(request, "CHANGE_USER_ROLE", "USER", targetUserId);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { role, confirmAdminPromotion } = body;

    if (!role || !["USER", "ADMIN", "REVIEWER"].includes(role)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR: Unsupported role specified. Supported roles: USER, ADMIN, REVIEWER." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const result = await changeUserRole(prisma, {
      targetUserId,
      newRole: role,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      confirmAdminPromotion: Boolean(confirmAdminPromotion),
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    if (!result.success) {
      let status = 400;
      if (result.error === "USER_NOT_FOUND") status = 404;
      if (result.error === "CANNOT_CHANGE_OWN_ROLE") status = 403;
      if (result.error === "LAST_ADMIN_PROTECTION") status = 409;
      if (result.error === "EXPLICIT_CONFIRMATION_REQUIRED") status = 422;

      return NextResponse.json(
        { error: result.message, code: result.error },
        { status, headers: NO_CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        previousRole: result.previousRole,
        newRole: result.newRole,
        sessionsRevokedCount: result.sessionsRevokedCount,
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error: any) {
    console.error("[/api/admin/users/[id]/role Error]:", error);
    return NextResponse.json(
      { error: "Internal server error changing user role." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
