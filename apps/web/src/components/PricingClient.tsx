"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, CreditCard, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PublicPriceCatalogDTO } from "@buildworth/billing";

interface BillingStatusResponse {
  conversionState:
    | "FREE"
    | "ACTIVATION_PENDING"
    | "PRO_ACTIVE"
    | "PRO_ACTIVE_UNTIL_PERIOD_END"
    | "PAYMENT_GRACE"
    | "PAYMENT_ACTION_REQUIRED";
  tier: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isCheckoutAvailable: boolean;
  isPortalAvailable: boolean;
  hasActiveSubscription: boolean;
  catalog?: PublicPriceCatalogDTO[];
}

export function PricingClient() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutParam, setCheckoutParam] = useState<string | null>(null);

  useEffect(() => {
    let sessionQuery = "";
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const chk = urlParams.get("checkout");
      if (chk) setCheckoutParam(chk);
      const sess = urlParams.get("session");
      if (sess) sessionQuery = `?session=${encodeURIComponent(sess)}`;
    }

    fetch(`/api/billing/status${sessionQuery}`)
      .then((res) => res.json())
      .then((data) => setBillingStatus(data))
      .catch((err) => {
        console.error("Failed to load billing status", err);
        setActionError("Unable to load live pricing information. Please check your connection.");
      });
  }, []);

  const catalog = billingStatus?.catalog || [];
  const monthlyEntry = catalog.find((c) => c.catalogKey === "pro_monthly");
  const annualEntry = catalog.find((c) => c.catalogKey === "pro_annual");

  const currentPriceEntry = billingPeriod === "annual" ? annualEntry : monthlyEntry;
  const currentCatalogKey = billingPeriod === "annual" ? "pro_annual" : "pro_monthly";

  const handleProCheckout = async () => {
    setActionError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogKey: currentCatalogKey,
          returnTo: "/pricing",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/onboarding";
          return;
        }
        throw new Error(data.error || "Failed to start checkout");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setActionError(err?.message || "Checkout error occurred.");
      setLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    setActionError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (err: any) {
      setActionError(err?.message || "Portal error occurred.");
      setLoading(false);
    }
  };

  const isProActive = billingStatus?.conversionState === "PRO_ACTIVE" || checkoutParam === "success";
  const isProScheduledCancel = billingStatus?.conversionState === "PRO_ACTIVE_UNTIL_PERIOD_END";
  const isActivationPending =
    billingStatus?.conversionState === "ACTIVATION_PENDING" || checkoutParam === "pending";

  const formattedPeriodEnd = billingStatus?.currentPeriodEnd
    ? new Date(billingStatus.currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-16 max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" /> Evidence-Backed Startup Intelligence • Server Authoritative Billing
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Decision-Grade Venture Blueprints & Market Signals
        </h1>
        <p className="text-sm sm:text-base text-zinc-400">
          Save hundreds of engineering hours by building products with verifiable customer demand,
          proven willingness to pay, and un-gated Founder Fit calculations.
        </p>

        {/* State Banner: Pro Active */}
        {isProActive && (
          <div className="p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              You currently have an <strong>Active Pro Subscription</strong>. All decision-grade features and export capabilities are unlocked.
            </span>
          </div>
        )}

        {/* State Banner: Scheduled Cancellation */}
        {isProScheduledCancel && (
          <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-xl text-xs text-amber-200 inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Your Pro subscription is scheduled to cancel. You retain full Pro access until <strong>{formattedPeriodEnd}</strong>.
            </span>
          </div>
        )}

        {/* State Banner: Activation Pending */}
        {isActivationPending && (
          <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-xl text-xs text-amber-200 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span>
              Payment received! Webhook activation is processing in the background. Please refresh in a moment.
            </span>
          </div>
        )}

        {/* State Banner: Checkout Cancelled */}
        {checkoutParam === "cancelled" && (
          <div className="p-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-xs text-zinc-400 inline-block">
            Checkout was cancelled. No charges were made.
          </div>
        )}

        {/* Action Error / Billing Unavailable */}
        {actionError && (
          <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300">
            {actionError}
          </div>
        )}

        {/* Billing Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span
            className={`text-xs font-medium ${billingPeriod === "monthly" ? "text-white" : "text-zinc-500"}`}
          >
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
            className="w-12 h-6 rounded-full bg-zinc-800 p-1 border border-zinc-700 transition-colors relative"
            aria-label="Toggle billing period"
          >
            <div
              className={`w-4 h-4 rounded-full bg-indigo-500 transition-transform ${billingPeriod === "annual" ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
          <span
            className={`text-xs font-medium flex items-center gap-1.5 ${billingPeriod === "annual" ? "text-white" : "text-zinc-500"}`}
          >
            Annual Billing
            {annualEntry?.savingsBadge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {annualEntry.savingsBadge}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* FREE PLAN */}
        <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-6 hover:border-zinc-700 transition-all">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Free</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-400">
                EXPLORER
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white">$0</span>
              <span className="text-xs text-zinc-500">/ forever</span>
            </div>

            <p className="text-xs text-zinc-400">
              For indie hackers and researchers exploring validated market problem spaces.
            </p>

            <ul className="space-y-3 pt-6 border-t border-zinc-800/80 text-xs text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Browse validated market opportunities</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Basic 100-point composite opportunity scores</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Opportunity Radar Watchlist (capped at 3 items)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>Side-by-side opportunity comparison (up to 2 opportunities)</span>
              </li>
            </ul>
          </div>

          <Link
            href="/opportunities"
            className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all"
          >
            <span>Explore Opportunities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* PRO PLAN */}
        <div className="p-8 rounded-2xl bg-zinc-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 flex flex-col justify-between space-y-6 relative scale-100 sm:scale-105 z-10">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Pro</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500 text-white shadow-sm">
                MOST POPULAR
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white">
                {currentPriceEntry?.displayAmount || (billingPeriod === "annual" ? "$190" : "$19")}
              </span>
              <span className="text-xs text-zinc-400">
                {currentPriceEntry?.displayInterval || (billingPeriod === "annual" ? "/ year" : "/ month")}
              </span>
            </div>

            <p className="text-xs text-zinc-300">
              {currentPriceEntry?.description ||
                "For founders, operators, and PMs building high-conviction ventures with zero guesswork."}
            </p>

            <ul className="space-y-3 pt-6 border-t border-zinc-800 text-xs text-zinc-200">
              {(currentPriceEntry?.features || [
                "Unrestricted Evidence Lineage & Raw Source Audit",
                "Full Multi-Dimensional Founder Fit Breakdown",
                "Decision-Grade Venture Financial Scenarios & Costs",
                "Export Venture Blueprints to Audit-Grade PDF & CSV",
                "Opportunity Radar Watchlist expansion (up to 50 items)",
                "Early access to newly verified market signals",
              ]).map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {isProActive || isProScheduledCancel ? (
              <button
                onClick={handleOpenPortal}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                <span>Manage Billing & Subscription</span>
              </button>
            ) : (
              <button
                onClick={handleProCheckout}
                disabled={loading || isActivationPending}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isActivationPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activation in Progress...</span>
                  </>
                ) : (
                  <>
                    <span>
                      Upgrade to Pro — {currentPriceEntry?.displayAmount || "$19"}{currentPriceEntry?.displayInterval || "/mo"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Security & Guarantee Footer */}
      <div className="text-center pt-8 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-8 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Server-Authoritative Entitlements</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-indigo-400" />
          <span>Encrypted Stripe Checkout Processing</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          <span>Cancel Anytime with 1-Click</span>
        </div>
      </div>
    </div>
  );
}
