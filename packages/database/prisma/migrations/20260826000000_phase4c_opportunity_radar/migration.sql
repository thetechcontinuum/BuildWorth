-- CreateEnum
CREATE TYPE "RadarChangeDimension" AS ENUM ('PUBLICATION_STATUS', 'EVIDENCE_CONFIDENCE', 'DECISION_RECOMMENDATION', 'WILLINGNESS_TO_PAY', 'PRICING', 'MVP_COST', 'DELIVERY_TIME', 'COMPETITOR', 'CRITICAL_RISK', 'EVIDENCE_SIGNAL');

-- CreateEnum
CREATE TYPE "RadarChangeDirection" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "RadarChangeSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RadarAlertCadence" AS ENUM ('INSTANT', 'DAILY_DIGEST', 'WEEKLY_DIGEST');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "RadarJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "OutboxNotificationType" AS ENUM ('RADAR_CHANGE_ALERT', 'RADAR_DAILY_DIGEST', 'RADAR_WEEKLY_DIGEST');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryProvider" AS ENUM ('SMTP', 'RESEND', 'TEST_MOCK');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- AlterTable
ALTER TABLE "saved_opportunities" ADD COLUMN IF NOT EXISTS "radarEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertCadence" "RadarAlertCadence" NOT NULL DEFAULT 'WEEKLY_DIGEST',
ADD COLUMN IF NOT EXISTS "minimumSeverity" "RadarChangeSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS "minimumConfidenceDelta" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS "alertOnStatusChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertOnRecommendationChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertOnNewWtpEvidence" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertOnCostChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertOnCompetitorChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "alertOnRiskChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "mutedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastEvaluatedRevisionId" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunity_radar_jobs" (
    "id" TEXT NOT NULL,
    "opportunityRevisionId" TEXT NOT NULL,
    "status" "RadarJobStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" TEXT,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_radar_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunity_change_events" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromRevisionId" TEXT NOT NULL,
    "toRevisionId" TEXT NOT NULL,
    "diffVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "canonicalInputHash" TEXT NOT NULL,
    "overallSeverity" "RadarChangeSeverity" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunity_change_items" (
    "id" TEXT NOT NULL,
    "changeEventId" TEXT NOT NULL,
    "dimension" "RadarChangeDimension" NOT NULL,
    "direction" "RadarChangeDirection" NOT NULL DEFAULT 'NEUTRAL',
    "severity" "RadarChangeSeverity" NOT NULL DEFAULT 'LOW',
    "reasonCode" TEXT NOT NULL,
    "sanitizedSummary" TEXT NOT NULL,
    "beforeValue" JSONB NOT NULL,
    "afterValue" JSONB NOT NULL,
    "numericDelta" DOUBLE PRECISION,
    "evidenceSignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_change_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "radar_evaluations" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "changeEventId" TEXT NOT NULL,
    "founderProfileRevisionId" TEXT,
    "previousFounderFit" INTEGER,
    "currentFounderFit" INTEGER,
    "founderFitDelta" INTEGER,
    "previousPersonalizedRank" DOUBLE PRECISION,
    "currentPersonalizedRank" DOUBLE PRECISION,
    "personalizedRankDelta" DOUBLE PRECISION,
    "hardBlockersAdded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hardBlockersRemoved" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evaluationVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "canonicalInputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radar_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "instantEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "unsubscribeToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_outbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "changeEventId" TEXT NOT NULL,
    "radarEvaluationId" TEXT,
    "notificationType" "OutboxNotificationType" NOT NULL DEFAULT 'RADAR_CHANGE_ALERT',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "deduplicationKey" TEXT NOT NULL,
    "claimToken" TEXT,
    "lockedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sanitizedPayload" JSONB NOT NULL,
    "sanitizedLastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "provider" "DeliveryProvider" NOT NULL DEFAULT 'TEST_MOCK',
    "providerIdempotencyKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "sanitizedError" TEXT,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_unsubscribe_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'BUILDWORTH_RADAR_UNSUBSCRIBE_V1',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "keyVersion" INTEGER NOT NULL DEFAULT 2,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_unsubscribe_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "digest_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digestType" "OutboxNotificationType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saved_opportunities_userId_radarEnabled_idx" ON "saved_opportunities"("userId", "radarEnabled");
CREATE INDEX IF NOT EXISTS "saved_opportunities_opportunityId_radarEnabled_idx" ON "saved_opportunities"("opportunityId", "radarEnabled");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_change_events_fromRevisionId_toRevisionId_diffVersion_key" ON "opportunity_change_events"("fromRevisionId", "toRevisionId", "diffVersion");
CREATE INDEX IF NOT EXISTS "opportunity_change_events_opportunityId_createdAt_idx" ON "opportunity_change_events"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_change_items_changeEventId_dimension_idx" ON "opportunity_change_items"("changeEventId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "radar_evaluations_watchId_changeEventId_evaluationVersion_key" ON "radar_evaluations"("watchId", "changeEventId", "evaluationVersion");
CREATE INDEX IF NOT EXISTS "radar_evaluations_watchId_matched_idx" ON "radar_evaluations"("watchId", "matched");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_radar_jobs_opportunityRevisionId_key" ON "opportunity_radar_jobs"("opportunityRevisionId");
CREATE INDEX IF NOT EXISTS "opportunity_radar_jobs_status_nextAttemptAt_idx" ON "opportunity_radar_jobs"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "opportunity_radar_jobs_status_lockedUntil_idx" ON "opportunity_radar_jobs"("status", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_key" ON "notification_preferences"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_unsubscribeToken_key" ON "notification_preferences"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_outbox_deduplicationKey_key" ON "notification_outbox"("deduplicationKey");
CREATE INDEX IF NOT EXISTS "notification_outbox_userId_status_scheduledFor_idx" ON "notification_outbox"("userId", "status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "notification_outbox_status_nextAttemptAt_idx" ON "notification_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_outboxId_attemptNumber_key" ON "notification_deliveries"("outboxId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "notification_deliveries_outboxId_status_idx" ON "notification_deliveries"("outboxId", "status");
CREATE INDEX IF NOT EXISTS "notification_deliveries_providerIdempotencyKey_idx" ON "notification_deliveries"("providerIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_unsubscribe_tokens_tokenHash_key" ON "notification_unsubscribe_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "notification_unsubscribe_tokens_userId_channel_idx" ON "notification_unsubscribe_tokens"("userId", "channel");
CREATE INDEX IF NOT EXISTS "notification_unsubscribe_tokens_expiresAt_idx" ON "notification_unsubscribe_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "digest_runs_userId_digestType_scheduledFor_key" ON "digest_runs"("userId", "digestType", "scheduledFor");
CREATE INDEX IF NOT EXISTS "digest_runs_userId_status_idx" ON "digest_runs"("userId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "opportunity_radar_jobs" ADD CONSTRAINT "opportunity_radar_jobs_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_lastEvaluatedRevisionId_fkey" FOREIGN KEY ("lastEvaluatedRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "opportunity_change_events" ADD CONSTRAINT "opportunity_change_events_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "opportunity_change_events" ADD CONSTRAINT "opportunity_change_events_fromRevisionId_fkey" FOREIGN KEY ("fromRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "opportunity_change_events" ADD CONSTRAINT "opportunity_change_events_toRevisionId_fkey" FOREIGN KEY ("toRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "opportunity_change_items" ADD CONSTRAINT "opportunity_change_items_changeEventId_fkey" FOREIGN KEY ("changeEventId") REFERENCES "opportunity_change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "radar_evaluations" ADD CONSTRAINT "radar_evaluations_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "saved_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "radar_evaluations" ADD CONSTRAINT "radar_evaluations_changeEventId_fkey" FOREIGN KEY ("changeEventId") REFERENCES "opportunity_change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "radar_evaluations" ADD CONSTRAINT "radar_evaluations_founderProfileRevisionId_fkey" FOREIGN KEY ("founderProfileRevisionId") REFERENCES "founder_profile_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_changeEventId_fkey" FOREIGN KEY ("changeEventId") REFERENCES "opportunity_change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_radarEvaluationId_fkey" FOREIGN KEY ("radarEvaluationId") REFERENCES "radar_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "notification_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notification_unsubscribe_tokens" ADD CONSTRAINT "notification_unsubscribe_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "digest_runs" ADD CONSTRAINT "digest_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
