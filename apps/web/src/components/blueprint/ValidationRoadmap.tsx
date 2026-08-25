import React from "react";
import { ValidationExperimentItem } from "@buildworth/shared";

interface Props {
  experiments: ValidationExperimentItem[];
}

export function ValidationRoadmap({ experiments }: Props) {
  return (
    <section id="section-validation-roadmap" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>🧪</span> Validation Experiments Roadmap
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Ordered by cheapest / fastest high-information experiments with explicit success and kill criteria.
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 w-fit">
          {experiments.length} Experiment{experiments.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {experiments.map((e, idx) => (
          <div key={e.id} className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Experiment #{idx + 1}: {e.experimentType}
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  {e.estimatedDurationDays} days • `$${e.estimatedCostCents / 100} budget`
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 w-fit">
                {e.status}
              </span>
            </div>

            <h3 className="text-base font-bold text-zinc-100">{e.hypothesis}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/60 space-y-1">
                <span className="font-mono text-[10px] text-zinc-500 uppercase">Target & Channel:</span>
                <p className="text-zinc-300">{e.targetParticipant} ({e.acquisitionChannel})</p>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-emerald-950/60 space-y-1">
                <span className="font-mono text-[10px] text-emerald-400 uppercase">Success Threshold:</span>
                <p className="text-emerald-300">{e.successThreshold}</p>
              </div>

              <div className="p-3 bg-zinc-900/60 rounded-lg border border-rose-950/60 space-y-1">
                <span className="font-mono text-[10px] text-rose-400 uppercase">Kill Criterion:</span>
                <p className="text-rose-300">{e.killCriterion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
