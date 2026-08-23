import React from "react";
import { Cpu } from "lucide-react";

export const metadata = {
  title: "AI Spend & Budget Ceilings — BuildWorth Admin",
  description: "Monitor AI API consumption, token spend, and active kill-switch ceilings.",
};

export default function AiSpendPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">AI Spend & Budget Ceilings</h1>
        <p className="text-sm text-zinc-400">
          Real-time spend ledger with automatic daily & monthly circuit breakers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 font-medium">Daily Spend (Today)</span>
          <div className="text-2xl font-bold text-white font-mono">$1.42 / $5.00</div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-[28.4%]" />
          </div>
          <span className="text-xs text-emerald-400 font-medium">Within $5.00 safe ceiling</span>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 font-medium">Monthly Spend (August)</span>
          <div className="text-2xl font-bold text-white font-mono">$32.18 / $150.00</div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-[21.4%]" />
          </div>
          <span className="text-xs text-emerald-400 font-medium">
            Within $150.00 monthly budget
          </span>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 font-medium">Circuit Breaker Status</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono">NORMAL</div>
          <span className="text-xs text-zinc-400">Auto-kill will trigger at 100% cap</span>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" /> Model Spend Ledger
        </h2>
        <div className="border border-zinc-800 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-3">Model / Provider</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Tokens Processed</th>
                <th className="p-3">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              <tr>
                <td className="p-3 font-medium">Gemini 1.5 Flash</td>
                <td className="p-3">Signal Classification & Fact Extraction</td>
                <td className="p-3 font-mono">2,410,000</td>
                <td className="p-3 font-mono">$0.82</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">GPT-4o-mini</td>
                <td className="p-3">Constrained Opportunity Synthesis</td>
                <td className="p-3 font-mono">820,000</td>
                <td className="p-3 font-mono">$0.60</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">text-embedding-3-small</td>
                <td className="p-3">pgvector Problem Space Clustering</td>
                <td className="p-3 font-mono">510,000</td>
                <td className="p-3 font-mono">$0.02</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
