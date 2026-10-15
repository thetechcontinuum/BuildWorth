"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, AlertCircle, RotateCw } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";
import { StoredOpportunity } from "@/lib/opportunity-store";

export function HomeTopOpportunitiesClient() {
  const [opportunities, setOpportunities] = useState<StoredOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load opportunities (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      setOpportunities(data.opportunities || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load verified opportunities");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const topOpportunities = opportunities.slice(0, 2);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Top Calibrated Opportunities
          </h2>
          <p className="text-sm text-zinc-400">
            Ranked by dual-score Opportunity + Evidence Confidence models.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse space-y-6"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-zinc-800 rounded w-1/4" />
                  <div className="h-6 bg-zinc-800 rounded w-12" />
                </div>
                <div className="h-6 bg-zinc-800 rounded w-3/4" />
                <div className="h-12 bg-zinc-800/60 rounded w-full" />
              </div>
              <div className="h-10 bg-zinc-800/40 rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl bg-red-950/20 border border-red-900/40 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-900/30 text-red-400 mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Failed to Load Verified Opportunities</h3>
          <p className="text-sm text-red-300/80 max-w-md mx-auto">{error}</p>
          <div className="pt-2">
            <button
              onClick={fetchOpportunities}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white hover:border-zinc-600 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : topOpportunities.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
            <ShieldCheck className="w-6 h-6 text-zinc-500" />
          </div>
          <h3 className="text-base font-semibold text-white">No Opportunities Published Yet</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Continuous intelligence pipeline monitoring active. Fresh opportunity briefs appear here automatically as empirical market friction signals are processed and calibrated.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topOpportunities.map((op) => (
            <div
              key={op.slug}
              className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                      {op.industry}
                    </span>
                    {op.publicationQualityStatus === "VERIFIED" ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        VERIFIED
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        EARLY HYPOTHESIS
                      </span>
                    )}
                  </div>
                  <ScoreBadge score={op.opportunityScore} />
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400">
                  <Link href={`/opportunities/${op.slug}`} className="hover:text-indigo-400 transition-colors">
                    {op.title}
                  </Link>
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{op.summary}</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <ConfidenceMeter confidence={op.confidenceScore} />
                <div className="flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-2">
                  <div>
                    <span className="text-zinc-500">Est. MVP:</span>{" "}
                    <span className="text-zinc-200 font-mono font-medium">
                      {formatMoneyRange(op.costRange)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Buyer:</span>{" "}
                    <span className="text-zinc-200 font-medium">
                      {op.buyer.replace("[Assumption] Inferred Buyer: ", "[Assumption] ")}
                    </span>
                  </div>
                </div>
                {op.publishedAt && (
                  <div className="text-[11px] font-mono text-zinc-500 pt-1">
                    Published: {new Date(op.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
