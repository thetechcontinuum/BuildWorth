import { EntitlementKey } from "@buildworth/shared";
import { resolveUserEntitlements, checkEntitlement } from "./resolver.js";

export interface EnforcementResult {
  success: boolean;
  allowed: boolean;
  unitsConsumed?: number;
  remainingUnits?: number | null;
  error?: string;
  upgradeRequired?: boolean;
}

export interface SqlPrismaClient {
  $transaction: <T>(fn: (tx: any) => Promise<T>, options?: any) => Promise<T>;
  $queryRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  user: {
    findUnique: (args: any) => Promise<any>;
  };
  usageLedger: {
    findUnique?: (args: any) => Promise<any>;
    findFirst?: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    aggregate: (args: any) => Promise<any>;
  };
}

export interface EnforcementOptions {
  units?: number;
  resourceId?: string;
  actionContext?: string;
  idempotencyKey?: string;
  periodBucketKey?: string;
  isLiveEnvironment?: boolean;
}

/**
 * Server-authoritative atomic entitlement enforcement using PostgreSQL advisory locks
 * and strict transactional ledger verification.
 */
export async function enforceAtomicUsage(
  prisma: SqlPrismaClient,
  userId: string,
  key: EntitlementKey,
  options: EnforcementOptions = {}
): Promise<EnforcementResult> {
  const unitsToConsume = options.units ?? 1;

  if (unitsToConsume <= 0 || !Number.isInteger(unitsToConsume)) {
    return {
      success: false,
      allowed: false,
      error: "INVALID_UNITS_REQUESTED: Units must be a positive integer.",
    };
  }

  const periodBucketKey = options.periodBucketKey || new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // Execute inside an isolated database transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Acquire deterministic PostgreSQL advisory transaction lock for (userId, capability, periodBucketKey)
    // Hash key components into two 32-bit signed integers for pg_advisory_xact_lock(int4, int4)
    const lockKeyStr = `${userId}:${key}:${periodBucketKey}`;
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < lockKeyStr.length; i++) {
      const code = lockKeyStr.charCodeAt(i);
      if (i % 2 === 0) {
        hash1 = ((hash1 << 5) - hash1 + code) | 0;
      } else {
        hash2 = ((hash2 << 5) - hash2 + code) | 0;
      }
    }

    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock($1::int, $2::int);`,
      hash1,
      hash2
    );

    // 2. Check Idempotency Key
    if (options.idempotencyKey) {
      const existingLedger = await tx.usageLedger.findFirst({
        where: { idempotencyKey: options.idempotencyKey },
      });

      if (existingLedger) {
        // Verify payload consistency
        if (
          existingLedger.userId !== userId ||
          existingLedger.entitlementType !== key ||
          existingLedger.unitsConsumed !== unitsToConsume
        ) {
          throw new Error("IDEMPOTENCY_CONFLICT: Key reused with conflicting payload.");
        }

        return {
          success: true,
          allowed: true,
          unitsConsumed: existingLedger.unitsConsumed,
          remainingUnits: null, // Idempotent repeat
        };
      }
    }

    // 3. Resolve authoritative current entitlement limit from DB
    const dbUser = await tx.user.findUnique({
      where: { id: userId },
      include: {
        billingSubscriptions: {
          where: {
            status: { in: ["ACTIVE", "TRIALING"] },
          },
          include: {
            planPrice: {
              include: {
                plan: true,
              },
            },
          },
        },
        entitlementGrants: true,
      },
    });

    if (!dbUser) {
      return {
        success: false,
        allowed: false,
        error: "USER_NOT_FOUND",
        upgradeRequired: true,
      };
    }

    const context = resolveUserEntitlements(dbUser, new Date(), {
      isLiveEnvironment: options.isLiveEnvironment ?? false,
    });

    const check = checkEntitlement(context, key, unitsToConsume);
    if (!check.allowed || !check.entitlement) {
      return {
        success: false,
        allowed: false,
        error: check.reason,
        upgradeRequired: check.upgradeRequired,
      };
    }

    // 4. Calculate already committed usage in the current accounting period
    if (!check.entitlement.isUnlimited && check.entitlement.limitQuantity !== null) {
      const usageAgg = await tx.usageLedger.aggregate({
        where: {
          userId,
          entitlementType: key,
          periodBucketKey,
        },
        _sum: {
          unitsConsumed: true,
        },
      });

      const alreadyConsumed = usageAgg._sum.unitsConsumed ?? 0;
      const remainingAllowance = check.entitlement.limitQuantity - alreadyConsumed;

      if (unitsToConsume > remainingAllowance) {
        return {
          success: false,
          allowed: false,
          error: `USAGE_LIMIT_EXCEEDED: Requested ${unitsToConsume} units, but only ${remainingAllowance}/${check.entitlement.limitQuantity} remain in period ${periodBucketKey}.`,
          upgradeRequired: true,
        };
      }
    }

    // 5. Insert usage ledger entry
    await tx.usageLedger.create({
      data: {
        userId,
        entitlementType: key,
        unitsConsumed: unitsToConsume,
        resourceId: options.resourceId,
        actionContext: options.actionContext,
        idempotencyKey: options.idempotencyKey,
        periodBucketKey,
      },
    });

    // 6. Return successful grant result
    return {
      success: true,
      allowed: true,
      unitsConsumed: unitsToConsume,
      remainingUnits: check.entitlement.isUnlimited
        ? null
        : (check.entitlement.limitQuantity ?? 0) - unitsToConsume,
    };
  });
}
