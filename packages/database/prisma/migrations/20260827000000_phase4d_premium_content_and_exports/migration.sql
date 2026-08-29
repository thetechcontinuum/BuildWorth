-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunity_exports" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "opportunityRevisionId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "quotaPeriodKey" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "entitlementSnapshot" JSONB NOT NULL,
    "reservationLedgerId" TEXT,
    "consumptionLedgerId" TEXT,
    "releaseLedgerId" TEXT,
    "reservationExpiresAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "byteSize" INTEGER,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_exports_userId_requestKey_key" ON "opportunity_exports"("userId", "requestKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_exports_userId_format_requestedAt_idx" ON "opportunity_exports"("userId", "format", "requestedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_exports_opportunityId_format_idx" ON "opportunity_exports"("opportunityId", "format");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_exports_quotaPeriodKey_idx" ON "opportunity_exports"("quotaPeriodKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_exports_status_reservationExpiresAt_idx" ON "opportunity_exports"("status", "reservationExpiresAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (reservationLedger)
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_reservationLedgerId_fkey" FOREIGN KEY ("reservationLedgerId") REFERENCES "usage_ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (consumptionLedger)
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_consumptionLedgerId_fkey" FOREIGN KEY ("consumptionLedgerId") REFERENCES "usage_ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (releaseLedger)
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "opportunity_exports_releaseLedgerId_fkey" FOREIGN KEY ("releaseLedgerId") REFERENCES "usage_ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_exports_reservationLedgerId_key" ON "opportunity_exports"("reservationLedgerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_exports_releaseLedgerId_key" ON "opportunity_exports"("releaseLedgerId");

-- Check Constraints:
-- 1. REJECTED: no ledger links
-- 2. PENDING: reservation only (no consumption or release)
-- 3. COMPLETED: reservation and consumption present (consumptionLedgerId = reservationLedgerId), no release
-- 4. FAILED:
--    - FAILED before reservation: reservation IS NULL, consumption IS NULL, release IS NULL
--    - FAILED after reservation: reservation IS NOT NULL, consumption IS NULL, release IS NOT NULL
DO $$ BEGIN
    ALTER TABLE "opportunity_exports" ADD CONSTRAINT "check_opportunity_exports_ledger_invariants" CHECK (
        (status = 'REJECTED' AND "reservationLedgerId" IS NULL AND "consumptionLedgerId" IS NULL AND "releaseLedgerId" IS NULL) OR
        (status = 'PENDING' AND "reservationLedgerId" IS NOT NULL AND "consumptionLedgerId" IS NULL AND "releaseLedgerId" IS NULL) OR
        (status = 'COMPLETED' AND "reservationLedgerId" IS NOT NULL AND "consumptionLedgerId" = "reservationLedgerId" AND "releaseLedgerId" IS NULL) OR
        (status = 'FAILED' AND (
            ("reservationLedgerId" IS NULL AND "consumptionLedgerId" IS NULL AND "releaseLedgerId" IS NULL) OR
            ("reservationLedgerId" IS NOT NULL AND "consumptionLedgerId" IS NULL AND "releaseLedgerId" IS NOT NULL)
        ))
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: CommercialEventType
CREATE TYPE "CommercialEventType" AS ENUM (
    'PAYWALL_VIEWED',
    'UPGRADE_CTA_CLICKED',
    'CHECKOUT_CREATED',
    'CHECKOUT_CANCELLED',
    'CHECKOUT_COMPLETED',
    'ENTITLEMENT_ACTIVATED',
    'EXPORT_REQUESTED',
    'EXPORT_COMPLETED',
    'EXPORT_REJECTED'
);

-- CreateEnum: CommercialEventSource
CREATE TYPE "CommercialEventSource" AS ENUM (
    'SERVER_PAYWALL_BOUNDARY',
    'PRICING_PAGE',
    'CHECKOUT_SERVICE',
    'WEBHOOK_PROCESSOR',
    'EXPORT_SERVICE',
    'OPPORTUNITY_DOSSIER'
);

-- CreateEnum: CommercialRetentionClass
CREATE TYPE "CommercialRetentionClass" AS ENUM (
    'STANDARD_ANALYTICS',
    'TRANSACTIONAL_LIFECYCLE',
    'SECURITY_DIAGNOSTIC'
);

-- CreateEnum: CommercialPurposeCode
CREATE TYPE "CommercialPurposeCode" AS ENUM (
    'PRODUCT_CONVERSION_ANALYTICS',
    'CONTRACT_AND_BILLING_LIFECYCLE',
    'SERVICE_DELIVERY_AND_SECURITY'
);

-- CreateEnum: CommercialLawfulBasis
CREATE TYPE "CommercialLawfulBasis" AS ENUM (
    'CONSENT',
    'CONTRACT',
    'LEGAL_OBLIGATION',
    'LEGITIMATE_INTEREST'
);

-- CreateEnum: AnalyticsConsentStatus
CREATE TYPE "AnalyticsConsentStatus" AS ENUM (
    'GRANTED',
    'WITHDRAWN'
);

-- CreateTable: analytics_consent_histories
CREATE TABLE IF NOT EXISTS "analytics_consent_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "consentIdHash" TEXT,
    "purpose" "CommercialPurposeCode" NOT NULL DEFAULT 'PRODUCT_CONVERSION_ANALYTICS',
    "status" "AnalyticsConsentStatus" NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "source" TEXT NOT NULL DEFAULT 'CONSENT_BANNER',
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_consent_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_consent_histories_consentIdHash_key" ON "analytics_consent_histories"("consentIdHash");
CREATE INDEX IF NOT EXISTS "analytics_consent_histories_userId_purpose_createdAt_idx" ON "analytics_consent_histories"("userId", "purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "analytics_consent_histories_consentIdHash_idx" ON "analytics_consent_histories"("consentIdHash");

-- AddForeignKey (analytics_consent_histories.userId -> Cascade on user deletion)
DO $$ BEGIN
    ALTER TABLE "analytics_consent_histories" ADD CONSTRAINT "analytics_consent_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: commercial_events
CREATE TABLE IF NOT EXISTS "commercial_events" (
    "id" TEXT NOT NULL,
    "eventType" "CommercialEventType" NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "userId" TEXT,
    "opportunityId" TEXT,
    "checkoutAttemptId" TEXT,
    "exportId" TEXT,
    "source" "CommercialEventSource" NOT NULL,
    "purposeCode" "CommercialPurposeCode" NOT NULL,
    "lawfulBasis" "CommercialLawfulBasis" NOT NULL,
    "metadata" JSONB NOT NULL,
    "retentionClass" "CommercialRetentionClass" NOT NULL DEFAULT 'STANDARD_ANALYTICS',
    "retentionPolicyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymizedAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "legalHoldUntil" TIMESTAMP(3),
    "legalHoldReasonCode" TEXT,

    CONSTRAINT "commercial_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_events_deduplicationKey_key" ON "commercial_events"("deduplicationKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commercial_events_eventType_occurredAt_idx" ON "commercial_events"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commercial_events_userId_occurredAt_idx" ON "commercial_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commercial_events_opportunityId_eventType_idx" ON "commercial_events"("opportunityId", "eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commercial_events_retentionClass_occurredAt_idx" ON "commercial_events"("retentionClass", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commercial_events_retentionExpiresAt_idx" ON "commercial_events"("retentionExpiresAt");

-- AddForeignKey (userId -> SetNull on user deletion)
DO $$ BEGIN
    ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (opportunityId -> SetNull)
DO $$ BEGIN
    ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (checkoutAttemptId -> SetNull)
DO $$ BEGIN
    ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_checkoutAttemptId_fkey" FOREIGN KEY ("checkoutAttemptId") REFERENCES "billing_checkout_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (exportId -> SetNull)
DO $$ BEGIN
    ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "opportunity_exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
