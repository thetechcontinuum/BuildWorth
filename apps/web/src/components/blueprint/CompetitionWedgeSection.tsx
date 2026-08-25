import React from "react";
import { CompetitorItem } from "@buildworth/shared";

interface Props {
  competitors: CompetitorItem[];
}

export function CompetitionWedgeSection({ competitors }: Props) {
  return (
    <section id="section-competition" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <span>⚔️</span> Competition & Asymmetric Wedge
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Direct and indirect alternatives, incumbent complaints, and sustainable differentiation advantage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competitors.map((c) => (
          <div key={c.id} className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">{c.name}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {c.competitorType}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-[10px] text-zinc-500 uppercase">Known Pricing:</span>
                <p className="text-zinc-300 font-semibold">{c.knownPricing || "Opaque / Contact Sales"}</p>
              </div>

              <div className="p-2.5 bg-rose-950/30 rounded-lg border border-rose-900/40 space-y-1">
                <span className="font-mono text-[10px] text-rose-400 uppercase">Recurring User Complaints:</span>
                <ul className="list-disc list-inside text-rose-200">
                  {c.recurringComplaints.map((comp, idx) => (
                    <li key={idx}>{comp}</li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 bg-emerald-950/30 rounded-lg border border-emerald-900/40 space-y-1">
                <span className="font-mono text-[10px] text-emerald-400 uppercase">Asymmetric Wedge:</span>
                <p className="text-emerald-200">{c.differentiationHypothesis}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
