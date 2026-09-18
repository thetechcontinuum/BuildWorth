import React from "react";
import Link from "next/link";
import { prisma } from "@buildworth/database";
import {
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Cpu,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draft Hypotheses & Discovery Review — BuildWorth Admin",
  description: "Internal Owner & Admin portal for evaluating unverified opportunity hypotheses generated from discovery signals.",
};

export default async function AdminDraftsPage() {
  const drafts = await prisma.opportunity.findMany({
    where: {
      status: "DRAFT",
      isDemoFixture: false,
    },
    include: {
      scorecards: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      evidenceLinks: {
        include: {
          normalizedSignal: {
            include: {
              rawSignal: {
                include: { source: true },
              },
            },
          },
        },
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        include: {
          blueprint: {
            include: {
              customerSegments: true,
              mvpFeatures: true,
              competitors: true,
              risks: true,
              assumptions: true,
              validationExperiments: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> Owner / Admin Review Portal (Staging)
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Discovery Opportunity Drafts
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Unverified startup opportunity hypotheses generated from Asian and global discovery signals.
            These records are stored as <span className="text-amber-300 font-mono">DRAFT / HYPOTHESIS</span> and
            are excluded from the public published-opportunity feed until empirical buyer demand and independent source thresholds are met.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
            <div className="text-2xl font-bold text-white">{drafts.length}</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Active Drafts</div>
          </div>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Active Opportunity Drafts</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Run an ingestion pass or discovery cycle to discover new problem space signals.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {drafts.map((draft, idx) => {
            const rev = draft.revisions[0];
            const blueprint = rev?.blueprint;
            const evidenceLinks = draft.evidenceLinks || [];
            const primarySignal = evidenceLinks[0]?.normalizedSignal;
            const rawSignal = primarySignal?.rawSignal;

            const originalUrl = primarySignal?.canonicalUrl || rawSignal?.sourceUrl || "N/A";
            const sourceName = rawSignal?.source?.name || "Discovery Source";

            // Extract observed facts vs AI adaptation
            const observedExcerpt = primarySignal?.sanitizedExcerpt || "Observed empirical market signal.";
            const adaptationHypothesis = draft.majorAssumptions?.find((a) => a.includes("[HYPOTHESIS]")) ||
              blueprint?.assumptions?.find((a) => a.statement.includes("[HYPOTHESIS]"))?.statement ||
              "Regional market transfer assumption pending discovery interview validation.";

            const minCost = (draft.estimatedMvpCostMinCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
            const maxCost = (draft.estimatedMvpCostMaxCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
            const minOpCost = (draft.estimatedMonthlyOpCostMinCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
            const maxOpCost = (draft.estimatedMonthlyOpCostMaxCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

            const competitors = blueprint?.competitors || [];

            return (
              <div
                key={draft.id}
                className="p-6 md:p-8 rounded-2xl bg-zinc-950 border border-zinc-800/90 shadow-xl space-y-6 transition-all hover:border-zinc-700"
              >
                {/* Title & Status Badges */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-zinc-800/80">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {draft.status}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {draft.publicationQualityStatus}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {draft.industry}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {idx + 1}. {draft.title}
                    </h2>
                    <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                      {draft.oneSentenceSummary}
                    </p>
                  </div>

                  <Link
                    href={`/opportunities/${draft.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-colors whitespace-nowrap self-start shadow-sm"
                  >
                    Inspect Full Blueprint <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Grid of Facts vs Hypotheses */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Source-Backed Facts */}
                  <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" /> Source-Backed Facts
                      </div>
                      <span className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {sourceName}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-zinc-400 font-semibold">Source Canonical URL:</div>
                      <a
                        href={originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline break-all"
                      >
                        {originalUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs text-zinc-400 font-semibold">Observed Empirical Fact:</div>
                      <p className="text-xs text-zinc-300 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 leading-relaxed font-mono">
                        "{observedExcerpt}"
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-zinc-400 font-semibold">Problem Statement:</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {draft.problemStatement}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: AI Adaptation Hypothesis */}
                  <div className="p-5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> AI Adaptation Hypothesis
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs text-indigo-300 font-semibold">Croatia / EU Market Transfer:</div>
                      <p className="text-xs text-zinc-200 bg-indigo-950/40 p-3 rounded-lg border border-indigo-500/30 leading-relaxed">
                        {adaptationHypothesis.replace("[HYPOTHESIS] ", "")}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs text-indigo-300 font-semibold">Proposed Product Solution:</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {draft.proposedProduct}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div>
                        <span className="text-zinc-400 font-medium">Economic Buyer:</span>
                        <div className="text-white font-semibold mt-0.5">{draft.economicBuyer}</div>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-medium">End User:</span>
                        <div className="text-white font-semibold mt-0.5">{draft.endUser}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Implementation Complexity & Competitors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Implementation Complexity */}
                  <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Implementation Complexity
                    </div>
                    <div className="space-y-1 text-xs text-zinc-300">
                      <div className="flex justify-between py-0.5 border-b border-zinc-800/50">
                        <span className="text-zinc-400">Timeline:</span>
                        <span className="font-medium text-white">{draft.estimatedTimeToMvpMinWeeks}–{draft.estimatedTimeToMvpMaxWeeks} weeks</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-zinc-800/50">
                        <span className="text-zinc-400">MVP Build Cost:</span>
                        <span className="font-medium text-white">{minCost} – {maxCost}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-400">Monthly OpCost:</span>
                        <span className="font-medium text-white">{minOpCost} – {maxOpCost}/mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Competitor Landscape */}
                  <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Competitors
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {competitors.length > 0 ? (
                        competitors.map((c: any) => (
                          <span key={c.id} className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400">Emerging space / incumbent ERPs</span>
                      )}
                    </div>
                  </div>

                  {/* Missing Validation Evidence */}
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <HelpCircle className="w-3.5 h-3.5" /> Missing Validation Evidence
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Zero verified willingness to pay or signed pilot LOIs. Requires problem discovery interviews before building.
                    </p>
                    <div className="text-[11px] text-zinc-400 pt-1 border-t border-amber-500/20">
                      <strong className="text-zinc-300">Recommended Experiment:</strong> {draft.recommendedNextExperiment}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
