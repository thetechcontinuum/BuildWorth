import React from "react";
import { Activity, Database, ShieldAlert, DollarSign } from "lucide-react";

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Operations Dashboard</h1>
        <p className="text-sm text-zinc-400">
          System ingestion metrics, review queue status, and pipeline health.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
            <span>Pending Review</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">14</div>
          <span className="text-xs text-amber-400 font-medium">Manual sign-off required</span>
        </div>
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
            <span>Raw Signals Ingested</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">4,120</div>
          <span className="text-xs text-emerald-400 font-medium">4 active connectors</span>
        </div>
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
            <span>AI Spend (Today)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">$1.42 / $5.00</div>
          <span className="text-xs text-zinc-400">28.4% of daily ceiling</span>
        </div>
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium">
            <span>Auto-Publish Kill Switch</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">ENGAGED</div>
          <span className="text-xs text-zinc-400">Protected mode active</span>
        </div>
      </div>
    </div>
  );
}
