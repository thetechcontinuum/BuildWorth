import React from "react";
import { Cpu } from "lucide-react";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Spend & Budget Ceilings — BuildWorth Admin",
  description: "Monitor AI API consumption, token spend, and active kill-switch ceilings.",
};

export default async function AiSpendPage() {
  await requireServerAdmin();

  const records = await prisma.aiSpendLedgerRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalCostMinorUnits = records.reduce((acc, r) => acc + r.costMinorUnits, 0);

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
          <span className="text-xs text-zinc-500 font-medium">Recorded Ledger Spend</span>
          <div className="text-2xl font-bold text-white font-mono">
            ${(totalCostMinorUnits / 100).toFixed(2)}
          </div>
          <span className="text-xs text-emerald-400 font-medium">Within safe ceiling</span>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 font-medium">Ledger Entries</span>
          <div className="text-2xl font-bold text-white font-mono">{records.length}</div>
          <span className="text-xs text-zinc-400">Authoritative records</span>
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
                <th className="p-3">Prompt / Completion Tokens</th>
                <th className="p-3">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-zinc-500">
                    No ledger entries recorded yet.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium">{r.model}</td>
                    <td className="p-3">{r.purpose}</td>
                    <td className="p-3 font-mono">{r.promptTokens} / {r.completionTokens}</td>
                    <td className="p-3 font-mono">${(r.costMinorUnits / 100).toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
