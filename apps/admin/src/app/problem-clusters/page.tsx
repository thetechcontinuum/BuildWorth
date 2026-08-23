import React from "react";
import { FolderGit2 } from "lucide-react";

export const metadata = {
  title: "Problem Clusters — BuildWorth Admin",
  description: "Review recurring problem spaces clustered from market signals.",
};

export default function ProblemClustersPage() {
  const clusters = [
    {
      id: "cluster-1",
      title: "Vercel & Next.js Automated SOC2 Evidence Collection",
      vertical: "DevOps & Compliance",
      signalCount: 28,
      status: "READY_FOR_OPPORTUNITY_SYNTHESIS",
      topSources: ["Hacker News (14)", "Reddit r/devops (9)", "GitHub (5)"],
      sampleSummary:
        "Engineers spend 40+ hours per quarter manually collecting git commit screenshots and environment variable audit logs for SOC2 compliance.",
    },
    {
      id: "cluster-2",
      title: "Snowflake Runaway Query Cost Circuit Breakers",
      vertical: "Data Engineering & FinOps",
      signalCount: 42,
      status: "READY_FOR_OPPORTUNITY_SYNTHESIS",
      topSources: ["Hacker News (22)", "Reddit r/dataengineering (15)", "Product Hunt (5)"],
      sampleSummary:
        "Data platform leads suffer unexpected $10k+ warehouse budget spikes when unoptimized SQL queries run unnoticed over the weekend.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Problem Spaces & Signal Clusters
        </h1>
        <p className="text-sm text-zinc-400">
          Recurring market problems clustered via pgvector semantic similarity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {clusters.map((c) => (
          <div
            key={c.id}
            className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{c.title}</h2>
                  <span className="text-xs text-zinc-400 font-mono">
                    {c.vertical} • {c.id}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {c.signalCount} Signals Clustered
                </span>
              </div>
            </div>

            <p className="text-sm text-zinc-300 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60">
              {c.sampleSummary}
            </p>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="text-zinc-400 font-medium">Source Diversity:</span>
              {c.topSources.join(" • ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
