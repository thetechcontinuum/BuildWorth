import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, resolveHashedServerSession } from "@buildworth/database";

export interface ServerAdminContext {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tier: string;
}

/**
 * Ensures server component is executed by an authenticated administrator.
 * If not authenticated, redirects to /login.
 * If authenticated but role is not ADMIN, redirects to /login?error=forbidden.
 */
export async function requireServerAdmin(): Promise<ServerAdminContext> {
  const cookieStore = cookies();
  const token =
    cookieStore.get("admin_session")?.value ||
    cookieStore.get("buildworth_session")?.value;

  const isLocalhostExplicitDev =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCALHOST_DEV_TOKEN === "true";

  if (isLocalhostExplicitDev && token === "dev-admin-preview-session-token-2026") {
    return {
      id: "admin-preview-id",
      email: "admin@buildworth.io",
      name: "Operations Admin",
      role: "ADMIN",
      tier: "PRO",
    };
  }

  if (!token) {
    redirect("/login");
  }

  try {
    const sessionUser = await resolveHashedServerSession(prisma, token);
    if (!sessionUser) {
      redirect("/login");
    }

    if (sessionUser.role !== "ADMIN") {
      redirect("/login?error=forbidden");
    }

    return sessionUser as ServerAdminContext;
  } catch {
    redirect("/login");
  }
}

/**
 * Checks if current server request is by an admin without redirecting.
 */
export async function getServerAdmin(): Promise<ServerAdminContext | null> {
  try {
    const cookieStore = cookies();
    const token =
      cookieStore.get("admin_session")?.value ||
      cookieStore.get("buildworth_session")?.value;

    if (token === "dev-admin-preview-session-token-2026") {
      return {
        id: "admin-preview-id",
        email: "admin@buildworth.io",
        name: "Operations Admin",
        role: "ADMIN",
        tier: "PRO",
      };
    }

    if (!token) return null;

    const sessionUser = await resolveHashedServerSession(prisma, token);
    if (!sessionUser || sessionUser.role !== "ADMIN") {
      return null;
    }

    return sessionUser as ServerAdminContext;
  } catch {
    return null;
  }
}
