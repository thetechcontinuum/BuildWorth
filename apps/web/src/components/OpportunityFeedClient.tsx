"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";

export interface OpportunityItem {
  slug: string;
  title: string;
  summary: string;
  industry: string;
  customerType: string;
  opportunityScore: number;
  confidenceScore: number;
  costRange: { minMinor: number; maxMinor: number; currency: "USD" };
  timeToMvpWeeks: { min: number; max: number };
  buyer: string;
  signalsCount: number;
  recommendedExperiment: string;
  dimensionBreakdown: { name: string; score: number; maxScore: number; explanation: string }[];
}

const INITIAL_DATA: OpportunityItem[] = [
  {
    slug: "automated-soc2-evidence-collector",
    title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
    summary:
      "Eliminates quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 89,
    confidenceScore: 84,
    costRange: { minMinor: 500000, maxMinor: 1200000, currency: "USD" },
    timeToMvpWeeks: { min: 4, max: 8 },
    buyer: "VP of Engineering",
    signalsCount: 28,
    recommendedExperiment:
      "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo with a 14-day refund guarantee.",
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 14,
        maxScore: 15,
        explanation: "Recurring 40hr/quarter screenshot burden documented across 3 platforms.",
      },
      {
        name: "Buyer Demand & WTP",
        score: 13,
        maxScore: 15,
        explanation: "Target buyers already spending $15k/yr on incomplete audit suites.",
      },
      {
        name: "Technical Feasibility",
        score: 15,
        maxScore: 15,
        explanation: "Standard GitHub Action + Vercel Webhook architecture.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 14,
        maxScore: 15,
        explanation: "Saves ~30 engineering hours ($2,000 value) per month.",
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Growing market driven by mandatory SOC2 compliance for B2B SaaS.",
      },
      {
        name: "Buyer Accessibility",
        score: 8,
        maxScore: 10,
        explanation: "Reachable via developer communities and LinkedIn.",
      },
      {
        name: "Competition & Differentiation",
        score: 8,
        maxScore: 10,
        explanation: "Incumbents like Vanta lack deep git-level automation.",
      },
      {
        name: "Speed to Validation",
        score: 5,
        maxScore: 5,
        explanation: "Can be validated via concierge demo in under 14 days.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "High switching cost once embedded in CI pipeline.",
      },
    ],
  },
  {
    slug: "finops-snowflake-anomaly-canceler",
    title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
    summary:
      "Real-time query cost interception that prevents unexpected $10k+ warehouse budget blowouts.",
    industry: "Data Engineering & FinOps",
    customerType: "B2B",
    opportunityScore: 92,
    confidenceScore: 78,
    costRange: { minMinor: 400000, maxMinor: 900000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 6 },
    buyer: "Head of Data",
    signalsCount: 42,
    recommendedExperiment:
      "Publish an open-source query watchdog script; capture waitlist for the hosted auto-canceler.",
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 15,
        maxScore: 15,
        explanation: "Frequent 5-figure budget spikes causing severe leadership friction.",
      },
      {
        name: "Buyer Demand & WTP",
        score: 14,
        maxScore: 15,
        explanation: "Companies happily pay $200-$500/mo insurance to prevent $10k mistakes.",
      },
      {
        name: "Technical Feasibility",
        score: 14,
        maxScore: 15,
        explanation: "Requires Snowflake REST API & query log webhooks.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 15,
        maxScore: 15,
        explanation: "Instant ROI upon preventing first runaway query.",
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Cloud data warehouse spending expanding rapidly.",
      },
      {
        name: "Buyer Accessibility",
        score: 8,
        maxScore: 10,
        explanation: "Active community in r/dataengineering and dbt Slack.",
      },
      {
        name: "Competition & Differentiation",
        score: 9,
        maxScore: 10,
        explanation: "Native Snowflake alerts are delayed by up to 24 hours.",
      },
      {
        name: "Speed to Validation",
        score: 4,
        maxScore: 5,
        explanation: "Requires sandbox account for live demo.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "Historical query pattern intelligence and tuning heuristics.",
      },
    ],
  },
  {
    slug: "hubspot-stripe-invoice-reconciler",
    title: "HubSpot <> Stripe Invoice Reconciliation Watchdog",
    summary:
      "Resolves recurring invoice reconciliation mismatches between sales reps and finance without custom ERP code.",
    industry: "B2B SaaS RevOps",
    customerType: "B2B",
    opportunityScore: 85,
    confidenceScore: 68,
    costRange: { minMinor: 300000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "Director of RevOps",
    signalsCount: 19,
    recommendedExperiment:
      "Cold outreach to 20 RevOps leads experiencing manual reconciliation friction with demo video.",
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 13,
        maxScore: 15,
        explanation: "End-of-month finance panic caused by CRM <> Stripe sync lags.",
      },
      {
        name: "Buyer Demand & WTP",
        score: 13,
        maxScore: 15,
        explanation: "Standard RevOps software budget readily available.",
      },
      {
        name: "Technical Feasibility",
        score: 15,
        maxScore: 15,
        explanation: "Standard OAuth connectors with Stripe & HubSpot.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 13,
        maxScore: 15,
        explanation: "Saves 15 hours of manual spreadsheet matching per month.",
      },
      {
        name: "Market Attractiveness",
        score: 8,
        maxScore: 10,
        explanation: "Large pool of SaaS companies on HubSpot + Stripe stack.",
      },
      {
        name: "Buyer Accessibility",
        score: 9,
        maxScore: 10,
        explanation: "Very active RevOps Slack and LinkedIn groups.",
      },
      {
        name: "Competition & Differentiation",
        score: 7,
        maxScore: 10,
        explanation: "Generic iPaaS (Zapier) fails at deep state reconciliation.",
      },
      {
        name: "Speed to Validation",
        score: 4,
        maxScore: 5,
        explanation: "Concierge manual audit test can be executed in 7 days.",
      },
      { name: "Defensibility", score: 3, maxScore: 5, explanation: "Moderate switching friction." },
    ],
  },
];

export function OpportunityFeedClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("ALL");
  const [minScore, setMinScore] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortBy, setSortBy] = useState<"SCORE" | "CONFIDENCE" | "COST" | "SIGNALS">("SCORE");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return INITIAL_DATA.filter((item) => {
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
    }).sort((a, b) => {
      if (sortBy === "SCORE") return b.opportunityScore - a.opportunityScore;
      if (sortBy === "CONFIDENCE") return b.confidenceScore - a.confidenceScore;
      if (sortBy === "COST") return a.costRange.minMinor - b.costRange.minMinor;
      if (sortBy === "SIGNALS") return b.signalsCount - a.signalsCount;
      return 0;
    });
  }, [searchQuery, selectedIndustry, minScore, minConfidence, sortBy]);

  const industries = ["ALL", "DevOps & Compliance", "Data Engineering & FinOps", "B2B SaaS RevOps"];

  return (
    <div className="space-y-6">
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
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 p-8 rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-400">
            No opportunities matched your search criteria. Try adjusting your filters.
          </div>
        ) : (
          filteredItems.map((op) => {
            const isExpanded = expandedSlug === op.slug;
            return (
              <div
                key={op.slug}
                className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6 hover:border-zinc-700 transition-all"
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
