import React from "react";
import { FullVentureBlueprint, DecisionRecommendation } from "@buildworth/shared";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { WatchOpportunityButton } from "@/components/WatchOpportunityButton";

interface ExecutiveDecisionSummaryProps {
  blueprint: FullVentureBlueprint;
  opportunityTitle: string;
  oneSentenceSummary: string;
  slug: string;
}

export function ExecutiveDecisionSummary({
  blueprint,
  opportunityTitle,
  oneSentenceSummary,
  slug,
}: ExecutiveDecisionSummaryProps) {
  const { decisionEvaluation, financialScenarios, customerSegments, risks, validationExperiments } =
    blueprint;
  const baseScenario =
    financialScenarios.find((s) => s.scenarioType === "BASE") || financialScenarios[0];
  const primarySegment = customerSegments[0];
  const topExperiment = validationExperiments[0];

  const getRecommendationBadge = (rec: DecisionRecommendation) => {
    switch (rec) {
      case "BUILD_CANDIDATE":
        return {
          bg: "bg-emerald-950/80 border-emerald-500/50 text-emerald-300",
          label: "BUILD CANDIDATE",
          icon: "🚀",
          desc: "All commercial, evidence confidence, and financial thresholds passed.",
        };
      case "VALIDATE_FIRST":
        return {
          bg: "bg-amber-950/80 border-amber-500/50 text-amber-300",
          label: "VALIDATE FIRST",
          icon: "⚠️",
          desc: "Promising pain signal; requires direct willingness-to-pay evidence prior to build.",
        };
      case "WATCH":
        return {
          bg: "bg-blue-950/80 border-blue-500/50 text-blue-300",
          label: "WATCH & MONITOR",
          icon: "👀",
          desc: "Monitor timing, incumbent motion, and market freshness before capital allocation.",
        };
      case "WEAK_OPPORTUNITY":
        return {
          bg: "bg-orange-950/80 border-orange-500/50 text-orange-300",
          label: "WEAK OPPORTUNITY",
          icon: "🛑",
          desc: "Below commercial viability floor or structurally low willingness to pay.",
        };
      case "REJECT":
        return {
          bg: "bg-rose-950/80 border-rose-500/50 text-rose-300",
          label: "REJECT",
          icon: "⛔",
          desc: "Negative unit economics or critical assumption invalidated.",
        };
      default:
        return {
          bg: "bg-zinc-800/80 border-zinc-700 text-zinc-300",
          label: "UNASSESSED",
          icon: "📋",
          desc: "Awaiting formal evaluation run.",
        };
    }
  };

  const badge = getRecommendationBadge(decisionEvaluation.recommendation);

  return (
    <div
      id="section-executive-summary"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
    >
      {/* Title & Decision Badge Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
              DECISION-GRADE BLUEPRINT v{blueprint.schemaVersion}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              Rule Rubric v{decisionEvaluation.decisionRuleVersion}
            </span>
            <WatchOpportunityButton opportunitySlug={slug} size="sm" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
            {opportunityTitle}
          </h1>
          <p className="text-base text-zinc-400 max-w-3xl leading-relaxed">{oneSentenceSummary}</p>
        </div>

        {/* Big Decision Card */}
        <div
          className={`p-4 rounded-xl border ${badge.bg} flex flex-col justify-center min-w-[280px] space-y-1`}
        >
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Decision Recommendation
          </div>
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </div>
          <div className="text-xs text-zinc-300 leading-snug">{badge.desc}</div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Opportunity Score</div>
          <ScoreBadge score={decisionEvaluation.opportunityScoreUsed} size="md" />
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Evidence Conf.</div>
          <ConfidenceMeter confidence={decisionEvaluation.evidenceConfidenceUsed} />
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Base Price / Mo</div>
          <div className="text-base font-bold text-zinc-100">
            {baseScenario?.monthlyPriceCents ? `$${baseScenario.monthlyPriceCents / 100}` : "N/A"}
          </div>
          <div className="text-[10px] text-zinc-500">
            Gross Margin {baseScenario?.grossMarginPercent.value ?? 0}%
          </div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Break-Even</div>
          <div className="text-base font-bold text-zinc-100">
            {baseScenario?.breakEvenCustomers.value
              ? `${baseScenario.breakEvenCustomers.value} cust`
              : "N/A"}
          </div>
          <div className="text-[10px] text-zinc-500">Operating Cost Offset</div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Time to MVP</div>
          <div className="text-base font-bold text-zinc-100">
            {baseScenario?.deliveryTimeWeeks ? `${baseScenario.deliveryTimeWeeks} wks` : "N/A"}
          </div>
          <div className="text-[10px] text-zinc-500">Must-Have Scope</div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/80 p-3.5 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Economic Buyer</div>
          <div className="text-xs font-semibold text-zinc-200 truncate">
            {primarySegment?.economicBuyerRole || "Tech Leader"}
          </div>
          <div className="text-[10px] text-zinc-500 truncate">
            {primarySegment?.spendingBehavior?.slice(0, 24) || "Direct Auth"}
          </div>
        </div>
      </div>

      {/* Riskiest Assumption & Next Validation Experiment Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 flex items-start gap-3">
          <span className="text-rose-400 text-lg">⚠️</span>
          <div className="space-y-0.5">
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Riskiest Assumption
            </div>
            <div className="text-xs text-zinc-200 leading-snug">
              {risks[0]?.description ||
                "Incumbents develop native solution before distribution moat is established."}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 flex items-start gap-3">
          <span className="text-indigo-400 text-lg">🧪</span>
          <div className="space-y-0.5">
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Cheapest Next Validation Experiment
            </div>
            <div className="text-xs text-zinc-200 leading-snug">
              {topExperiment?.hypothesis ||
                "Launch landing page test with 14-day money-back guarantee to measure paid pilot conversions."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
