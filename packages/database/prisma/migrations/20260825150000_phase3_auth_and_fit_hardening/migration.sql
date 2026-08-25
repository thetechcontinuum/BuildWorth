-- DropIndex
DROP INDEX IF EXISTS "founder_fit_evaluations_profileRevisionId_blueprintId_rubri_key";

-- AlterTable
ALTER TABLE "founder_fit_evaluations" ADD COLUMN IF NOT EXISTS "opportunityRevisionId" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_buckets_key_key" ON "rate_limit_buckets"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_expireAt_idx" ON "rate_limit_buckets"("expireAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "founder_fit_evaluations_profileRevisionId_opportunityRevisi_key" ON "founder_fit_evaluations"("profileRevisionId", "opportunityRevisionId", "rubricVersion", "rankingVersion");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'founder_fit_evaluations_opportunityRevisionId_fkey'
    ) THEN
        ALTER TABLE "founder_fit_evaluations" ADD CONSTRAINT "founder_fit_evaluations_opportunityRevisionId_fkey" FOREIGN KEY ("opportunityRevisionId") REFERENCES "opportunity_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
