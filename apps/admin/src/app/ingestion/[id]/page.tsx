import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { ArrowLeft, CheckCircle, Clock, XCircle, RefreshCw, Database, Layers, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingestion Run Detail — BuildWorth Admin",
};

export default async function IngestionRunDetailPage({ params }: { params: { id: string } }) {
  await requireServerAdmin();

  const run = await prisma.ingestionRun.findUnique({
    where: { id: params.id },
  });

  if (!run) {
    notFound();
  }

  const summary = (run.summary as any) || {};

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <Link
        href="/ingestion"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Ingestion Runs
      </Link>

      {/* Header */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-zinc-500">{run.id}</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  run.status === "COMPLETED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : run.status === "FAILED"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}
              >
                {run.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Ingestion Run: {run.idempotencyKey}
            </h1>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div>Created: {run.createdAt.toLocaleString()}</div>
            {run.completedAt && <div>Completed: {run.completedAt.toLocaleString()}</div>}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Fetched</div>
          <div className="text-2xl font-bold text-white mt-1">{run.totalFetched}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">{run.totalDeduplicated} deduplicated</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Raw Signals</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{run.rawSignalsCount}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Persisted in DB</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Candidate Clusters</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{run.candidatesCount}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Formed from signals</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Drafts Synthesized</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{run.publishedCount}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Stored as DRAFT</div>
        </div>
      </div>

      {/* Published / Synthesized Slugs */}
      {run.publishedSlugs && run.publishedSlugs.length > 0 && (
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" /> Synthesized Draft Slugs
          </h3>
          <div className="flex flex-wrap gap-2">
            {run.publishedSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/drafts?slug=${slug}`}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-indigo-300 transition-colors"
              >
                {slug} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Execution Diagnostics / Summary JSON */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" /> Execution Metadata & Diagnostics
        </h3>
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 font-mono text-xs text-zinc-300 overflow-x-auto">
          <pre>{JSON.stringify({ failureCode: run.failureCode, lockedBy: run.lockedBy, attemptCount: run.attemptCount, summary }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
