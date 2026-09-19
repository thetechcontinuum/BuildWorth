import React from "react";
import { Button } from "@buildworth/ui";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Emergency Kill-Switches — BuildWorth Admin",
  description: "Administrative safety controls to halt ingestion, AI generation, or publishing.",
};

export default async function KillSwitchesPage() {
  await requireServerAdmin();

  const switches = await prisma.killSwitch.findMany();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Emergency Kill-Switches</h1>
        <p className="text-sm text-zinc-400">
          Immediate circuit breakers to isolate subsystems during incidents.
        </p>
      </div>

      <div className="space-y-4">
        {switches.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm bg-zinc-950 rounded-xl border border-zinc-800">
            No kill switches configured.
          </div>
        ) : (
          switches.map((s) => (
            <div
              key={s.subsystem}
              className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500 font-bold">{s.subsystem}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      s.isActive
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {s.isActive ? "ENGAGED / ACTIVE" : "DISENGAGED"}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">{s.subsystem} Subsystem</h2>
                <span className="text-[11px] text-zinc-500 block pt-1">Reason: {s.reason || "Normal operation"}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
