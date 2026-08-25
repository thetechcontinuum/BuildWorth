import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tier: string;
}

export function generateOpaqueSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createServerSession(
  prisma: PrismaClient,
  userId: string,
  expiresInDays: number = 30
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = generateOpaqueSessionToken();
  const expires = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expires,
    },
  });

  return { sessionToken, expires };
}

export async function resolveServerSession(
  prisma: PrismaClient,
  sessionToken: string | null | undefined
): Promise<ServerSessionUser | null> {
  if (!sessionToken || sessionToken.length < 32) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expires < new Date()) {
    // Expired session - cleanup
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    tier: session.user.tier,
  };
}

export async function revokeServerSession(
  prisma: PrismaClient,
  sessionToken: string
): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { sessionToken } });
    return true;
  } catch {
    return false;
  }
}
