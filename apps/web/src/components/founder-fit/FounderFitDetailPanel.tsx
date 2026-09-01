"use client";

import React, { useState } from "react";
import { FounderFitEvaluationResult, FitRecommendationCategory } from "@buildworth/shared";
import {
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  evaluation?: FounderFitEvaluationResult | null;
  hasProfile?: boolean;
}

export function FounderFitDetailPanel({ evaluation, hasProfile = true }: Props) {
  const [showDimensionBreakdown, setShowDimensionBreakdown] = useState(false);

  if (!hasProfile || !evaluation) {
    return (
      <div
        id="section-founder-fit"
        className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Your Founder Fit</h2>
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                Personalized Intelligence
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              Evaluate this venture opportunity against your specific skills, budget, capacity, and
              market advantages.
            </p>
          </div>
          <a
            href="/onboarding"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            Find Opportunities That Fit You
          </a>
        </div>
      </div>
    );
  }

  const categoryColor: Record<FitRecommendationCategory, string> = {
    EXCELLENT_MATCH: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    STRONG_MATCH: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    POSSIBLE_MATCH: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    POSSIBLE_WITH_GAPS: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    CHALLENGING_MATCH: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    POOR_MATCH: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    BLOCKED: "text-rose-400 bg-rose-500/20 border-rose-500/40 font-bold",
    INSUFFICIENT_PROFILE_DATA: "text-zinc-400 bg-zinc-800/40 border-zinc-700",
  };

  return (
    <div
      id="section-founder-fit"
      data-testid="founder-fit-dimensions"
      className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6"
    >
      {/* Header & Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Your Founder Fit</h2>
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${categoryColor[evaluation.recommendationCategory]}`}
            >
              {evaluation.recommendationCategory.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Deterministic personalized venture compatibility evaluated against your active profile
            revision.
          </p>
        </div>

        {/* Quick Metrics */}
        <div className="flex items-center gap-4">
          <div className="bg-zinc-950/80 border border-zinc-800 px-4 py-2 rounded-xl text-center">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Founder Fit
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {evaluation.founderFitScore}
              <span className="text-xs text-zinc-500">/100</span>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 px-4 py-2 rounded-xl text-center">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Fit Confidence
            </div>
            <div className="text-2xl font-bold text-indigo-400 font-mono">
              {evaluation.fitConfidence}%
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 px-4 py-2 rounded-xl text-center">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Personalized Rank
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {evaluation.personalizedRank}
            </div>
          </div>
        </div>
      </div>

      {/* Hard Blockers & Capability Breakdown */}
      {evaluation.blockers.length > 0 && (
        <div
          data-testid="founder-fit-blockers"
          className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-rose-500/20">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>
                {evaluation.blockers.filter((b) => !b.isRemovable).length} Hard Blocker(s) &amp;{" "}
                {evaluation.blockers.filter((b) => b.isRemovable).length} Removable Blocker(s)
                Identified
              </span>
            </div>
            <span className="text-[11px] font-mono text-rose-300 font-semibold">
              Total Penalty Applied: -
              {evaluation.penalties.reduce((acc, p) => acc + p.penaltyPoints, 0)} pts
            </span>
          </div>

          <div className="space-y-2 text-xs text-zinc-300">
            {evaluation.blockers.map((b, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-zinc-950/60 border border-rose-500/20 space-y-1"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                      {b.code}
                    </span>
                    <span className="text-zinc-400">
                      [{b.isRemovable ? "REMOVABLE — Penalty -7" : "NON-REMOVABLE — Penalty -25"}]
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    Severity: {b.severity}
                  </span>
                </div>
                <div className="text-zinc-300">{b.explanation}</div>
                {b.suggestedMitigation && (
                  <div className="text-[11px] text-zinc-400">
                    ↳ <span className="text-indigo-400">Suggested Mitigation:</span>{" "}
                    {b.suggestedMitigation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {evaluation.penalties.length > 0 && (
            <div className="pt-2 border-t border-rose-500/20 flex flex-wrap gap-3 text-[11px] font-mono text-zinc-400">
              <span className="text-zinc-300 font-semibold">Score Derivation:</span>
              <span>Base Rank: {evaluation.baseRank}</span>
              {evaluation.penalties.map((p, idx) => (
                <span key={idx} className="text-rose-400">
                  {p.reason}: -{p.penaltyPoints}
                </span>
              ))}
              <span className="text-emerald-400 font-bold">
                = Final Personalized Rank: {evaluation.personalizedRank}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Strengths and Gaps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" /> Your Unfair Advantages & Strengths
          </div>
          {evaluation.strengths.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No strong proprietary overlaps recorded in profile.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {evaluation.strengths.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60 space-y-1"
                >
                  <div className="font-semibold text-zinc-200">{s.title}</div>
                  <div className="text-[11px] text-zinc-400">{s.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gaps & Actionable Mitigations */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" /> Capability Gaps & Mitigations
          </div>
          {evaluation.gaps.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Zero critical capability gaps detected for Milestone 1.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {evaluation.gaps.map((g, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60 space-y-1"
                >
                  <div className="font-semibold text-zinc-200">{g.title}</div>
                  <div className="text-[11px] text-zinc-400">{g.description}</div>
                  <div className="text-[11px] text-amber-300/80 bg-amber-500/10 px-2 py-1 rounded">
                    <strong>Suggested Action:</strong> {g.mitigationSuggestion}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable 8-Dimension Rubric Breakdown */}
      <div className="pt-2">
        <button
          onClick={() => setShowDimensionBreakdown(!showDimensionBreakdown)}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2 font-mono">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Inspect 8-Dimension Rubric Breakdown
          </span>
          {showDimensionBreakdown ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showDimensionBreakdown && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3">
            {evaluation.dimensions.map((dim, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-zinc-200">{dim.name}</span>
                  <span className="font-mono text-indigo-400">
                    {dim.score}/{dim.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{dim.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
