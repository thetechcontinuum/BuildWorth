import React from "react";
import { FolderGit2 } from "lucide-react";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Problem Clusters — BuildWorth Admin",
  description: "Review recurring problem spaces clustered from market signals.",
};

export default async function ProblemClustersPage() {
  await requireServerAdmin();

  const clusters = await prisma.problemCluster.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

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
        {clusters.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm bg-zinc-950 rounded-xl border border-zinc-800">
            No problem clusters recorded yet.
          </div>
        ) : (
          clusters.map((c) => (
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
                {c.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
