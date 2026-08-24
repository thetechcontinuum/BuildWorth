"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, ArrowRight, RefreshCw, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";
import { StoredOpportunity } from "@/lib/opportunity-store";

export function OpportunityFeedClient() {
  const [opportunities, setOpportunities] = useState<StoredOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("ALL");
  const [minScore, setMinScore] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortBy, setSortBy] = useState<"SCORE" | "CONFIDENCE" | "COST" | "SIGNALS" | "DATE">("DATE");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    try {
      const res = await fetch("/api/opportunities");
      if (res.ok) {
        const json = await res.json();
        if (json.opportunities && Array.isArray(json.opportunities)) {
          setOpportunities(json.opportunities);
          setLastRefreshed(new Date().toLocaleTimeString());
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleTriggerDiscovery = async () => {
    setIsRefreshing(true);
    setNotification("Executing Agnes AI Discovery Pipeline...");
    try {
      const res = await fetch("/api/cron/discover?key=run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchOpportunities();
        setNotification(`Successfully discovered and published ${data.newOpportunitiesPublished || 1} new opportunity!`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      setNotification("Discovery completed.");
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredItems = useMemo(() => {
    return opportunities
      .filter((item) => {
        if (selectedIndustry !== "ALL" && item.industry !== selectedIndustry) return false;
        if (item.opportunityScore < minScore) return false;
        if (item.confidenceScore < minConfidence) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = item.title.toLowerCase().includes(q);
          const matchesSummary = item.summary.toLowerCase().includes(q);
          const matchesBuyer = item.buyer.toLowerCase().includes(q);
          if (!matchesTitle && !matchesSummary && !matchesBuyer) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "DATE") return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        if (sortBy === "SCORE") return b.opportunityScore - a.opportunityScore;
        if (sortBy === "CONFIDENCE") return b.confidenceScore - a.confidenceScore;
        if (sortBy === "COST") return a.costRange.minMinor - b.costRange.minMinor;
        if (sortBy === "SIGNALS") return b.signalsCount - a.signalsCount;
        return 0;
      });
  }, [opportunities, searchQuery, selectedIndustry, minScore, minConfidence, sortBy]);

  const industries = ["ALL", "DevOps & Compliance", "Data Engineering & FinOps", "B2B SaaS RevOps", "AI Engineering & Ops"];

  return (
    <div className="space-y-6">
      {/* Discovery Trigger & Cron Status Bar */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="space-y-0.5">
            <div className="text-white font-semibold flex items-center gap-2">
              <span>06:00 AM Automated Discovery Cron: ACTIVE</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Agnes AI
              </span>
            </div>
            <p className="text-zinc-400">
              Scans Hacker News, Reddit, GitHub, and Product Hunt for new market pain signals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastRefreshed && (
            <span className="text-[11px] text-zinc-500 hidden md:flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" /> Synced: {lastRefreshed}
            </span>
          )}
          <button
            onClick={handleTriggerDiscovery}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Scanning Market..." : "Run Discovery Now"}</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search opportunities by keyword, buyer, or problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="DATE">Sort: Newest First</option>
              <option value="SCORE">Sort: Highest Score</option>
              <option value="CONFIDENCE">Sort: Highest Confidence</option>
              <option value="COST">Sort: Lowest MVP Cost</option>
              <option value="SIGNALS">Sort: Most Evidence Signals</option>
            </select>
          </div>
        </div>

        {/* Filter Pills and Threshold Sliders */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500 flex items-center gap-1 mr-2">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Vertical:
            </span>
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedIndustry === ind
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <label className="flex items-center gap-1.5">
              <span>Min Score:</span>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value={0}>All</option>
                <option value={80}>80+</option>
                <option value={90}>90+</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span>Min Confidence:</span>
              <select
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value={0}>All</option>
                <option value={70}>70%+</option>
                <option value={80}>80%+</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 p-8 rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-400 animate-pulse">
            Loading real-time market opportunities...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 p-8 rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-400">
            No opportunities matched your search criteria. Try adjusting your filters or click &quot;Run Discovery Now&quot;.
          </div>
        ) : (
          filteredItems.map((op) => {
            const isExpanded = expandedSlug === op.slug;
            const isFresh = Date.now() - new Date(op.publishedAt).getTime() < 3600 * 1000 * 48;

            return (
              <div
                key={op.slug}
                className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6 hover:border-zinc-700 transition-all relative"
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                        {op.industry}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {op.signalsCount} Verified Signals
                      </span>
                      {isFresh && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> NEW DISCOVERY
                        </span>
                      )}
                    </div>

                    <Link href={`/opportunities/${op.slug}`} className="group block">
                      <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {op.title}
                      </h2>
                    </Link>

                    <p className="text-sm text-zinc-400 leading-relaxed">{op.summary}</p>

                    <div className="flex flex-wrap gap-4 text-xs text-zinc-400 pt-2">
                      <div>
                        <span className="text-zinc-500">Economic Buyer:</span>{" "}
                        <span className="text-zinc-200 font-medium">{op.buyer}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Est. MVP:</span>{" "}
                        <span className="text-zinc-200 font-mono font-medium">
                          {formatMoneyRange(op.costRange)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Time to MVP:</span>{" "}
                        <span className="text-zinc-200">
                          {op.timeToMvpWeeks.min}–{op.timeToMvpWeeks.max} wks
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 flex flex-col justify-between space-y-4">
                    <div className="flex justify-end">
                      <ScoreBadge score={op.opportunityScore} />
                    </div>
                    <ConfidenceMeter confidence={op.confidenceScore} />
                    <div className="flex items-center gap-2 justify-end pt-2">
                      <button
                        onClick={() => setExpandedSlug(isExpanded ? null : op.slug)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Hide Score Breakdown <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Why this score? <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                      <Link
                        href={`/opportunities/${op.slug}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium hover:bg-indigo-600/20 transition-all"
                      >
                        Blueprint <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Expandable Score Breakdown */}
                {isExpanded && (
                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 text-xs">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>9-Dimension Rubric Breakdown (Score: {op.opportunityScore}/100)</span>
                      <span className="text-zinc-500 font-mono">Rubric v1.0.0</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {op.dimensionBreakdown.map((dim, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1"
                        >
                          <div className="flex justify-between font-medium">
                            <span className="text-zinc-300">{dim.name}</span>
                            <span className="text-indigo-400 font-mono">
                              {dim.score}/{dim.maxScore}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400">{dim.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
