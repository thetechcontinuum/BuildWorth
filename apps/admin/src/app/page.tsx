import React from "react";
import {
  Users,
  CreditCard,
  Sparkles,
  Database,
  PlaySquare,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { AdminPipelineTrigger } from "@/components/AdminPipelineTrigger";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireServerAdmin();

  // 1. Authoritative User and Subscription metrics
  const allUsers = await prisma.user.findMany({
    include: {
      billingSubscriptions: {
        include: {
          planPrice: {
            include: { plan: true },
          },
        },
      },
      entitlementGrants: true,
    },
  });

  const totalUsers = allUsers.length;
  let freeUsersCount = 0;
  let proUsersCount = 0;
  let activeSubscriptionsCount = 0;
  let scheduledCancellationsCount = 0;
  let paymentAttentionCount = 0;

  const now = new Date();
  for (const u of allUsers) {
    const entitlements = resolveUserEntitlements(u as any, now, { isLiveEnvironment: false });
    if (entitlements.tier === "PRO") {
      proUsersCount++;
    } else {
      freeUsersCount++;
    }

    const sub = u.billingSubscriptions?.[0];
    if (sub) {
      if (sub.status === "ACTIVE") activeSubscriptionsCount++;
      if (sub.cancelAtPeriodEnd) scheduledCancellationsCount++;
      if (["PAST_DUE", "INCOMPLETE", "UNPAID"].includes(sub.status)) {
        paymentAttentionCount++;
      }
    }
  }

  // 2. Opportunity counts: Published vs Draft/Hypothesis
  const publishedOppsCount = await prisma.opportunity.count({
    where: { status: "PUBLISHED" },
  });

  const draftOppsCount = await prisma.opportunity.count({
    where: {
      OR: [{ status: "DRAFT" }, { publicationQualityStatus: "HYPOTHESIS" }],
    },
  });

  // 3. Source health metrics & per-source status
  const allDbSources = await prisma.source.findMany({
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
    orderBy: { name: "asc" },
  });

  const totalSources = allDbSources.length;
  const enabledSourcesCount = allDbSources.filter((s: any) => s.isEnabled).length;
  const disabledSourcesCount = totalSources - enabledSourcesCount;

  const latestCollection = await prisma.source.findFirst({
    where: { lastSuccessfulCollection: { not: null } },
    orderBy: { lastSuccessfulCollection: "desc" },
    select: { lastSuccessfulCollection: true, name: true },
  });

  // 4. Ingestion Run metrics & Health checks
  let totalRuns = 0;
  let failedRuns = 0;
  let latestRun: any = null;
  let latestCompletedRun: any = null;

  try {
    totalRuns = await prisma.ingestionRun.count();
    failedRuns = await prisma.ingestionRun.count({
      where: { status: "FAILED" },
    });
    latestRun = await prisma.ingestionRun.findFirst({
      orderBy: { createdAt: "desc" },
    });
    latestCompletedRun = await prisma.ingestionRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
  } catch {}

  const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
  const isCronStale = !latestCompletedRun || new Date(latestCompletedRun.completedAt || latestCompletedRun.createdAt) < twentySixHoursAgo;

  // 5. Real AI Spend ledger metrics
  let recordedSpendCents = 0;
  let recordedSpendTokens = 0;
  try {
    const spendRecords = await prisma.aiSpendLedgerRecord.findMany();
    for (const rec of spendRecords) {
      recordedSpendCents += rec.costMinorUnits || 0;
      recordedSpendTokens += (rec.promptTokens || 0) + (rec.completionTokens || 0);
    }
  } catch {}

  const recordedSpendFormatted = (recordedSpendCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Operations Dashboard</h1>
        <p className="text-sm text-zinc-400">
          Authoritative database-backed metrics, ingestion monitoring, and operations control.
        </p>
      </div>

      {isCronStale && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200">Scheduled Cron Stale Alert</div>
            <div>
              No successful production ingestion run recorded within the last 26 hours.
              {latestCompletedRun ? (
                <span> Last success was on {new Date(latestCompletedRun.completedAt || latestCompletedRun.createdAt).toLocaleString()}.</span>
              ) : (
                <span> No successful durable run recorded yet.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Pipeline Execution */}
      <AdminPipelineTrigger />

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users & Subscriptions */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Users & Subscriptions</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalUsers}</div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span>Free: <strong className="text-zinc-200 font-mono">{freeUsersCount}</strong></span>
            <span>•</span>
            <span>Pro: <strong className="text-indigo-300 font-mono">{proUsersCount}</strong></span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Active Subs: <strong className="text-emerald-400 font-mono">{activeSubscriptionsCount}</strong>
          </div>
        </div>

        {/* Subscription Attention */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Billing Attention</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {scheduledCancellationsCount + paymentAttentionCount}
          </div>
          <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span>Cancellations: <strong className="text-amber-300 font-mono">{scheduledCancellationsCount}</strong></span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Payment Action: <strong className="text-rose-400 font-mono">{paymentAttentionCount}</strong>
          </div>
        </div>

        {/* Opportunities: Published vs Draft */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Opportunities</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{publishedOppsCount}</div>
          <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span>Published: <strong className="text-emerald-400 font-mono">{publishedOppsCount}</strong></span>
          </div>
          <div className="text-[11px] text-amber-400">
            Draft Hypotheses: <strong className="font-mono">{draftOppsCount}</strong>
          </div>
        </div>

        {/* Sources & Ingestion */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Sources & Ingestion</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{enabledSourcesCount} Active</div>
          <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span>Total Sources: <strong className="text-zinc-200 font-mono">{totalSources}</strong></span>
            {disabledSourcesCount > 0 && (
              <span className="text-zinc-500"> ({disabledSourcesCount} paused/blocked)</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500">
            Runs: <strong className="text-zinc-300 font-mono">{totalRuns}</strong> ({failedRuns} failures)
          </div>
        </div>
      </div>

      {/* Secondary Information & Real Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real Ingestion Run Telemetry */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <PlaySquare className="w-4 h-4 text-indigo-400" /> Latest Ingestion Run
            </h2>
            <Link
              href="/ingestion"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              View All Runs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {latestRun ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-400 font-mono">Run ID: {latestRun.id.slice(0, 16)}...</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    latestRun.status === "COMPLETED"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : latestRun.status === "FAILED"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  }`}
                >
                  {latestRun.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px] uppercase">Fetched</div>
                  <div className="text-white font-mono font-bold">{latestRun.totalFetched}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px] uppercase">Early Ideas Created</div>
                  <div className="text-amber-400 font-mono font-bold">{latestRun.candidatesCount}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
                  <div className="text-zinc-500 text-[10px] uppercase">Verified Published</div>
                  <div className="text-emerald-400 font-mono font-bold">{latestRun.publishedCount}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                <div>
                  Started: {new Date(latestRun.createdAt).toLocaleString()}
                  {latestRun.failureCode && (
                    <span className="text-rose-400 ml-2 font-mono">[{latestRun.failureCode}]</span>
                  )}
                </div>
                {latestRun.completedAt && (
                  <div className="font-mono text-zinc-400">
                    Duration: {Math.max(1, Math.round((new Date(latestRun.completedAt).getTime() - new Date(latestRun.createdAt).getTime()) / 1000))}s
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 py-6 text-center">
              No durable ingestion runs recorded yet in this environment.
            </div>
          )}
        </div>

        {/* Database-Backed AI Usage Ledger */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Recorded AI Usage & Spend
            </h2>
            <Link
              href="/ai-spend"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              View Spend Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">Total Recorded Cost</span>
              <span className="text-base font-bold font-mono text-white">{recordedSpendFormatted}</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/60 text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Tokens Tracked:</span>
                <span className="font-mono text-zinc-200">{recordedSpendTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Ledger Policy:</span>
                <span className="text-zinc-300">Strictly recorded API calls only</span>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>
                No fabricated metrics. Unrecorded AI calls or third-party usage outside the ledger are excluded.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sources Health & Per-Source Operational Status */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" /> Source Registry & Operational Health
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {enabledSourcesCount} of {totalSources} Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[11px] uppercase tracking-wider">
                <th className="pb-3 font-medium">Source</th>
                <th className="pb-3 font-medium">Family</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Last Successful Collection</th>
                <th className="pb-3 font-medium">Recent Runs & Status</th>
                <th className="pb-3 font-medium">Policy Notes / Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {allDbSources.map((source: any) => {
                const latestRun = source.runs?.[0];
                const failedRunsCount = (source.runs || []).filter((r: any) => r.status === "FAILED").length;

                return (
                  <tr key={source.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3 pr-3 font-medium text-white flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          source.isEnabled ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                      />
                      <span>{source.name}</span>
                      <span className="text-zinc-500 font-mono text-[10px]">({source.key})</span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-zinc-400">
                      {source.sourceFamily || "COMMUNITY"}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                          source.isEnabled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {source.isEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-zinc-400">
                      {source.lastSuccessfulCollection
                        ? new Date(source.lastSuccessfulCollection).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="py-3 pr-3">
                      {latestRun ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                              latestRun.status === "SUCCESS"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {latestRun.status}
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            ({latestRun.signalsIngested} signals)
                          </span>
                          {failedRunsCount > 0 && (
                            <span className="text-rose-400 text-[10px] font-mono">
                              [{failedRunsCount} err]
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-[10px]">No runs</span>
                      )}
                    </td>
                    <td className="py-3 text-[11px] text-zinc-400 max-w-xs truncate" title={source.termsNotes || latestRun?.errorMessage || ""}>
                      {latestRun?.errorMessage ? (
                        <span className="text-rose-400">{latestRun.errorMessage}</span>
                      ) : source.termsNotes ? (
                        <span className="text-zinc-500">{source.termsNotes}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
