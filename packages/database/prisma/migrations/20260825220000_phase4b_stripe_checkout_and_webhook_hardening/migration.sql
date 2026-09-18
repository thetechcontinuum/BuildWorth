-- AlterEnum
ALTER TYPE "BillingSubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- AlterTable
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "latestProviderEventTimestamp" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "billing_webhook_events" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_checkout_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "selectedPlanCode" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "planPriceId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_checkout_attempts_requestId_key" ON "billing_checkout_attempts"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_checkout_attempts_checkoutSessionId_key" ON "billing_checkout_attempts"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_checkout_attempts_idempotencyKey_key" ON "billing_checkout_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "billing_checkout_attempts_userId_status_idx" ON "billing_checkout_attempts"("userId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "billing_checkout_attempts" ADD CONSTRAINT "billing_checkout_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
