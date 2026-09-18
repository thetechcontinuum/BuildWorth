import React from "react";
import { MvpFeatureItem } from "@buildworth/shared";

interface Props {
  features: MvpFeatureItem[];
}

export function NarrowMvpSection({ features }: Props) {
  const mustHave = features.filter((f) => f.category === "MUST_HAVE");
  const later = features.filter((f) => f.category === "LATER");
  const outOfScope = features.filter((f) => f.category === "OUT_OF_SCOPE");

  return (
    <section
      id="section-narrow-mvp"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>📦</span> Narrow MVP Feature Scope
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Categorized feature boundary preventing scope creep and reducing time-to-first-customer.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded">
            {mustHave.length} Must-Have
          </span>
          <span className="text-xs font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded">
            {later.length + outOfScope.length} Deferred
          </span>
        </div>
      </div>

      {/* Must-Have Features Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Core Must-Have Scope
          (Delivery Milestone 1)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mustHave.map((f) => (
            <div
              key={f.id}
              className="bg-zinc-950/70 border border-emerald-900/40 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-zinc-100">{f.featureName}</h4>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800">
                  {f.userJourneyStep || "Core"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.description}</p>
              {f.requiredIntegrations.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Integrations:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.requiredIntegrations.map((it, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded border border-zinc-800"
                      >
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deferred / Later Features Row */}
      {later.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-500"></span> Deferred to Post-MVP
            (Milestone 2+)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {later.map((f) => (
              <div
                key={f.id}
                className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-200">{f.featureName}</h4>
                  <span className="text-[10px] font-mono text-zinc-500">LATER</span>
                </div>
                <p className="text-xs text-zinc-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
