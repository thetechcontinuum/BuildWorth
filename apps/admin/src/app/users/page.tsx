import React from "react";
import Link from "next/link";
import { Users, Shield, ArrowRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { prisma } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { requireServerAdmin } from "@/lib/admin-page-guard";

import { AddUserModal } from "./add-user-modal";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; tier?: string; role?: string; page?: string };
}) {
  await requireServerAdmin();

  const query = searchParams?.q?.trim().toLowerCase() || "";
  const tierFilter = searchParams?.tier || "";
  const roleFilter = searchParams?.role || "";
  const page = parseInt(searchParams?.page || "1", 10) || 1;
  const pageSize = 20;

  const whereClause: any = {};
  if (query) {
    whereClause.email = { contains: query, mode: "insensitive" };
  }
  if (roleFilter && ["USER", "ADMIN", "REVIEWER"].includes(roleFilter)) {
    whereClause.role = roleFilter;
  }

  const [totalCount, rawUsers] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const now = new Date();
  const usersWithEntitlements = rawUsers.map((u) => {
    const entitlements = resolveUserEntitlements(u as any, now, { isLiveEnvironment: false });
    const sub = u.billingSubscriptions?.[0];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      projectedTier: u.tier,
      effectiveTier: entitlements.tier,
      hasActiveSubscription: entitlements.hasActiveSubscription,
      subscriptionStatus: sub?.status || null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
      periodEnd: sub?.currentPeriodEnd || null,
      createdAt: u.createdAt,
    };
  });

  const filteredUsers = tierFilter
    ? usersWithEntitlements.filter((u) => u.effectiveTier === tierFilter)
    : usersWithEntitlements;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Users & Subscriptions</h1>
          <p className="text-sm text-zinc-400">
            Authoritative registered accounts, effective subscription tiers, and read-only billing states.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono">
            Total Users: <strong className="text-white">{totalCount}</strong>
          </div>
          <AddUserModal />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
        <form className="flex-1 min-w-[200px]" method="GET" action="/users">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by email..."
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <Link
            href="/users"
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              !tierFilter ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            All Tiers
          </Link>
          <Link
            href="/users?tier=FREE"
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tierFilter === "FREE" ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            Free
          </Link>
          <Link
            href="/users?tier=PRO"
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              tierFilter === "PRO" ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            Pro
          </Link>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Effective Tier</th>
              <th className="py-3 px-4">Subscription Status</th>
              <th className="py-3 px-4">Registered</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500">
                  No registered users matched the query.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-white">
                    {u.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        u.role === "ADMIN"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                      }`}
                    >
                      {u.role === "ADMIN" && <Shield className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        u.effectiveTier === "PRO"
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                      }`}
                    >
                      {u.effectiveTier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {u.subscriptionStatus ? (
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            u.subscriptionStatus === "ACTIVE"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                        <span className="text-zinc-200">{u.subscriptionStatus}</span>
                        {u.cancelAtPeriodEnd && (
                          <span className="text-[10px] text-amber-400 font-sans ml-1">
                            (Cancels at end)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500 font-mono">No subscription</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/users/${u.id}`}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Inspect <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/users?page=${page - 1}&q=${query}&tier=${tierFilter}`}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 text-white"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/users?page=${page + 1}&q=${query}&tier=${tierFilter}`}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 text-white"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
