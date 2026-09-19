import React from "react";
import { prisma } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { BarChart3, Users, Database, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Statistics — BuildWorth Admin",
};

export default async function AdminStatsPage() {
  await requireServerAdmin();

  const isLiveEnvironment =
    process.env.BUILDWORTH_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const now = new Date();

  // Load real DB data
  const [
    allUsers,
    totalSources,
    activeSources,
    totalRuns,
    successfulRuns,
    failedRuns,
    totalRawSignals,
    totalOpportunities,
    draftOpportunities,
    publishedOpportunities,
    archivedOpportunities,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        billingCustomer: true,
        billingSubscriptions: {
          include: {
            planPrice: {
              include: { plan: true },
            },
          },
        },
        entitlementGrants: true,
      },
    }),
    prisma.source.count(),
    prisma.source.count({ where: { isEnabled: true, policyStatus: "ALLOWED" } }),
    prisma.ingestionRun.count(),
    prisma.ingestionRun.count({ where: { status: "COMPLETED" } }),
    prisma.ingestionRun.count({ where: { status: "FAILED" } }),
    prisma.rawSignal.count(),
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { status: "DRAFT" } }),
    prisma.opportunity.count({ where: { status: "PUBLISHED" } }),
    prisma.opportunity.count({ where: { status: "ARCHIVED" } }),
  ]);

  let effectiveFreeCount = 0;
  let effectiveProCount = 0;

  for (const u of allUsers) {
    const ent = resolveUserEntitlements(u, now, { isLiveEnvironment });
    if (ent.tier === "PRO") {
      effectiveProCount++;
    } else {
      effectiveFreeCount++;
    }
  }

  const runSuccessRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : "N/A";
  const sourceYield = totalSources > 0 ? (totalRawSignals / totalSources).toFixed(1) : "N/A";

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Authoritative Platform Statistics</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real metrics derived directly from postgres models and authoritative entitlement resolvers. No synthetic values.
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Registered Accounts</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">{allUsers.length}</div>
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span>Free: <strong className="text-zinc-200">{effectiveFreeCount}</strong></span>
            <span>·</span>
            <span>Pro: <strong className="text-emerald-400">{effectiveProCount}</strong></span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ingestion Success Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {runSuccessRate !== "N/A" ? `${runSuccessRate}%` : "No runs"}
          </div>
          <div className="text-xs text-zinc-400">
            {successfulRuns} passed / {failedRuns} failed ({totalRuns} total)
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Signal Sources</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalSources}</div>
          <div className="text-xs text-zinc-400">
            <strong className="text-cyan-400">{activeSources}</strong> active · yield {sourceYield} sig/src
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Opportunities</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalOpportunities}</div>
          <div className="text-xs text-zinc-400">
            <strong className="text-amber-400">{draftOpportunities}</strong> drafts · <strong className="text-emerald-400">{publishedOpportunities}</strong> pub
          </div>
        </div>
      </div>

      {/* Opportunity Breakdown */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-semibold text-white">Venture Opportunities by Pipeline State</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="text-xs text-zinc-400">DRAFT / HYPOTHESIS</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{draftOpportunities}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Gated strictly to Admins; hidden from public feed</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="text-xs text-zinc-400">PUBLISHED</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{publishedOpportunities}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Passed buyer verification thresholds</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="text-xs text-zinc-400">ARCHIVED</div>
            <div className="text-2xl font-bold text-zinc-400 mt-1">{archivedOpportunities}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Editorial retirement retaining evidence links</div>
          </div>
        </div>
      </div>
    </div>
  );
}
