import { PrismaClient, Role } from "@prisma/client";
import { isValidEmail, normalizeEmail, hashToken } from "./auth-identity.js";
import { sendMagicLinkEmail } from "./email-delivery.js";
import crypto from "crypto";

export interface InviteUserResult {
  success: boolean;
  message: string;
  error?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name: string | null;
  };
  invitationSent?: boolean;
  testToken?: string;
}

export interface ChangeUserRoleResult {
  success: boolean;
  message: string;
  error?: string;
  previousRole?: Role;
  newRole?: Role;
  sessionsRevokedCount?: number;
}

/**
 * Invites a new user or issues an invitation to an existing unverified user.
 * - Creates unverified account with specified role (default USER).
 * - Never marks email as verified upon creation.
 * - Generates single-use expiring invitation token.
 * - Dispatches invitation email using email delivery system.
 * - Only reveals token if explicitly in localhost dev mode.
 */
export async function inviteUser(
  prisma: PrismaClient,
  params: {
    rawEmail: string;
    name?: string | null;
    role?: Role;
    actorId: string;
    ipAddress?: string;
    isLocalhostDev?: boolean;
  },
): Promise<InviteUserResult> {
  const { rawEmail, name, actorId, ipAddress = "127.0.0.1", isLocalhostDev = false } = params;
  const role: Role = params.role && ["USER", "ADMIN", "REVIEWER"].includes(params.role) ? params.role : "USER";

  if (!isValidEmail(rawEmail)) {
    return {
      success: false,
      error: "INVALID_EMAIL",
      message: "A valid email address is required.",
    };
  }

  const email = normalizeEmail(rawEmail);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.emailVerified) {
    return {
      success: false,
      error: "USER_ALREADY_EXISTS",
      message: `A verified account already exists for ${email}. You can manage their role directly.`,
    };
  }

  const rawInvitationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawInvitationToken);
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours for invitation

  let targetUser = existingUser;

  // Atomically create or update unverified user and store token
  targetUser = await prisma.$transaction(async (tx) => {
    let user;
    if (existingUser) {
      // Re-inviting preserves the established unverified role or only updates name;
      // role modifications must proceed through changeUserRole with proper guards/confirmation
      user = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: name !== undefined ? name : existingUser.name,
        },
      });
    } else {
      user = await tx.user.create({
        data: {
          email,
          name: name || null,
          role,
          tier: "FREE",
          emailVerified: null, // Never automatically verify
        },
      });
    }

    // Invalidate all previous unconsumed verification tokens for this email to prevent reuse
    await tx.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await tx.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: existingUser ? "USER_INVITATION_RESENT" : "USER_INVITATION_CREATED",
        entityType: "USER",
        entityId: user.id,
        previousState: existingUser ? existingUser.role : null,
        newState: user.role,
        reason: existingUser
          ? `Administrator re-invited ${email} (preserved existing role ${user.role})`
          : `Administrator invited ${email} with initial role ${role}`,
        details: {
          email,
          role: user.role,
          name: user.name,
          actorId,
          requestedRole: role,
        },
        ipAddress,
      },
    });

    return user;
  });

  // Attempt real email dispatch
  let emailDelivered = false;
  if (!isLocalhostDev) {
    const deliveryResult = await sendMagicLinkEmail({
      email,
      token: rawInvitationToken,
    });
    emailDelivered = deliveryResult.delivered;
    if (!emailDelivered) {
      return {
        success: true,
        invitationSent: false,
        message: `Account created for ${email}, but invitation email could not be sent (email transport unavailable).`,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.role,
          name: targetUser.name,
        },
      };
    }
  } else {
    // In explicit localhost test mode, delivery is simulated
    emailDelivered = true;
  }

  return {
    success: true,
    invitationSent: emailDelivered,
    message: `Invitation successfully sent to ${email}.`,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      name: targetUser.name,
    },
    testToken: isLocalhostDev ? rawInvitationToken : undefined,
  };
}

/**
 * Modifies an existing user's role:
 * - Prevents actor from changing their own role.
 * - Prevents removing the last administrator.
 * - Requires explicit confirmation when promoting to ADMIN.
 * - Invalidates all active sessions for the target user if demoted from ADMIN or changed.
 * - Leaves subscription tier, billing, and entitlements completely untouched.
 * - Atomically records audit log.
 */
export async function changeUserRole(
  prisma: PrismaClient,
  params: {
    targetUserId: string;
    newRole: Role;
    actorId: string;
    actorEmail: string;
    confirmAdminPromotion?: boolean;
    ipAddress?: string;
  },
): Promise<ChangeUserRoleResult> {
  const { targetUserId, newRole, actorId, actorEmail, confirmAdminPromotion = false, ipAddress = "127.0.0.1" } = params;

  if (!["USER", "ADMIN", "REVIEWER"].includes(newRole)) {
    return {
      success: false,
      error: "INVALID_ROLE",
      message: `Role ${newRole} is not supported. Supported roles: USER, ADMIN, REVIEWER.`,
    };
  }

  // 1. Fetch target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return {
      success: false,
      error: "USER_NOT_FOUND",
      message: "Target user does not exist.",
    };
  }

  // 2. Prevent self-role change
  if (targetUserId === actorId || targetUser.email.toLowerCase() === actorEmail.toLowerCase()) {
    return {
      success: false,
      error: "CANNOT_CHANGE_OWN_ROLE",
      message: "Administrators cannot modify their own role.",
    };
  }

  const previousRole = targetUser.role;
  if (previousRole === newRole) {
    return {
      success: true,
      message: `User already holds the ${newRole} role.`,
      previousRole,
      newRole,
    };
  }

  // 3. Explicit confirmation required for granting ADMIN
  if (newRole === "ADMIN" && !confirmAdminPromotion) {
    return {
      success: false,
      error: "EXPLICIT_CONFIRMATION_REQUIRED",
      message: `Granting ADMIN role to ${targetUser.email} requires explicit confirmation.`,
    };
  }

  return await prisma.$transaction(async (tx) => {
    // 4. Last-Admin Protection (Concurrent-safe via row-level locks on admin rows)
    if (previousRole === "ADMIN" && newRole !== "ADMIN") {
      // Lock admin rows so concurrent transactions cannot concurrently count and demote
      const adminRows = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM users WHERE role = 'ADMIN' FOR UPDATE`,
      );

      if (adminRows.length <= 1) {
        throw new Error("LAST_ADMIN_PROTECTION: Cannot remove the last active administrator.");
      }
    }

    // 5. Update user role (leaves tier, billing, entitlements untouched)
    await tx.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    // 6. Revoke active sessions for target user so the role change is immediately enforced
    const deletedSessions = await tx.session.deleteMany({
      where: { userId: targetUserId },
    });

    // 7. Atomic Audit Log
    const actorExists = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } });
    await tx.auditLog.create({
      data: {
        userId: actorExists ? actorId : targetUserId,
        action: "USER_ROLE_CHANGED",
        entityType: "USER",
        entityId: targetUserId,
        previousState: previousRole,
        newState: newRole,
        reason: `Role changed from ${previousRole} to ${newRole} by administrator`,
        details: {
          targetEmail: targetUser.email,
          previousRole,
          newRole,
          actorId,
          actorEmail,
          sessionsRevoked: deletedSessions.count,
        },
        ipAddress,
      },
    });

    return {
      success: true,
      message: `Successfully changed role for ${targetUser.email} from ${previousRole} to ${newRole}.`,
      previousRole,
      newRole,
      sessionsRevokedCount: deletedSessions.count,
    };
  }).catch((err: any) => {
    if (err.message && err.message.includes("LAST_ADMIN_PROTECTION")) {
      return {
        success: false,
        error: "LAST_ADMIN_PROTECTION",
        message: "Cannot remove or demote the last remaining administrator on the platform.",
      };
    }
    return {
      success: false,
      error: "TRANSACTION_FAILED",
      message: err.message || "Failed to execute role change transaction.",
    };
  });
}
