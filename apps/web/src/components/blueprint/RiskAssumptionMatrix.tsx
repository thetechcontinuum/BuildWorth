"use client";

import React, { useState } from "react";
import { RiskItem, AssumptionItem } from "@buildworth/shared";

interface Props {
  risks: RiskItem[];
  assumptions: AssumptionItem[];
}

export function RiskAssumptionMatrix({ risks, assumptions }: Props) {
  const [tab, setTab] = useState<"risks" | "assumptions">("risks");

  return (
    <section id="section-risks-assumptions" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>🛡️</span> Risk Register & Assumption Matrix
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Explicit tracking of commercial, competitive, and technical risks alongside falsifiable assumptions.
          </p>
        </div>

        <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          <button
            onClick={() => setTab("risks")}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
              tab === "risks"
                ? "bg-zinc-800 text-zinc-100 font-bold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Risks ({risks.length})
          </button>
          <button
            onClick={() => setTab("assumptions")}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
              tab === "assumptions"
                ? "bg-zinc-800 text-zinc-100 font-bold shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Assumptions ({assumptions.length})
          </button>
        </div>
      </div>

      {tab === "risks" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {risks.map((r) => (
            <div key={r.id} className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {r.category}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  r.severity === "CRITICAL"
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : r.severity === "HIGH"
                    ? "bg-orange-950 text-orange-300 border border-orange-800"
                    : "bg-amber-950 text-amber-300 border border-amber-800"
                }`}>
                  {r.severity} SEVERITY
                </span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-200">{r.description}</h4>
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/60 space-y-1 text-xs">
                <span className="font-mono text-[10px] text-zinc-500 uppercase">Mitigation Strategy:</span>
                <p className="text-zinc-300">{r.mitigationStrategy}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assumptions.map((a) => (
            <div key={a.id} className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {a.category}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  a.status === "SUPPORTED"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : a.status === "INVALIDATED"
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                }`}>
                  {a.status}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-200">{a.statement}</h4>
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/60 space-y-1 text-xs">
                <div className="text-[10px] font-mono text-zinc-500 uppercase">Test Method & Threshold:</div>
                <div className="text-zinc-300">{a.testMethod}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Success: {a.successThreshold}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
