import React from "react";
import { CustomerSegmentItem } from "@buildworth/shared";

interface Props {
  segments: CustomerSegmentItem[];
}

export function CustomerSegmentsSection({ segments }: Props) {
  return (
    <section
      id="section-customer-segments"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>🎯</span> Target Customer & Buyer Segments
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Structured distinction between user roles, economic buyers, technical approvers, and
            buying triggers.
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 w-fit">
          {segments.length} ICP Segment{segments.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {segments.map((seg, idx) => (
          <div
            key={seg.id || idx}
            className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-5 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100">{seg.segmentName}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {seg.salesMotion}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  {seg.industry} • {seg.companySizeRange} • {seg.geography}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-zinc-400">Sales Cycle</div>
                <div className="text-xs font-bold text-zinc-200">
                  {seg.salesCycleMinDays} – {seg.salesCycleMaxDays} days
                </div>
              </div>
            </div>

            {/* Buyer Roles Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-500 uppercase">End User Role</div>
                <div className="text-xs font-semibold text-zinc-200">{seg.endUserRole}</div>
              </div>

              <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-emerald-500/80 uppercase">
                  Economic Buyer
                </div>
                <div className="text-xs font-semibold text-emerald-300">
                  {seg.economicBuyerRole}
                </div>
              </div>

              <div className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-500 uppercase">
                  Technical Approver
                </div>
                <div className="text-xs font-semibold text-zinc-200">
                  {seg.technicalApproverRole || "N/A (Direct)"}
                </div>
              </div>
            </div>

            {/* Purchasing Behavior & Triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-[11px] text-zinc-400 uppercase">
                  ⚡ Buying Trigger:
                </span>
                <p className="text-zinc-300">{seg.buyingTrigger}</p>
              </div>

              <div className="space-y-1 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-[11px] text-zinc-400 uppercase">
                  💳 Spending Behavior & Budget:
                </span>
                <p className="text-zinc-300">
                  {seg.spendingBehavior} ({seg.budgetCategory})
                </p>
              </div>

              <div className="space-y-1 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-[11px] text-zinc-400 uppercase">
                  🛑 Primary Objection:
                </span>
                <p className="text-zinc-300">{seg.primaryObjection}</p>
              </div>

              <div className="space-y-1 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-[11px] text-zinc-400 uppercase">
                  📣 Acquisition Channels:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {seg.acquisitionChannels.map((ch, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
