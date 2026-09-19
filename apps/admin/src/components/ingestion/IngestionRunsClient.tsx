"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Play, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, ChevronRight, Activity } from "lucide-react";

interface IngestionRunItem {
  id: string;
  idempotencyKey: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  totalFetched: number;
  totalDeduplicated: number;
  rawSignalsCount: number;
  candidatesCount: number;
  publishedCount: number;
  publishedSlugs: string[];
  createdAt: string;
}

interface Props {
  initialRuns: IngestionRunItem[];
  totalRuns: number;
  sources: { key: string; name: string; isEnabled: boolean }[];
}

export function IngestionRunsClient({ initialRuns, totalRuns, sources }: Props) {
  const [runs, setRuns] = useState<IngestionRunItem[]>(initialRuns);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>("");
  const [triggerFeedback, setTriggerFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    setTriggerFeedback(null);
    try {
      const res = await fetch("/api/admin/ingestion/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          targetSourceKeys: selectedSourceKey ? [selectedSourceKey] : undefined,
          maxSources: 3,
          maxFetchItems: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTriggerFeedback({ success: false, message: data.error || "Failed to trigger ingestion" });
      } else {
        setTriggerFeedback({
          success: true,
          message: `Ingestion finished with status: ${data.run?.status || "COMPLETED"}. Fetched: ${data.run?.counters?.fetched ?? 0}, Candidates: ${data.run?.counters?.candidates ?? 0}`,
        });
        // Refresh runs
        const refRes = await fetch("/api/admin/ingestion/runs");
        if (refRes.ok) {
          const refData = await refRes.json();
          setRuns(refData.runs);
        }
      }
    } catch (err: any) {
      setTriggerFeedback({ success: false, message: err?.message || "Network error" });
    } finally {
      setIsTriggering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> PROCESSING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Trigger Card */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Trigger Manual Staging Ingestion
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Initiate a single bounded ingestion pass in Staging. Execution runs synchronously within safety limits
              (max 3 sources, 10 items) and persists a durable IngestionRun with full counters.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedSourceKey}
              onChange={(e) => setSelectedSourceKey(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Active Sources</option>
              {sources
                .filter((s) => s.isEnabled)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name} ({s.key})
                  </option>
                ))}
            </select>
            <button
              onClick={handleTriggerRun}
              disabled={isTriggering}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ingesting...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Run Ingestion
                </>
              )}
            </button>
          </div>
        </div>

        {triggerFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              triggerFeedback.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {triggerFeedback.success ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{triggerFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Runs Table */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Durable Ingestion Runs ({totalRuns})</h3>
        </div>

        {runs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">No ingestion runs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/50 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Run ID / Idempotency Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Fetched / Deduped</th>
                  <th className="py-3 px-4">Signals / Candidates</th>
                  <th className="py-3 px-4">Drafts Created</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-zinc-200 font-semibold">{run.id.slice(0, 8)}...</div>
                      <div className="text-[11px] font-mono text-zinc-500 truncate max-w-xs">{run.idempotencyKey}</div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(run.status)}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white">{run.totalFetched}</span>
                      <span className="text-zinc-500"> / {run.totalDeduplicated} dedup</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white">{run.rawSignalsCount}</span> signals
                      <span className="text-zinc-500"> · {run.candidatesCount} clusters</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-amber-400">{run.publishedCount}</span>
                      {run.publishedSlugs.length > 0 && (
                        <span className="text-zinc-500 text-[10px] block truncate max-w-[120px]">
                          {run.publishedSlugs.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/ingestion/${run.id}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
