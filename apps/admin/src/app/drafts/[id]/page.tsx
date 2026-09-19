import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { DraftDetailEditor } from "@/components/drafts/DraftDetailEditor";
import {
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Cpu,
  Building2,
  HelpCircle,
  Clock,
  Layers,
  CheckCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draft Opportunity Detail & Editorial Review — BuildWorth Admin",
};

export default async function AdminDraftDetailPage({ params }: { params: { id: string } }) {
  await requireServerAdmin();

  const draft = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: {
      scorecards: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { dimensions: true },
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
        include: {
          blueprint: {
            include: {
              customerSegments: true,
              mvpFeatures: { orderBy: { orderIndex: "asc" } },
              competitors: true,
              risks: true,
              assumptions: true,
              validationExperiments: { orderBy: { orderPriority: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!draft) {
    notFound();
  }

  const latestRev = draft.revisions[0];
  const blueprint = latestRev?.blueprint;
  const primarySignal = draft.evidenceLinks[0]?.normalizedSignal;
  const rawSignal = primarySignal?.rawSignal;

  const originalUrl = primarySignal?.canonicalUrl || rawSignal?.sourceUrl || "N/A";
  const sourceName = rawSignal?.source?.name || "Discovery Source";
  const observedExcerpt = primarySignal?.sanitizedExcerpt || "Observed empirical market signal.";

  const minCost = (draft.estimatedMvpCostMinCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const maxCost = (draft.estimatedMvpCostMaxCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const minOpCost = (draft.estimatedMonthlyOpCostMinCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const maxOpCost = (draft.estimatedMonthlyOpCostMaxCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <Link
        href="/drafts"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Drafts
      </Link>

      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">{draft.id}</span>
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300">
            {draft.industry}
          </span>
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {draft.publicationQualityStatus}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{draft.title}</h1>
        <p className="text-sm text-zinc-300">{draft.oneSentenceSummary}</p>
      </div>

      {/* Client Editor Bar */}
      <DraftDetailEditor opportunity={draft} />

      {/* Side-by-Side: Facts vs Hypotheses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source-Backed Facts */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Observed Empirical Facts
            </div>
            <span className="text-xs text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
              Source: {sourceName}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-zinc-400">Canonical Source Reference:</div>
            {originalUrl.startsWith("http") ? (
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline break-all font-mono"
              >
                {originalUrl} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="text-xs text-zinc-500 font-mono">{originalUrl}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-zinc-400">Sanitized Signal Excerpt:</div>
            <p className="text-xs text-zinc-200 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 leading-relaxed font-mono">
              "{observedExcerpt}"
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-zinc-400">Original Problem Statement:</div>
            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/80">
              {draft.problemStatement}
            </p>
          </div>
        </div>

        {/* AI Adaptation Hypotheses */}
        <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 pb-3 border-b border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> AI Adaptation Hypotheses
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-indigo-300">Proposed Product Solution:</div>
            <p className="text-xs text-zinc-200 bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30 leading-relaxed">
              {draft.proposedProduct}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-indigo-300">Target Buyer & User:</div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30">
              <div>
                <span className="text-zinc-400">Economic Buyer:</span>
                <div className="text-white font-semibold mt-0.5">{draft.economicBuyer}</div>
              </div>
              <div>
                <span className="text-zinc-400">End User:</span>
                <div className="text-white font-semibold mt-0.5">{draft.endUser}</div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-indigo-300">Assumptions & Disclaimers:</div>
            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
              {draft.majorAssumptions && draft.majorAssumptions.length > 0 ? (
                draft.majorAssumptions.map((ass, i) => <li key={i}>{ass}</li>)
              ) : (
                <li>Pending customer discovery validation.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Complexity & Implementation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-indigo-400" /> Implementation Complexity
          </div>
          <div className="text-xs text-zinc-300 space-y-1 pt-1">
            <div className="flex justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">Timeline:</span>
              <span className="font-semibold text-white">{draft.estimatedTimeToMvpMinWeeks}–{draft.estimatedTimeToMvpMaxWeeks} weeks</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800">
              <span className="text-zinc-400">Build Cost:</span>
              <span className="font-semibold text-white">{minCost} – {maxCost}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">OpCost:</span>
              <span className="font-semibold text-white">{minOpCost} – {maxOpCost}/mo</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-indigo-400" /> Known Competitors
          </div>
          <div className="space-y-1 pt-1">
            {blueprint?.competitors && blueprint.competitors.length > 0 ? (
              blueprint.competitors.map((c: any) => (
                <div key={c.id} className="text-xs text-zinc-300 flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{c.competitorType || "Direct"}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-500">No structured competitors listed.</div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Recommended Experiment
          </div>
          <p className="text-xs text-amber-200 leading-relaxed">
            {draft.recommendedNextExperiment || "Run customer problem discovery interviews."}
          </p>
          <div className="text-[11px] text-amber-400/80 pt-2 border-t border-amber-500/20 font-mono">
            Requires buyer proof before public publication.
          </div>
        </div>
      </div>

      {/* Revision History */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> Revision History ({draft.revisions.length})
        </h3>
        <div className="space-y-3">
          {draft.revisions.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono text-[11px] text-zinc-200">
                    v{r.revisionNumber}
                  </span>
                  <span className="font-semibold text-white">{r.reasonForChange}</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1 font-mono">{r.id}</div>
              </div>
              <div className="text-zinc-400 text-right shrink-0">
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
