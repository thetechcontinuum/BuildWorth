import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Shield,
  CreditCard,
  ExternalLink,
  Lock,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { prisma } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { getBillingConfig } from "@buildworth/billing";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { RoleManager } from "./role-manager";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const currentAdmin = await requireServerAdmin();

  const user = await prisma.user.findUnique({
    where: { id: params.id },
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
      checkoutAttempts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      usageLedgers: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) {
    notFound();
  }

  const now = new Date();
  const entitlements = resolveUserEntitlements(user as any, now, { isLiveEnvironment: false });
  const sub = user.billingSubscriptions?.[0];
  const billingCustomer = user.billingCustomer;

  const billingConfig = getBillingConfig();
  const stripeDashboardBase = billingConfig.isLiveBilling
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href="/users"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight font-mono">{user.email}</h1>
          <p className="text-xs text-zinc-500 font-mono">User ID: {user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Account Role</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase ${
                user.role === "ADMIN"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : "bg-zinc-900 text-zinc-300 border border-zinc-800"
              }`}
            >
              {user.role === "ADMIN" && <Shield className="w-3.5 h-3.5" />}
              {user.role}
            </span>
          </div>

          <RoleManager
            userId={user.id}
            userEmail={user.email}
            currentRole={user.role as any}
            currentAdminEmail={currentAdmin.email}
          />

          <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-900">
            Registered: {new Date(user.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Authoritative Tier</span>
          <div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold font-mono uppercase ${
                entitlements.tier === "PRO"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
              }`}
            >
              {entitlements.tier}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Resolved via authoritative entitlement matrix
          </p>
        </div>

        <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Subscription Status</span>
          <div className="text-sm font-mono font-bold text-white">
            {sub ? sub.status : "NONE"}
          </div>
          <p className="text-[11px] text-zinc-500">
            {sub?.cancelAtPeriodEnd ? "Scheduled for cancellation" : "Standard cycle"}
          </p>
        </div>
      </div>

      {/* Subscription & Provider Details */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" /> Subscription & Provider References
          </h2>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" /> Read-Only Billing Management
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">Stripe Customer ID</span>
            {billingCustomer?.stripeCustomerId ? (
              <a
                href={`${stripeDashboardBase}/customers/${billingCustomer.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-indigo-400 hover:text-indigo-300 underline"
              >
                {billingCustomer.stripeCustomerId} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-zinc-500 font-mono">No provider customer linked</span>
            )}
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">Stripe Subscription ID</span>
            {sub?.stripeSubscriptionId ? (
              <a
                href={`${stripeDashboardBase}/subscriptions/${sub.stripeSubscriptionId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-indigo-400 hover:text-indigo-300 underline"
              >
                {sub.stripeSubscriptionId} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-zinc-500 font-mono">No provider subscription linked</span>
            )}
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">Current Period Start</span>
            <span className="text-zinc-300 font-mono">
              {sub?.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleString() : "N/A"}
            </span>
          </div>

          <div>
            <span className="text-zinc-500 block mb-1">Current Period End</span>
            <span className="text-zinc-300 font-mono">
              {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Entitlement Grants */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> Active Entitlement Grants
        </h2>
        <div className="border border-zinc-800 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[10px] uppercase">
              <tr>
                <th className="p-3">Entitlement Type</th>
                <th className="p-3">Source</th>
                <th className="p-3">Unlimited</th>
                <th className="p-3">Remaining Units</th>
                <th className="p-3">Expires At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {user.entitlementGrants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
                    No custom entitlement grants (standard tier defaults apply).
                  </td>
                </tr>
              ) : (
                user.entitlementGrants.map((g) => (
                  <tr key={g.id}>
                    <td className="p-3 font-mono font-medium text-white">{g.entitlementType}</td>
                    <td className="p-3 font-mono text-[11px]">{g.source}</td>
                    <td className="p-3">{g.isUnlimited ? "YES" : "NO"}</td>
                    <td className="p-3 font-mono">{g.remainingUnits ?? "N/A"}</td>
                    <td className="p-3 font-mono text-[11px]">
                      {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Attempts & Events */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" /> Billing History & Checkout Attempts
        </h2>
        <div className="border border-zinc-800 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[10px] uppercase">
              <tr>
                <th className="p-3">Plan</th>
                <th className="p-3">Interval</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {user.checkoutAttempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
                    No recorded checkout attempts.
                  </td>
                </tr>
              ) : (
                user.checkoutAttempts.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3 font-mono font-medium text-white">{c.selectedPlanCode}</td>
                    <td className="p-3 font-mono text-[11px]">{c.billingInterval}</td>
                    <td className="p-3 font-mono font-bold text-zinc-200">{c.status}</td>
                    <td className="p-3 font-mono text-[11px]">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-mono text-[11px]">
                      {c.completedAt ? new Date(c.completedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
