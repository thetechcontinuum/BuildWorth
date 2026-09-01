-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "EntitlementType" AS ENUM ('EVIDENCE_LINEAGE_UNRESTRICTED', 'FOUNDER_FIT_FULL_BREAKDOWN', 'VENTURE_BLUEPRINT_FINANCIALS', 'VENTURE_BLUEPRINT_EXPORT', 'OPPORTUNITY_RADAR_WATCHLIST', 'OPPORTUNITY_RADAR_ALERTS', 'OPPORTUNITY_COMPARISON', 'EARLY_OPPORTUNITY_ACCESS', 'CUSTOM_SOURCE_INDEXING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "EntitlementGrantSource" AS ENUM ('SUBSCRIPTION', 'PROMOTIONAL', 'ADMIN_OVERRIDE', 'TRIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "billingInterval" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "entitlementType" "EntitlementType" NOT NULL,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "limitQuantity" INTEGER,
    "resetInterval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "billingEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billingCustomerId" TEXT NOT NULL,
    "planPriceId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "BillingSubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "entitlement_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "entitlementType" "EntitlementType" NOT NULL,
    "source" "EntitlementGrantSource" NOT NULL DEFAULT 'SUBSCRIPTION',
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "limitQuantity" INTEGER,
    "remainingUnits" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "usage_ledgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlementType" "EntitlementType" NOT NULL,
    "unitsConsumed" INTEGER NOT NULL DEFAULT 1,
    "resourceId" TEXT,
    "actionContext" TEXT,
    "idempotencyKey" TEXT,
    "periodBucketKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_plans_code_key" ON "product_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plan_prices_stripePriceId_key" ON "plan_prices"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plan_entitlements_planId_entitlementType_key" ON "plan_entitlements"("planId", "entitlementType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customers_userId_key" ON "billing_customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customers_stripeCustomerId_key" ON "billing_customers"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_stripeSubscriptionId_key" ON "billing_subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "billing_subscriptions_userId_status_idx" ON "billing_subscriptions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_events_eventId_key" ON "billing_webhook_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_events_idempotencyKey_key" ON "billing_webhook_events"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "entitlement_grants_userId_entitlementType_source_key" ON "entitlement_grants"("userId", "entitlementType", "source");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledgers_idempotencyKey_key" ON "usage_ledgers"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usage_ledgers_userId_entitlementType_periodBucketKey_idx" ON "usage_ledgers"("userId", "entitlementType", "periodBucketKey");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "product_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "product_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "billing_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "usage_ledgers" ADD CONSTRAINT "usage_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
