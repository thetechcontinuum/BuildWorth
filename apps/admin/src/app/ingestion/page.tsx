import React from "react";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { IngestionRunsClient } from "@/components/ingestion/IngestionRunsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingestion Runs & Operations — BuildWorth Admin",
};

export default async function AdminIngestionPage() {
  await requireServerAdmin();

  const [runs, totalRuns, sources] = await Promise.all([
    prisma.ingestionRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.ingestionRun.count(),
    prisma.source.findMany({
      select: { key: true, name: true, isEnabled: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedRuns = runs.map((r) => ({
    id: r.id,
    idempotencyKey: r.idempotencyKey,
    status: r.status,
    startedAt: r.startedAt?.toISOString() || null,
    completedAt: r.completedAt?.toISOString() || null,
    failedAt: r.failedAt?.toISOString() || null,
    failureCode: r.failureCode,
    totalFetched: r.totalFetched,
    totalDeduplicated: r.totalDeduplicated,
    rawSignalsCount: r.rawSignalsCount,
    candidatesCount: r.candidatesCount,
    publishedCount: r.publishedCount,
    publishedSlugs: r.publishedSlugs,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Ingestion Runs & Operations</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor discovery ingestion passes, inspect stage metrics, and trigger safe bounded runs in Staging.
        </p>
      </div>

      <IngestionRunsClient initialRuns={serializedRuns} totalRuns={totalRuns} sources={sources} />
    </div>
  );
}
