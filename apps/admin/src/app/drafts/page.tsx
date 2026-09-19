import React from "react";
import Link from "next/link";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
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
  Search,
  Archive,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draft Hypotheses & Discovery Review — BuildWorth Admin",
  description: "Administrative portal for reviewing unverified opportunity drafts, separating empirical facts from AI hypotheses.",
};

export default async function AdminDraftsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; slug?: string };
}) {
  await requireServerAdmin();

  const query = searchParams.q?.trim() || "";
  const statusFilter = searchParams.status || "DRAFT";
  const slugFilter = searchParams.slug?.trim() || "";

  const where: any = {
    isDemoFixture: false,
  };

  if (slugFilter) {
    where.slug = slugFilter;
  } else if (statusFilter === "ALL") {
    // any status
  } else {
    where.status = statusFilter;
  }

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { problemStatement: { contains: query, mode: "insensitive" } },
      { industry: { contains: query, mode: "insensitive" } },
    ];
  }

  const drafts = await prisma.opportunity.findMany({
    where,
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
    take: 50,
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> Draft Discovery Review (Strict Admin Only)
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Discovery Opportunity Drafts
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
            Consolidated review workspace for unverified opportunity drafts generated from discovery signals.
            Empirical source facts are rigorously separated from AI adaptation hypotheses. Non-admin users are strictly blocked
            from accessing draft URLs or exports in the main application.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
            <div className="text-2xl font-bold text-white">{drafts.length}</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Matching Drafts</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
        <form method="GET" className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search drafts by title, problem, industry..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-2">
          {["DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"].map((s) => (
            <Link
              key={s}
              href={`/drafts?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-zinc-950 border border-zinc-800/80">
          <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Opportunity Drafts Found</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {query || statusFilter !== "DRAFT"
              ? "Try adjusting your search query or status filter."
              : "Run an ingestion pass to discover and synthesize new opportunities."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
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
            const adaptationHypothesis =
              draft.majorAssumptions?.find((a) => a.includes("[HYPOTHESIS]")) ||
              blueprint?.assumptions?.find((a) => a.statement.includes("[HYPOTHESIS]"))?.statement ||
              "Market transfer hypothesis requiring customer problem interviews.";

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

            return (
              <div
                key={draft.id}
                className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/90 shadow-xl space-y-5 transition-all hover:border-zinc-700"
              >
                {/* Title & Actions */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-zinc-800/80">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          draft.status === "ARCHIVED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
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
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                      {draft.oneSentenceSummary}
                    </p>
                  </div>

                  <Link
                    href={`/drafts/${draft.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start shadow-sm"
                  >
                    Editorial Review & Actions <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Facts vs Hypotheses Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Empirical Facts */}
                  <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" /> Source-Backed Facts
                      </div>
                      <span className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {sourceName}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-400 font-semibold">Canonical Source Reference:</div>
                      {originalUrl.startsWith("http") ? (
                        <a
                          href={originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline break-all"
                        >
                          {originalUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500 font-mono">{originalUrl}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-400 font-semibold">Observed Empirical Fact:</div>
                      <p className="text-xs text-zinc-300 bg-zinc-950/90 p-3 rounded-lg border border-zinc-800 leading-relaxed font-mono">
                        "{observedExcerpt}"
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-400 font-semibold">Problem Statement:</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{draft.problemStatement}</p>
                    </div>
                  </div>

                  {/* AI Adaptation Hypothesis */}
                  <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> AI Adaptation Hypothesis
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-indigo-300 font-semibold">Adaptation Assumption:</div>
                      <p className="text-xs text-zinc-200 bg-indigo-950/40 p-3 rounded-lg border border-indigo-500/30 leading-relaxed">
                        {adaptationHypothesis.replace("[HYPOTHESIS] ", "")}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-indigo-300 font-semibold">Proposed Product Solution:</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{draft.proposedProduct}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-indigo-500/20">
                      <div>
                        <span className="text-zinc-400 font-medium text-[11px]">Economic Buyer:</span>
                        <div className="text-white font-semibold mt-0.5">{draft.economicBuyer}</div>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-medium text-[11px]">Est. MVP Cost:</span>
                        <div className="text-white font-semibold mt-0.5">{minCost} – {maxCost}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Note */}
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>Validation Requirement:</strong> {draft.recommendedNextExperiment || "Run customer problem discovery interviews."}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-400/80">
                    Confidence: {draft.scorecards[0]?.evidenceConfidenceScore ?? 0}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
