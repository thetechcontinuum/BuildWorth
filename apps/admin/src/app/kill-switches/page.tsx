import React from "react";
import { Button } from "@buildworth/ui";

export const metadata = {
  title: "Emergency Kill-Switches — BuildWorth Admin",
  description: "Administrative safety controls to halt ingestion, AI generation, or publishing.",
};

export default function KillSwitchesPage() {
  const switches = [
    {
      subsystem: "AUTO_PUBLISH",
      name: "Automatic Publication Gate",
      description:
        "When ENGAGED, all newly synthesized opportunities enter the Manual Review Queue. No unverified publishing.",
      isActive: true,
      reason: "Initial Phase safety policy active. Pending 100-sample benchmark sign-off.",
      updatedAt: "System Default",
    },
    {
      subsystem: "AI_GENERATION",
      name: "AI Opportunity Synthesis",
      description: "When ENGAGED, completely halts all LLM completion and synthesis requests.",
      isActive: false,
      reason: "Normal operations",
      updatedAt: "Active",
    },
    {
      subsystem: "INGESTION",
      name: "Source Ingestion Pipeline",
      description: "When ENGAGED, pauses all scheduled connector scraping and API polling.",
      isActive: false,
      reason: "Normal operations",
      updatedAt: "Active",
    },
    {
      subsystem: "ALL",
      name: "Master Global Kill Switch",
      description: "Immediately halts all background jobs, AI tasks, and external API requests.",
      isActive: false,
      reason: "Normal operations",
      updatedAt: "Active",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Emergency Kill-Switches</h1>
        <p className="text-sm text-zinc-400">
          Immediate circuit breakers to isolate subsystems during incidents.
        </p>
      </div>

      <div className="space-y-4">
        {switches.map((s) => (
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
              <h2 className="text-base font-bold text-white">{s.name}</h2>
              <p className="text-xs text-zinc-400">{s.description}</p>
              <span className="text-[11px] text-zinc-500 block pt-1">Reason: {s.reason}</span>
            </div>

            <Button
              variant={s.isActive ? "outline" : "primary"}
              size="sm"
              className={
                s.isActive
                  ? "border-emerald-500/30 text-emerald-400"
                  : "bg-rose-600 hover:bg-rose-500"
              }
            >
              {s.isActive ? "Disengage Switch" : "Engage Kill Switch"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
