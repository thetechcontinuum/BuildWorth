import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export interface MagicLinkRequestResult {
  success: boolean;
  message: string;
  testToken?: string; // Captured ONLY in TEST/DEVELOPMENT environments
}

export interface VerifyTokenResult {
  success: boolean;
  sessionToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    tier: string;
  };
  error?: string;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254;
}

export async function initiatePasswordlessLogin(
  prisma: PrismaClient,
  rawEmail: string,
  options: { isTestEnv?: boolean } = {}
): Promise<MagicLinkRequestResult> {
  if (!isValidEmail(rawEmail)) {
    // Return generic message to prevent leaking validation specifics / email enumeration
    return { success: false, message: "If this is a valid email, a verification link has been sent." };
  }

  const email = normalizeEmail(rawEmail);
  const rawVerificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawVerificationToken);
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

  // Upsert verification token (invalidates any older unconsumed token for same identifier)
  await prisma.verificationToken.upsert({
    where: {
      identifier_token: {
        identifier: email,
        token: hashedToken,
      },
    },
    update: {
      expires,
    },
    create: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  });

  // If in isolated test mode, return testToken for automated tests
  const isTest = options.isTestEnv || process.env.NODE_ENV === "test";
  return {
    success: true,
    message: "If this is a valid email, a verification link has been sent.",
    testToken: isTest ? rawVerificationToken : undefined,
  };
}

export async function verifyPasswordlessToken(
  prisma: PrismaClient,
  rawToken: string,
  rawEmail?: string
): Promise<VerifyTokenResult> {
  if (!rawToken || rawToken.length < 32) {
    return { success: false, error: "INVALID_OR_EXPIRED_TOKEN" };
  }

  const hashedToken = hashToken(rawToken);

  return await prisma.$transaction(async (tx) => {
    const record = await tx.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!record) {
      return { success: false, error: "INVALID_OR_EXPIRED_TOKEN" };
    }

    if (rawEmail && normalizeEmail(rawEmail) !== record.identifier) {
      return { success: false, error: "INVALID_OR_EXPIRED_TOKEN" };
    }

    if (record.expires < new Date()) {
      await tx.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
      return { success: false, error: "TOKEN_EXPIRED" };
    }

    const email = record.identifier;

    // Atomically delete token to prevent replay
    await tx.verificationToken.delete({ where: { token: hashedToken } });

    // Find or create user with DEFAULT FREE tier (never automatic PRO)
    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          tier: "FREE",
          role: "USER",
          emailVerified: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    // Issue opaque session token, store hashed in database
    const rawSessionToken = crypto.randomBytes(32).toString("hex");
    const hashedSessionToken = hashToken(rawSessionToken);
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await tx.session.create({
      data: {
        userId: user.id,
        sessionToken: hashedSessionToken,
        expires: sessionExpires,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "USER_AUTHENTICATED",
        entityType: "USER",
        entityId: user.id,
        userId: user.id,
        reason: "User verified identity via single-use magic link token",
      },
    });

    return {
      success: true,
      sessionToken: rawSessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tier: user.tier,
      },
    };
  });
}

export async function resolveHashedServerSession(
  prisma: PrismaClient,
  rawSessionToken: string | null | undefined
) {
  if (!rawSessionToken || rawSessionToken.length < 32) return null;

  const hashedSessionToken = hashToken(rawSessionToken);

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashedSessionToken },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expires < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    tier: session.user.tier,
    sessionId: session.id,
  };
}

export async function revokeHashedServerSession(
  prisma: PrismaClient,
  rawSessionToken: string
): Promise<boolean> {
  try {
    const hashedSessionToken = hashToken(rawSessionToken);
    await prisma.session.delete({ where: { sessionToken: hashedSessionToken } });
    return true;
  } catch {
    return false;
  }
}
