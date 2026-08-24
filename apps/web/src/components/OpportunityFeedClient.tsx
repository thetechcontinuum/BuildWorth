"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";
import { StoredOpportunity, INITIAL_OPPORTUNITIES } from "@/lib/opportunity-store";

export function OpportunityFeedClient() {
  const [opportunities, setOpportunities] = useState<StoredOpportunity[]>(INITIAL_OPPORTUNITIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("ALL");
  const [minScore, setMinScore] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortBy, setSortBy] = useState<"SCORE" | "CONFIDENCE" | "COST" | "SIGNALS" | "DATE">(
    "DATE",
  );
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/opportunities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.opportunities && Array.isArray(data.opportunities)) {
          setOpportunities((prev) => {
            const map = new Map<string, StoredOpportunity>();
            data.opportunities.forEach((o: StoredOpportunity) => map.set(o.slug, o));
            prev.forEach((o: StoredOpportunity) => {
              if (!map.has(o.slug)) map.set(o.slug, o);
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, []);

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
        if (sortBy === "DATE")
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        if (sortBy === "SCORE") return b.opportunityScore - a.opportunityScore;
        if (sortBy === "CONFIDENCE") return b.confidenceScore - a.confidenceScore;
        if (sortBy === "COST") return a.costRange.minMinor - b.costRange.minMinor;
        if (sortBy === "SIGNALS") return b.signalsCount - a.signalsCount;
        return 0;
      });
  }, [opportunities, searchQuery, selectedIndustry, minScore, minConfidence, sortBy]);

  const industries = [
    "ALL",
    "DevOps & Compliance",
    "Data Engineering & FinOps",
    "B2B SaaS RevOps",
    "AI Engineering & Ops",
  ];

  return (
    <div className="space-y-6">
      {/* Clean Defensible System Status Banner */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-zinc-300 font-medium">
            Daily Intelligence Automated Pipeline:{" "}
            <strong className="text-white">Active (Every morning at 06:00 AM)</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Evidence-backed startup intelligence with transparent confidence scoring</span>
        </div>
      </div>

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
                <option value={85}>85+</option>
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
                <option value={50}>50%+</option>
                <option value={75}>75%+</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 p-8 rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-400">
            No opportunities matched your search criteria. Try adjusting your filters.
          </div>
        ) : (
          filteredItems.map((op) => {
            const isExpanded = expandedSlug === op.slug;
            const isFresh = Date.now() - new Date(op.publishedAt).getTime() < 3600 * 1000 * 48;
            const isVerified = op.publicationQualityStatus === "VERIFIED";

            return (
              <div
                key={op.slug}
                className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6 hover:border-zinc-700 transition-all relative"
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                        {op.industry}
                      </span>

                      {isVerified ? (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          {op.signalsCount} verified signals across 3 sources
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          Hypothesis — evidence not yet verified
                        </span>
                      )}

                      {isFresh && isVerified && (
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
                      <span className="text-zinc-500 font-mono">Rubric v2.0.0</span>
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
                          <p className="text-[11px] text-zinc-400">
                            {dim.isAssumption ? (
                              <span className="text-amber-400/90 font-medium">[Assumption] </span>
                            ) : null}
                            {dim.explanation}
                          </p>
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
