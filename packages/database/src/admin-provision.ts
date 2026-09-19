import { PrismaClient } from "@prisma/client";
import { normalizeEmail, isValidEmail } from "./auth-identity.js";

export interface ProvisionAdminResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

/**
 * Securely provisions an administrator role for an existing verified account.
 *
 * Rules:
 * 1. Strictly rejects execution against Production database or environment.
 * 2. Requires explicit environment/target confirmation flag.
 * 3. The target email must belong to an existing user who is email-verified.
 * 4. Atomically persists the role change and creates an immutable AuditLog record.
 */
export async function provisionAdminUser(
  prisma: PrismaClient,
  rawEmail: string,
  options: {
    targetConfirmation: boolean;
    environmentConfirmation: "development" | "staging" | "test";
    actorId?: string;
    ipAddress?: string;
  },
): Promise<ProvisionAdminResult> {
  // Guard 1: Reject Production strictly
  if (
    process.env.NODE_ENV === "production" &&
    process.env.BUILDWORTH_ENV !== "staging" &&
    process.env.TEST_ENV !== "true"
  ) {
    return {
      success: false,
      error: "PRODUCTION_GUARD_ACTIVE: Direct admin provisioning against Production is strictly forbidden.",
      message: "Direct admin provisioning against Production is strictly forbidden.",
    };
  }

  // Guard 2: Require explicit confirmations
  if (!options.targetConfirmation) {
    return {
      success: false,
      error: "MISSING_TARGET_CONFIRMATION: Explicit confirmation parameter is required.",
      message: "Explicit confirmation parameter is required.",
    };
  }

  if (!["development", "staging", "test"].includes(options.environmentConfirmation)) {
    return {
      success: false,
      error: "INVALID_ENVIRONMENT_CONFIRMATION: Must explicitly confirm development, staging, or test target.",
      message: "Invalid target environment.",
    };
  }

  if (!isValidEmail(rawEmail)) {
    return {
      success: false,
      error: "INVALID_EMAIL",
      message: "A valid email address is required.",
    };
  }

  const email = normalizeEmail(rawEmail);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: false,
        error: "USER_NOT_FOUND",
        message: `No user exists with email ${email}. An existing registered account is required.`,
      };
    }

    if (!user.emailVerified) {
      return {
        success: false,
        error: "USER_NOT_VERIFIED",
        message: `User ${email} has not verified their email. Only verified accounts can be promoted to ADMIN.`,
      };
    }

    if (user.role === "ADMIN") {
      return {
        success: true,
        message: `User ${email} already has the ADMIN role.`,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    }

    const previousRole = user.role;
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    await tx.auditLog.create({
      data: {
        userId: options.actorId || updatedUser.id,
        action: "ADMIN_ROLE_PROVISIONED",
        entityType: "USER",
        entityId: updatedUser.id,
        previousState: previousRole,
        newState: "ADMIN",
        reason: `Explicit administrator provisioning on ${options.environmentConfirmation}`,
        details: {
          email: updatedUser.email,
          environment: options.environmentConfirmation,
          promotedAt: new Date().toISOString(),
          actorId: options.actorId || "CLI",
        },
        ipAddress: options.ipAddress || "127.0.0.1",
      },
    });

    return {
      success: true,
      message: `User ${email} successfully promoted to ADMIN role on ${options.environmentConfirmation}.`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    };
  });
}
