import React from "react";
import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";

export default function HomePage() {
  const featuredOpportunities = [
    {
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
    },
    {
      slug: "finops-snowflake-anomaly-canceler",
      title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
      summary:
        "Real-time query cost interception that prevents unexpected $10k+ warehouse budget blowouts.",
      industry: "Data Engineering & FinOps",
      opportunityScore: 92,
      confidenceScore: 78,
      costRange: { minMinor: 400000, maxMinor: 900000, currency: "USD" as const },
      buyer: "Head of Data",
      signalsCount: 42,
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Activity className="w-3.5 h-3.5 animate-pulse" /> Radar Active: 4,120 Market Signals
          Analyzed
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Discover Startup Ideas Grounded in{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Verifiable Market Demand
          </span>
          .
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          No generic AI hallucinations. Every opportunity is discovered from recurring pain points,
          expensive workarounds, and documented willingness-to-pay.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all"
          >
            Explore Opportunities <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/methodology"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium transition-all"
          >
            Read Methodology
          </Link>
        </div>
      </section>

      {/* Featured Grid */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredOpportunities.map((op) => (
            <div
              key={op.slug}
              className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                    {op.industry}
                  </span>
                  <ScoreBadge score={op.opportunityScore} />
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400">
                  {op.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{op.summary}</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                <ConfidenceMeter confidence={op.confidenceScore} />
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div>
                    <span className="text-zinc-500">Est. MVP:</span>{" "}
                    <span className="text-zinc-200 font-mono font-medium">
                      {formatMoneyRange(op.costRange)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Buyer:</span>{" "}
                    <span className="text-zinc-200 font-medium">{op.buyer}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
