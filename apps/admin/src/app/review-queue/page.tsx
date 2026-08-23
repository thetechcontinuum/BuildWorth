import React from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { ScoreBadge, ConfidenceMeter, Button } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";

export const metadata = {
  title: "Opportunity Review Queue — BuildWorth Admin",
  description: "Human-in-the-loop manual review queue for synthesized startup opportunities.",
};

export default function ReviewQueuePage() {
  const pendingReviews = [
    {
      id: "rev-1",
      slug: "automated-soc2-evidence-collector",
      title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
      summary:
        "Eliminates quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
      industry: "DevOps & Compliance",
      opportunityScore: 89,
      confidenceScore: 84,
      costRange: { minMinor: 500000, maxMinor: 1200000, currency: "USD" as const },
      buyer: "VP of Engineering",
      signalsCount: 28,
      criticStatus: "APPROVED_FOR_REVIEW",
      supportingSources: ["GitHub Issues (12)", "Hacker News (9)", "Reddit (7)"],
      unsupportedClaims: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manual Review Queue</h1>
          <p className="text-sm text-zinc-400">
            Strict human verification before public publishing.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
          1 Opportunity Awaiting Review
        </span>
      </div>

      <div className="space-y-4">
        {pendingReviews.map((item) => (
          <div
            key={item.id}
            className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                    {item.industry}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Adversarial Critic Passed
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{item.title}</h2>
                <p className="text-sm text-zinc-400">{item.summary}</p>
              </div>
              <div className="flex items-center gap-4">
                <ScoreBadge score={item.opportunityScore} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 block">Economic Buyer</span>
                <span className="text-zinc-200 font-medium">{item.buyer}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Estimated MVP Build</span>
                <span className="text-zinc-200 font-mono font-medium">
                  {formatMoneyRange(item.costRange)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Corroborating Evidence</span>
                <span className="text-zinc-200">{item.supportingSources.join(" • ")}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
              <ConfidenceMeter confidence={item.confidenceScore} />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
                <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve & Publish
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
