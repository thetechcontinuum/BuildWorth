import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export function hashRateLimitKey(prefix: string, identifier: string): string {
  const digest = crypto.createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
  return `${prefix}:${digest}`;
}

export async function checkAndIncrementRateLimit(
  prisma: PrismaClient,
  key: string,
  maxPoints: number = 5,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  const now = new Date();
  const expireAt = new Date(now.getTime() + windowSeconds * 1000);

  return await prisma.$transaction(async (tx) => {
    // Advisory lock key derived from rate limit key
    const lockKey =
      Math.abs(key.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) %
      2147483647;
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    const record = await tx.rateLimitBucket.findUnique({ where: { key } });

    if (!record || record.expireAt < now) {
      // Create or reset window
      await tx.rateLimitBucket.upsert({
        where: { key },
        update: { points: 1, expireAt },
        create: { key, points: 1, expireAt },
      });
      return { allowed: true, remaining: maxPoints - 1 };
    }

    if (record.points >= maxPoints) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((record.expireAt.getTime() - now.getTime()) / 1000),
      );
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    const updated = await tx.rateLimitBucket.update({
      where: { key },
      data: { points: { increment: 1 } },
    });

    return { allowed: true, remaining: Math.max(0, maxPoints - updated.points) };
  });
}
