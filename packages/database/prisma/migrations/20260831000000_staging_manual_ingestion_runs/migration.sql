-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "ingestion_runs" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" TEXT,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalDeduplicated" INTEGER NOT NULL DEFAULT 0,
    "rawSignalsCount" INTEGER NOT NULL DEFAULT 0,
    "candidatesCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "publishedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_key" ON "ingestion_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ingestion_runs_status_lockedUntil_idx" ON "ingestion_runs"("status", "lockedUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ingestion_runs_idempotencyKey_idx" ON "ingestion_runs"("idempotencyKey");
