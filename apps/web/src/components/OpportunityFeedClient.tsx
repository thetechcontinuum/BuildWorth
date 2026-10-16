"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { StoredOpportunity } from "@/lib/opportunity-store";
import { WatchOpportunityButton } from "@/components/WatchOpportunityButton";
import { DiscoveryFeedSection } from "@/components/DiscoveryFeedSection";

export function OpportunityFeedClient() {
  const [activeTab, setActiveTab] = useState<"VERIFIED" | "DISCOVERY">("VERIFIED");
  const [opportunities, setOpportunities] = useState<StoredOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VERIFIED" | "HYPOTHESIS">("ALL");
  const [sortBy, setSortBy] = useState<string>("DATE");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load opportunities (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load opportunities");
      }
      setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while fetching verified opportunities.");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

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
        if (statusFilter === "VERIFIED" && op.publicationQualityStatus !== "VERIFIED") {
          return false;
        }
        if (statusFilter === "HYPOTHESIS" && op.publicationQualityStatus === "VERIFIED") {
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
  }, [opportunities, searchQuery, selectedIndustry, minScore, minConfidence, statusFilter, sortBy]);

  const industries = useMemo(() => {
    const base = new Set<string>([
      "ALL",
      "DevOps & Compliance",
      "Data Engineering & FinOps",
      "Software Engineering & DevOps",
    ]);
    for (const op of opportunities) {
      if (op.industry) base.add(op.industry);
    }
    return Array.from(base);
  }, [opportunities]);

  return (
    <div className="space-y-6">
      {/* Clean Defensible System Status Banner */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-zinc-300 font-medium">
            Daily Intelligence Automated Pipeline:{" "}
            <strong className="text-white">Active (Daily at 00:00 UTC / 01:15 UTC Fallback)</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Evidence-backed startup intelligence with transparent confidence scoring</span>
        </div>
      </div>

      {/* Feed Mode Switcher */}
      <div className="flex border-b border-zinc-800 text-sm font-medium">
        <button
          onClick={() => setActiveTab("VERIFIED")}
          className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "VERIFIED"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Verified Opportunities</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Policy v2.0.0
          </span>
        </button>

        <button
          onClick={() => setActiveTab("DISCOVERY")}
          className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "DISCOVERY"
              ? "border-amber-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>New Ideas to Explore</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Early Signals
          </span>
        </button>
      </div>

      {activeTab === "DISCOVERY" ? (
        <DiscoveryFeedSection />
      ) : (
        <>
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
            <span className="text-zinc-500 font-mono text-[11px] mr-1">Status:</span>
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                statusFilter === "ALL"
                  ? "bg-indigo-600 text-white font-medium shadow-sm"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
              }`}
            >
              All Briefs ({opportunities.length})
            </button>
            <button
              onClick={() => setStatusFilter("VERIFIED")}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                statusFilter === "VERIFIED"
                  ? "bg-emerald-600 text-white font-medium shadow-sm"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
              }`}
            >
              Policy v2.0.0 Verified ({opportunities.filter((o) => o.publicationQualityStatus === "VERIFIED").length})
            </button>
            <button
              onClick={() => setStatusFilter("HYPOTHESIS")}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                statusFilter === "HYPOTHESIS"
                  ? "bg-amber-600 text-white font-medium shadow-sm"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
              }`}
            >
              Early Hypotheses ({opportunities.filter((o) => o.publicationQualityStatus !== "VERIFIED").length})
            </button>

            <span className="text-zinc-600 mx-1">|</span>
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
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-zinc-800 rounded w-1/4" />
                  <div className="h-6 bg-zinc-800 rounded w-16" />
                </div>
                <div className="h-6 bg-zinc-800 rounded w-3/4" />
                <div className="h-12 bg-zinc-800/60 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center rounded-xl bg-red-950/20 border border-red-900/40 space-y-3">
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
        ) : filteredAndSortedOpportunities.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
            <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
              <ShieldCheck className="w-6 h-6 text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-white">
              {opportunities.length === 0
                ? "No Opportunity Briefs Published Yet"
                : "No Opportunities Match Selected Filters"}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {opportunities.length === 0
                ? "Market signals are continuously monitored. As concrete recurring problems and corroborating evidence are discovered and synthesized, briefs are published here automatically with explicit verification status."
                : "Try resetting your filter parameters or search terms to see available opportunities."}
            </p>
            {opportunities.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedIndustry("ALL");
                  setMinScore(0);
                  setMinConfidence(0);
                }}
                className="text-xs text-indigo-400 hover:underline pt-1 block mx-auto"
              >
                Reset filters
              </button>
            )}
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

                      <span className="text-xs font-mono text-zinc-500 ml-auto">
                        {new Date(op.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <Link href={`/opportunities/${op.slug}`} className="group block">
                      <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {op.title}
                      </h2>
                    </Link>

                    <p className="text-sm text-zinc-300 leading-relaxed">
                      <strong className="text-zinc-100">Problem:</strong>{" "}
                      {op.problemStatement || op.summary}
                    </p>

                    {/* Structured Opportunity Brief Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs">
                      <div className="space-y-1">
                        <div className="text-zinc-400">
                          <span className="text-indigo-400 font-semibold">Proposed Product:</span>{" "}
                          <span className="text-zinc-200">
                            {op.proposedProduct || op.narrowMvpScope?.[0] || "Targeted workflow automation service"}
                          </span>
                        </div>
                        <div className="text-zinc-400">
                          <span className="text-zinc-300 font-semibold">Existing Alternatives:</span>{" "}
                          <span>
                            {op.existingCompetitors && op.existingCompetitors.length > 0
                              ? op.existingCompetitors.slice(0, 2).join("; ")
                              : op.competitors && op.competitors.length > 0
                              ? op.competitors.map((c) => c.name).slice(0, 2).join("; ")
                              : op.existingWorkflow || "Manual scripts and ad-hoc engineering workarounds"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-zinc-400">
                          <span className="text-emerald-400 font-semibold">Commercial Indicator:</span>{" "}
                          <span>
                            {op.evidenceOfDemand?.[0] ||
                              op.evidenceOfWillingnessToPay?.[0] ||
                              `Backed by ${op.signalsCount} cited problem signal(s); direct budget commitment requires buyer validation.`}
                          </span>
                        </div>
                        {op.recommendedExperiment && (
                          <div className="text-zinc-400">
                            <span className="text-amber-400 font-semibold">Next Validation Step:</span>{" "}
                            <span>{op.recommendedExperiment}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assumptions & Evidence Gaps */}
                    {((op.majorAssumptions && op.majorAssumptions.length > 0) ||
                      (op.majorRisks && op.majorRisks.length > 0)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-1">
                        {op.majorAssumptions && op.majorAssumptions.length > 0 && (
                          <div className="p-2.5 rounded bg-amber-950/15 border border-amber-500/20">
                            <span className="text-amber-400 font-semibold block mb-0.5">
                              Explicit Assumptions:
                            </span>
                            <span className="text-zinc-300">{op.majorAssumptions[0]}</span>
                          </div>
                        )}
                        {op.majorRisks && op.majorRisks.length > 0 && (
                          <div className="p-2.5 rounded bg-zinc-950/60 border border-zinc-800">
                            <span className="text-zinc-300 font-semibold block mb-0.5">
                              Evidence Gaps:
                            </span>
                            <span className="text-zinc-400">{op.majorRisks[0]}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cited Empirical Evidence Links & Dates */}
                    {op.evidenceLinks && op.evidenceLinks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                          Cited Source Evidence ({op.evidenceLinks.length} signal{op.evidenceLinks.length === 1 ? "" : "s"}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {op.evidenceLinks.slice(0, 4).map((link, lIdx) => {
                            const sig = link.signal as any;
                            const targetUrl = sig?.canonicalUrl;
                            const sourceLabel = sig?.sourceName || "Source";
                            const pubDate = sig?.publishedAt
                              ? new Date(sig.publishedAt).toISOString().split("T")[0]
                              : (link as any).createdAt
                              ? new Date((link as any).createdAt).toISOString().split("T")[0]
                              : "";
                            const excerptSnippet = sig?.sourceTitle || sig?.sanitizedExcerpt || link.claimSnippet || "Evidence link";
                            return targetUrl ? (
                              <a
                                key={lIdx}
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950/80 border border-zinc-800 hover:border-indigo-500/50 text-[11px] text-zinc-300 hover:text-indigo-300 transition-colors font-mono"
                                title={excerptSnippet}
                              >
                                <span className="text-indigo-400 font-semibold">
                                  {sourceLabel}{pubDate ? ` (${pubDate})` : ""}:
                                </span>
                                <span className="truncate max-w-[180px] sm:max-w-[260px]">{excerptSnippet}</span>
                                <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
                              </a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
                      <div>
                        <span className="text-zinc-500">Affected Customer / Buyer:</span>{" "}
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
        </>
      )}
    </div>
  );
}
