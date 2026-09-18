"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";

interface WatchItem {
  id: string;
  opportunityId: string;
  radarEnabled: boolean;
  alertCadence: string;
  minimumSeverity: string;
  minimumConfidenceDelta: number;
  opportunity: {
    id: string;
    title: string;
    slug: string;
    targetVertical: string;
    publicationQualityStatus: string;
    decisionRecommendation: string;
    evidenceConfidenceScore: number;
    opportunityScore: number;
    summary: string;
  };
  radarEvaluations: Array<{
    id: string;
    matched: boolean;
    reasonCodes: string[];
    founderFitDelta: number | null;
    currentFounderFit: number | null;
    changeEvent: {
      overallSeverity: string;
      createdAt: string;
      items: Array<{
        dimension: string;
        direction: string;
        severity: string;
        sanitizedSummary: string;
      }>;
    };
  }>;
}

export default function WatchlistPage() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<string>("FREE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  async function fetchWatchlist() {
    try {
      setLoading(true);
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        setError("UNAUTHORIZED");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setWatches(data.watches || []);
        setUserTier(data.userTier || "FREE");
      } else {
        setError(data.error || "Failed to load watchlist");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading watchlist");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveWatch(id: string) {
    try {
      const res = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setWatches(watches.filter((w) => w.id !== id));
      }
    } catch (err) {
      console.error("Error removing watch:", err);
    }
  }

  const isPro = userTier === "PRO";
  const watchLimit = isPro ? 50 : 3;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between">
      <HeaderNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Opportunity Radar & Watchlist
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isPro
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {userTier} Plan
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Deterministic change detection, verified signal alerts, and personalized Founder Fit
              impact tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md">
              Watching: <span className="font-semibold text-zinc-200">{watches.length}</span> /{" "}
              {watchLimit} slots
            </div>
            {!isPro && (
              <Link
                href="/pricing"
                className="text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-semibold px-3 py-1.5 rounded-md shadow-sm transition-all"
              >
                Upgrade to Pro (50 Watches)
              </Link>
            )}
          </div>
        </div>

        {error === "UNAUTHORIZED" ? (
          <div className="p-12 text-center bg-zinc-900/50 rounded-xl border border-zinc-800/80 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center mb-4">
              🔒
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Sign in to access your Watchlist
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              Track high-conviction venture opportunities, receive deterministic radar alerts, and
              monitor Founder Fit deltas.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign In to Continue
            </Link>
          </div>
        ) : loading ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            Scanning opportunity radar feeds...
          </div>
        ) : watches.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/40 rounded-xl border border-zinc-800/80 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-zinc-800/80 text-zinc-400 mx-auto flex items-center justify-center mb-4 text-xl">
              📡
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Watched Opportunities Yet</h2>
            <p className="text-zinc-400 text-sm mb-6">
              No verified changes have been detected since you started watching this opportunity.
              Browse synthesized market opportunities and add them to your watchlist to enable
              deterministic radar alerts.
            </p>
            <Link
              href="/opportunities"
              className="inline-flex items-center justify-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg border border-zinc-700 transition-colors"
            >
              Explore Opportunities
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {watches.map((watch) => {
              const opp = watch.opportunity;
              const latestEval = watch.radarEvaluations?.[0];
              const changeEvent = latestEval?.changeEvent;
              const items = changeEvent?.items || [];

              return (
                <div
                  key={watch.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 hover:border-zinc-700/80 transition-all shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300">
                          {opp.targetVertical}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            opp.decisionRecommendation === "BUILD_CANDIDATE"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                              : "bg-blue-950 text-blue-400 border border-blue-800/40"
                          }`}
                        >
                          {opp.decisionRecommendation}
                        </span>
                        <span className="text-xs text-zinc-500">
                          Confidence:{" "}
                          <strong className="text-zinc-300">{opp.evidenceConfidenceScore}%</strong>
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-white hover:text-emerald-400 transition-colors">
                        <Link href={`/opportunities/${opp.slug || opp.id}`}>{opp.title}</Link>
                      </h3>
                      <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{opp.summary}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRemoveWatch(watch.id)}
                        className="text-xs text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/50 bg-zinc-950 px-2.5 py-1.5 rounded-md transition-colors"
                      >
                        Unwatch
                      </button>
                    </div>
                  </div>

                  {/* Radar Timeline & Changes */}
                  <div className="mt-5 pt-4 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Recent Radar Change Events
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Cadence: {watch.alertCadence}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-xs text-zinc-500 italic bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
                        No verified changes have been detected since you started watching this
                        opportunity.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-lg flex items-start justify-between gap-4"
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.severity === "CRITICAL"
                                    ? "bg-rose-950 text-rose-400 border border-rose-800"
                                    : item.severity === "HIGH"
                                      ? "bg-amber-950 text-amber-400 border border-amber-800"
                                      : "bg-zinc-800 text-zinc-300"
                                }`}
                              >
                                {item.severity}
                              </span>
                              <span className="text-zinc-300 leading-relaxed">
                                {item.sanitizedSummary}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              {item.dimension}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Personalized Founder Fit Impact */}
                    {latestEval && latestEval.currentFounderFit !== null && (
                      <div className="mt-3 bg-zinc-950/40 border border-zinc-800/40 p-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-zinc-400">
                          Personalized Founder Fit:{" "}
                          <strong className="text-zinc-200">{latestEval.currentFounderFit}%</strong>
                        </span>
                        {latestEval.founderFitDelta !== null &&
                          latestEval.founderFitDelta !== 0 && (
                            <span
                              className={`font-semibold ${latestEval.founderFitDelta > 0 ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {latestEval.founderFitDelta > 0
                                ? `+${latestEval.founderFitDelta}`
                                : latestEval.founderFitDelta}{" "}
                              pts
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        BuildWorth Opportunity Radar © 2026. Deterministic, evidence-backed market intelligence.
      </footer>
    </div>
  );
}
