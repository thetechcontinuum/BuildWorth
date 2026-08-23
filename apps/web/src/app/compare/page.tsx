import React from "react";
import Link from "next/link";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Compare Opportunities — BuildWorth",
  description: "Side-by-side comparative analysis of venture blueprints.",
};

export default function ComparePage() {
  const oppA = {
    slug: "automated-soc2-evidence-collector",
    title: "Automated SOC2 Git Evidence Collector",
    industry: "DevOps & Compliance",
    score: 89,
    confidence: 84,
    cost: { minMinor: 500000, maxMinor: 1200000, currency: "USD" as const },
    weeks: "4–8 weeks",
    buyer: "VP of Engineering",
    price: "$149–$399/mo",
    margin: "85%",
    breakEven: "4–8 customers",
    experiment: "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo.",
  };

  const oppB = {
    slug: "finops-snowflake-anomaly-canceler",
    title: "Snowflake Runaway Query Circuit Breaker",
    industry: "Data Engineering & FinOps",
    score: 92,
    confidence: 78,
    cost: { minMinor: 400000, maxMinor: 900000, currency: "USD" as const },
    weeks: "3–6 weeks",
    buyer: "Head of Data",
    price: "$199–$499/mo",
    margin: "85%",
    breakEven: "3–6 customers",
    experiment: "Publish open-source query watchdog; capture waitlist for auto-canceler.",
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Feed
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Compare Opportunities
        </h1>
        <p className="text-sm text-zinc-400">
          Side-by-side evaluation of structural market appeal, economics, and validation speeds.
        </p>
      </div>

      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="p-4 w-1/4">Evaluation Attribute</th>
              <th className="p-4 w-3/8 text-white font-bold">{oppA.title}</th>
              <th className="p-4 w-3/8 text-white font-bold">{oppB.title}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            <tr>
              <td className="p-4 font-medium text-zinc-400">Opportunity Score</td>
              <td className="p-4">
                <ScoreBadge score={oppA.score} />
              </td>
              <td className="p-4">
                <ScoreBadge score={oppB.score} />
              </td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Evidence Confidence</td>
              <td className="p-4">
                <ConfidenceMeter confidence={oppA.confidence} />
              </td>
              <td className="p-4">
                <ConfidenceMeter confidence={oppB.confidence} />
              </td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Industry Vertical</td>
              <td className="p-4">{oppA.industry}</td>
              <td className="p-4">{oppB.industry}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Economic Buyer</td>
              <td className="p-4 font-semibold text-white">{oppA.buyer}</td>
              <td className="p-4 font-semibold text-white">{oppB.buyer}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Estimated MVP Build Cost</td>
              <td className="p-4 font-mono">{formatMoneyRange(oppA.cost)}</td>
              <td className="p-4 font-mono">{formatMoneyRange(oppB.cost)}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Time to MVP</td>
              <td className="p-4">{oppA.weeks}</td>
              <td className="p-4">{oppB.weeks}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Plausible Monthly Pricing</td>
              <td className="p-4 font-mono">{oppA.price}</td>
              <td className="p-4 font-mono">{oppB.price}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Break-Even Customers</td>
              <td className="p-4 font-mono text-emerald-400">{oppA.breakEven}</td>
              <td className="p-4 font-mono text-emerald-400">{oppB.breakEven}</td>
            </tr>
            <tr>
              <td className="p-4 font-medium text-zinc-400">Cheapest Next Experiment</td>
              <td className="p-4 text-xs text-zinc-300">{oppA.experiment}</td>
              <td className="p-4 text-xs text-zinc-300">{oppB.experiment}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
