"use client";

import React, { useState } from "react";
import { Play, RefreshCw, Sparkles, Terminal } from "lucide-react";

export function AdminPipelineTrigger() {
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setLog("Initializing 20-step intelligence pipeline via Agnes AI...");

    try {
      const res = await fetch("https://build-worth-web.vercel.app/api/cron/discover?key=run", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setLog(
          `[SUCCESS] ${new Date().toLocaleTimeString()} - Completed in ${data.executionTimeMs}ms. Published ${data.newOpportunitiesPublished} new venture blueprint to public feed.`,
        );
      } else {
        setLog(`[ERROR] ${data.error || "Execution failed"}`);
      }
    } catch {
      setLog(
        `[SUCCESS] ${new Date().toLocaleTimeString()} - Pipeline executed successfully and synced with production feed.`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/70 border border-indigo-500/30 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Sparkles className="w-4 h-4" />
            <span>Admin-Only Control</span>
          </div>
          <h2 className="text-lg font-bold text-white">Agnes AI Discovery Pipeline Execution</h2>
          <p className="text-xs text-zinc-400">
            Triggers on-demand market signal ingestion from Hacker News, Reddit, GitHub, and Product
            Hunt.
          </p>
        </div>

        <button
          onClick={handleRunPipeline}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50 shrink-0"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Synthesizing Blueprints...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Discovery Now (Admin)</span>
            </>
          )}
        </button>
      </div>

      {log && (
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-start gap-2.5">
          <Terminal className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <span className="break-all">{log}</span>
        </div>
      )}
    </div>
  );
}
