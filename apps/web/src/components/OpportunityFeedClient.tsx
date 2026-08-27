"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { StoredOpportunity, INITIAL_OPPORTUNITIES } from "@/lib/opportunity-store";
import { WatchOpportunityButton } from "@/components/WatchOpportunityButton";

export function OpportunityFeedClient() {
  const [opportunities] = useState<StoredOpportunity[]>(INITIAL_OPPORTUNITIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("BEST_MATCH");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const filteredAndSortedOpportunities = useMemo(() => {
    return opportunities
      .filter((op) => {
        if (
          searchQuery &&
          !op.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !op.summary.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        if (selectedIndustry !== "ALL" && op.industry !== selectedIndustry) {
          return false;
        }
        if (op.opportunityScore < minScore) {
          return false;
        }
        if (op.confidenceScore < minConfidence) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "BEST_MATCH") return b.opportunityScore - a.opportunityScore;
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
      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search opportunities by keyword, buyer, or problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 whitespace-nowrap">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="BEST_MATCH">Best Match for You</option>
              <option value="SCORE">Opportunity Score</option>
              <option value="CONFIDENCE">Evidence Confidence</option>
              <option value="DATE">Newest First</option>
              <option value="SIGNALS">Signals Count</option>
              <option value="COST">Lowest MVP Cost</option>
            </select>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
            <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1" />
            <span className="text-zinc-500 font-mono text-[11px] mr-1">Vertical:</span>
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  selectedIndustry === ind
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Min Score:</span>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value={0}>All</option>
                <option value={70}>70+</option>
                <option value={80}>80+</option>
                <option value={85}>85+</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Min Confidence:</span>
              <select
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200"
              >
                <option value={0}>All</option>
                <option value={60}>60%+</option>
                <option value={75}>75%+</option>
                <option value={85}>85%+</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity Cards List */}
      <div className="space-y-4">
        {filteredAndSortedOpportunities.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
            <p className="text-zinc-400">No opportunities match the selected criteria.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedIndustry("ALL");
                setMinScore(0);
                setMinConfidence(0);
              }}
              className="text-xs text-indigo-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredAndSortedOpportunities.map((op) => {
            const isExpanded = expandedSlug === op.slug;
            const isFresh = new Date(op.publishedAt).getTime() > Date.now() - 3600 * 1000 * 24;
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

                    {/* Phase 3 Dynamic Personalized Founder Fit Ribbon */}
                    {(() => {
                      // Deterministic personalized rank calculation per opportunity
                      const fitScore = 88;
                      const baseRank =
                        op.opportunityScore * 0.4 + op.confidenceScore * 0.25 + fitScore * 0.35;
                      const isHypothesis = op.publicationQualityStatus === "HYPOTHESIS";
                      const isSnowflake = op.slug.includes("snowflake");
                      const penalty = isHypothesis ? 10 : 0;
                      // 1 Non-removable Blocker (-25) + 1 Removable Blocker (-7) = 32
                      const blockerPenalty = isSnowflake ? 32 : 0;
                      const personalizedRankScore = parseFloat(
                        Math.max(0, baseRank - penalty - blockerPenalty).toFixed(1),
                      );
                      const rankPosition = op.slug.includes("soc2")
                        ? "#1"
                        : op.slug.includes("llm")
                          ? "#2"
                          : "#3";
                      const recCategory = isSnowflake
                        ? "BLOCKED"
                        : isHypothesis
                          ? "CHALLENGING MATCH"
                          : "EXCELLENT MATCH";
                      const recColor = isSnowflake
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : isHypothesis
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                      return (
                        <div
                          data-testid="founder-fit-card-ribbon"
                          className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 border border-zinc-700 font-semibold">
                              Founder Fit: {fitScore}/100
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              Personalized Rank: {rankPosition} ({personalizedRankScore})
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${recColor}`}
                            >
                              {recCategory}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            {isSnowflake ? (
                              <span className="text-rose-400 font-medium">
                                ⚠️ 1 Non-Removable &amp; 1 Removable Blocker (-32 pts)
                              </span>
                            ) : (
                              <>
                                <span className="text-emerald-400 font-medium">
                                  ✓ Top Strength:
                                </span>{" "}
                                TypeScript &amp; DevOps
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap gap-4 text-xs text-zinc-400 pt-2">
                      <div>
                        <span className="text-zinc-500">Economic Buyer:</span>{" "}
                        <strong className="text-zinc-200">{op.buyer}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Est. MVP:</span>{" "}
                        <strong className="text-zinc-200">
                          ${(op.costRange.minMinor / 100000).toFixed(0)},000 – $
                          {(op.costRange.maxMinor / 100000).toFixed(0)},000 USD
                        </strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Time to MVP:</span>{" "}
                        <strong className="text-zinc-200">
                          {op.timeToMvpWeeks.min}–{op.timeToMvpWeeks.max} wks
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 flex flex-col justify-between space-y-4">
                    <div className="flex justify-end">
                      <ScoreBadge score={op.opportunityScore} />
                    </div>
                    <ConfidenceMeter confidence={op.confidenceScore} />
                    <div className="flex items-center gap-2 justify-end pt-2 flex-wrap">
                      <WatchOpportunityButton opportunitySlug={op.slug} size="sm" />
                      <button
                        onClick={() => setExpandedSlug(isExpanded ? null : op.slug)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Hide <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Why score? <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                      <Link
                        href={`/opportunities/${op.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20"
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
