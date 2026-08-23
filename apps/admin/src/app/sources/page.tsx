import React from "react";
import { Database, ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Source Connectors & Health — BuildWorth Admin",
  description: "Monitor active source connectors, rate limits, and ingestion status.",
};

export default function SourcesPage() {
  const sources = [
    {
      sourceKey: "hackernews",
      name: "Hacker News",
      adapterType: "HACKERNEWS_API",
      accessMethod: "API",
      rateLimit: "120 req/min",
      status: "HEALTHY",
      attribution: "Required (YC terms)",
      termsNotes:
        "Uses Algolia HN API and Firebase public endpoints. Permitted non-commercial/commercial indexing.",
      signalsIngested: "1,840 signals",
      lastRun: "3 mins ago",
    },
    {
      sourceKey: "reddit",
      name: "Reddit Tech & Ops",
      adapterType: "REDDIT_OAUTH",
      accessMethod: "OAUTH_API",
      rateLimit: "60 req/min",
      status: "HEALTHY",
      attribution: "Required (Reddit API terms)",
      termsNotes:
        "Reddit OAuth 2.0 API. Excerpts limited to <= 280 chars with permalinks. No raw data reselling.",
      signalsIngested: "1,220 signals",
      lastRun: "12 mins ago",
    },
    {
      sourceKey: "github",
      name: "GitHub Issues & Discussions",
      adapterType: "GITHUB_REST",
      accessMethod: "API",
      rateLimit: "80 req/min",
      status: "HEALTHY",
      attribution: "Required (GitHub API terms)",
      termsNotes:
        "GitHub REST/GraphQL API with PAT. Targets public repo issue workarounds and friction points.",
      signalsIngested: "680 signals",
      lastRun: "25 mins ago",
    },
    {
      sourceKey: "producthunt",
      name: "Product Hunt",
      adapterType: "PRODUCTHUNT_GRAPHQL",
      accessMethod: "GRAPHQL",
      rateLimit: "60 req/min",
      status: "HEALTHY",
      attribution: "Required",
      termsNotes:
        "Product Hunt GraphQL API. Scans launch criticism, alternative requests, and feature voids.",
      signalsIngested: "380 signals",
      lastRun: "1 hour ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Source Connectors & Registry
          </h1>
          <p className="text-sm text-zinc-400">
            Manage registered data adapters, rate limits, and compliance restrictions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sources.map((src) => (
          <div
            key={src.sourceKey}
            className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {src.name}
                    <span className="text-xs font-mono font-normal text-zinc-500">
                      ({src.sourceKey})
                    </span>
                  </h2>
                  <span className="text-xs text-zinc-400 font-mono">
                    {src.adapterType} • {src.accessMethod}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {src.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-zinc-800/60 text-zinc-400">
              <div>
                <span className="text-zinc-500">Rate Limit:</span> {src.rateLimit}
              </div>
              <div>
                <span className="text-zinc-500">Signals Ingested:</span>{" "}
                <span className="font-mono text-zinc-200">{src.signalsIngested}</span>
              </div>
              <div>
                <span className="text-zinc-500">Last Synced:</span> {src.lastRun}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs space-y-1">
              <div className="text-zinc-400 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Terms of Service & Legal
                Policy
              </div>
              <p className="text-zinc-400">{src.termsNotes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
