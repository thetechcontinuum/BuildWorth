import React from "react";

interface Props {
  plan?: {
    stage1_5?: { icp: string; channel: string; offer: string; metric: string };
    stage6_10?: { referralMechanisms: string; caseStudyProof: string; pricingTest: string };
    stage11_15?: { repeatableChannel: string; salesMaterials: string; activationMetric: string };
    stage16_20?: { channelComparison: string; retentionCheck: string; scaleDecision: string };
  } | null;
}

export function First20CustomersPlan({ plan }: Props) {
  if (!plan) return null;

  return (
    <section id="section-first-20" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <span>🚀</span> First 20 Customers Execution Plan
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Four concrete, progressive stages from initial pilot acquisition to repeatable acquisition motion.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stage 1-5 */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            Customers 1 – 5
          </span>
          <h4 className="text-xs font-bold text-zinc-200">Founder-Led Pilots</h4>
          <p className="text-xs text-zinc-400">{plan.stage1_5?.channel}</p>
          <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300">
            <strong>Target:</strong> {plan.stage1_5?.metric}
          </div>
        </div>

        {/* Stage 6-10 */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            Customers 6 – 10
          </span>
          <h4 className="text-xs font-bold text-zinc-200">Proof & Case Studies</h4>
          <p className="text-xs text-zinc-400">{plan.stage6_10?.caseStudyProof}</p>
          <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300">
            <strong>Pricing:</strong> {plan.stage6_10?.pricingTest}
          </div>
        </div>

        {/* Stage 11-15 */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            Customers 11 – 15
          </span>
          <h4 className="text-xs font-bold text-zinc-200">Repeatable Channel</h4>
          <p className="text-xs text-zinc-400">{plan.stage11_15?.repeatableChannel}</p>
          <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300">
            <strong>Activation:</strong> {plan.stage11_15?.activationMetric}
          </div>
        </div>

        {/* Stage 16-20 */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            Customers 16 – 20
          </span>
          <h4 className="text-xs font-bold text-zinc-200">Unit Economics & Scale</h4>
          <p className="text-xs text-zinc-400">{plan.stage16_20?.channelComparison}</p>
          <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300">
            <strong>Retention:</strong> {plan.stage16_20?.retentionCheck}
          </div>
        </div>
      </div>
    </section>
  );
}
