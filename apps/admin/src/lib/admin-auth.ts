import { NextRequest, NextResponse } from "next/server";
import { prisma, resolveHashedServerSession, recordAuditLog } from "@buildworth/database";

export interface AdminAuthContext {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tier: string;
  sessionId: string;
}

export const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie, Origin",
};

/**
 * Extracts session token from cookie (admin_session or fallback buildworth_session).
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get("admin_session")?.value || request.cookies.get("buildworth_session")?.value;
  if (cookie) return cookie;

  const cookieHeader = request.headers.get("cookie") || "";
  const matchAdmin = cookieHeader.match(/admin_session=([^;]+)/);
  if (matchAdmin && matchAdmin[1]) return decodeURIComponent(matchAdmin[1]);

  const matchWeb = cookieHeader.match(/buildworth_session=([^;]+)/);
  if (matchWeb && matchWeb[1]) return decodeURIComponent(matchWeb[1]);

  return null;
}

/**
 * Resolves and verifies that the incoming request is authenticated with an authoritative ADMIN role.
 * Commercial Pro or Team subscribers who are not ADMIN are strictly rejected.
 */
export async function requireAdminSession(
  request: NextRequest,
): Promise<
  | { authorized: true; admin: AdminAuthContext }
  | { authorized: false; response: NextResponse }
> {
  const sessionToken = getSessionTokenFromRequest(request);
  const isLocalhostExplicitDev =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCALHOST_DEV_TOKEN === "true" &&
    (request.headers.get("host")?.startsWith("localhost:") || request.headers.get("host")?.startsWith("127.0.0.1:"));

  if (isLocalhostExplicitDev && sessionToken === "dev-admin-preview-session-token-2026") {
    return {
      authorized: true,
      admin: {
        id: "admin-preview-id",
        email: "admin@buildworth.io",
        name: "Operations Admin",
        role: "ADMIN",
        tier: "PRO",
        sessionId: "sess-preview",
      },
    };
  }
  if (!sessionToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED: Authentication session required." },
        { status: 401, headers: NO_CACHE_HEADERS },
      ),
    };
  }

  try {
    const sessionUser = await resolveHashedServerSession(prisma, sessionToken);
    if (!sessionUser) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "UNAUTHORIZED: Session expired or invalid." },
          { status: 401, headers: NO_CACHE_HEADERS },
        ),
      };
    }

    // Strict Authorization: Role must explicitly equal ADMIN
    if (sessionUser.role !== "ADMIN") {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "FORBIDDEN: Administrator privilege required." },
          { status: 403, headers: NO_CACHE_HEADERS },
        ),
      };
    }

    return {
      authorized: true,
      admin: sessionUser as AdminAuthContext,
    };
  } catch (err) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED: Session verification failed." },
        { status: 401, headers: NO_CACHE_HEADERS },
      ),
    };
  }
}

/**
 * Validates mutation requirements:
 * 1. Authenticated ADMIN session.
 * 2. Origin check matches request host / allowed origins (same-origin enforcement).
 * 3. Required custom action header 'X-Admin-Action: 1'.
 *
 * ALL THREE MUST PASS. No alternatives permitted.
 */
export async function assertAdminMutation(
  request: NextRequest,
  actionName: string,
  entityType = "ADMIN_CONSOLE",
  entityId = "MUTATION",
): Promise<
  | { authorized: true; admin: AdminAuthContext }
  | { authorized: false; response: NextResponse }
> {
  // 1. Session check
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    await recordAuditLog({
      action: "ADMIN_MUTATION_REJECTED",
      entityType,
      entityId,
      reason: "UNAUTHORIZED: Missing or non-ADMIN session token",
      details: { actionName, ip: request.ip || "unknown" },
    }).catch(() => {});

    return auth;
  }

  const admin = auth.admin;

  // 2. Custom header check
  const actionHeader = request.headers.get("x-admin-action");
  if (actionHeader !== "1") {
    await recordAuditLog({
      userId: admin.id,
      action: "ADMIN_MUTATION_REJECTED",
      entityType,
      entityId,
      reason: "MISSING_CUSTOM_HEADER: X-Admin-Action header must equal '1'",
      details: { actionName, ip: request.ip || "unknown" },
    }).catch(() => {});

    return {
      authorized: false,
      response: NextResponse.json(
        { error: "CSRF_PROTECTION: Missing required X-Admin-Action header." },
        { status: 403, headers: NO_CACHE_HEADERS },
      ),
    };
  }

  // 3. Same-origin validation
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "CSRF_PROTECTION: Cross-origin mutation strictly forbidden." },
          { status: 403, headers: NO_CACHE_HEADERS },
        ),
      };
    }
  } else {
    try {
      const parsedOrigin = new URL(origin);
      if (host && parsedOrigin.host !== host) {
        await recordAuditLog({
          userId: admin.id,
          action: "ADMIN_MUTATION_REJECTED",
          entityType,
          entityId,
          reason: `CROSS_ORIGIN_MISMATCH: Origin ${parsedOrigin.host} does not match Host ${host}`,
          details: { actionName, origin, host },
        }).catch(() => {});

        return {
          authorized: false,
          response: NextResponse.json(
            { error: "CSRF_PROTECTION: Origin mismatch detected." },
            { status: 403, headers: NO_CACHE_HEADERS },
          ),
        };
      }
    } catch {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "CSRF_PROTECTION: Invalid Origin header." },
          { status: 403, headers: NO_CACHE_HEADERS },
        ),
      };
    }
  }

  return { authorized: true, admin };
}
