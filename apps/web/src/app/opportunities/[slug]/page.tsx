import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, DollarSign, Users, Wrench } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange } from "@buildworth/shared";
import { getStoredOpportunityBySlug } from "@/lib/opportunity-store";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const opp = getStoredOpportunityBySlug(params.slug);
  return {
    title: `${opp ? opp.title : "Opportunity Blueprint"} — BuildWorth`,
    description: opp ? opp.summary : "In-depth 40-attribute startup opportunity blueprint.",
  };
}

export default function OpportunityDetailPage({ params }: { params: { slug: string } }) {
  const opp = getStoredOpportunityBySlug(params.slug) || {
    title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
    summary: "Eliminate quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
    opportunityScore: 89,
    confidenceScore: 84,
    industry: "DevOps & Security Compliance",
    customerType: "B2B",
    buyer: "VP of Engineering or Head of Security",
    costRange: { minMinor: 500000, maxMinor: 1200000, currency: "USD" as const },
    timeToMvpWeeks: { min: 4, max: 8 },
    recommendedExperiment: "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo with a 14-day refund guarantee.",
    jobsToBeDone: [
      "Collect compliance screenshots and cryptographic logs automatically on every git merge",
      "Export structured audit-ready evidence packages for external auditors",
      "Alert security leads when unreviewed pull requests merge to production"
    ],
    narrowMvpScope: [
      "GitHub Action for PR approval signature verification",
      "Vercel deployment environment snapshot webhook",
      "Evidence dashboard with exportable PDF/ZIP audit bundles"
    ],
    existingWorkflow: "Manual screenshots of PR approvals and Vercel env configs stored in shared Google Drive folders.",
    buyingTrigger: "Upcoming annual SOC2 Type II audit deadline",
    competitors: [
      { name: "Vanta / Drata", weakness: "High price ($15k+/yr), complex setup, lacks native deep git-commit binding" },
      { name: "Manual Google Drive Folders", weakness: "High labor cost (40+ engineering hours per quarter), error-prone" }
    ],
    dimensionBreakdown: []
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Feed
      </Link>

      {/* Header Summary Card */}
      <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded">
            {opp.industry} • {opp.customerType}
          </span>
          <ScoreBadge score={opp.opportunityScore} size="lg" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {opp.title}
          </h1>
          <p className="text-base text-zinc-300 leading-relaxed">{opp.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
          <div>
            <span className="text-zinc-500 block font-medium">Economic Buyer</span>
            <span className="text-zinc-200 font-semibold">{opp.buyer}</span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Est. MVP Build</span>
            <span className="text-zinc-200 font-mono font-semibold">
              {formatMoneyRange(opp.costRange)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Time to MVP</span>
            <span className="text-zinc-200 font-semibold">
              {opp.timeToMvpWeeks.min}–{opp.timeToMvpWeeks.max} Weeks
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Plausible Pricing</span>
            <span className="text-zinc-200 font-mono font-semibold">
              $149 - $399 /mo
            </span>
          </div>
        </div>

        <ConfidenceMeter confidence={opp.confidenceScore} />
      </div>

      {/* Structured Sections */}
      <div className="space-y-6">
        {/* Section 1: Problem & Jobs to be Done */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Problem Space & Workaround
          </h2>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>
              <strong className="text-zinc-200">Existing Workaround:</strong> {opp.existingWorkflow || "Manual spreadsheets and scripts."}
            </div>
            <div>
              <strong className="text-zinc-200">Buying Trigger:</strong> {opp.buyingTrigger || "Quarterly audit deadline or executive review."}
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Jobs to be Done
            </span>
            <ul className="space-y-1.5 text-sm text-zinc-300">
              {(opp.jobsToBeDone || [
                "Collect and verify compliance evidence automatically",
                "Generate audit-ready reports without manual engineering hours",
                "Alert team leads when unreviewed pull requests deploy"
              ]).map((job, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span>{job}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 2: Proposed Product & MVP Scope */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" /> Proposed Product & Narrow MVP Scope
          </h2>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {(opp.narrowMvpScope || [
              "Automated webhook ingestion adapter",
              "Real-time heuristic evaluation engine",
              "Dashboard with exportable audit packages"
            ]).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3: Competition & Differentiation */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" /> Competition & Incumbent Gaps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {(opp.competitors || [
              { name: "Incumbent Enterprise Platforms", weakness: "Complex $15k+ annual contracts and heavy onboarding" },
              { name: "Manual In-House Scripts", weakness: "Fragile maintenance burden and high developer hourly cost" }
            ]).map((comp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1"
              >
                <div className="font-semibold text-white">{comp.name}</div>
                <p className="text-xs text-zinc-400">{comp.weakness}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Recommended Next Validation Experiment */}
        <section className="p-6 rounded-xl bg-gradient-to-br from-indigo-950/30 to-zinc-900/40 border border-indigo-500/30 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-base">
            <ShieldCheck className="w-5 h-5" /> Recommended Next Validation Experiment
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{opp.recommendedExperiment}</p>
        </section>
      </div>
    </div>
  );
}
