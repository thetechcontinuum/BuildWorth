"use client";

import React, { useState } from "react";
import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, X } from "lucide-react";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number | string;
  annualPrice: number | string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    description: "For exploratory researchers and indie hackers.",
    features: [
      "Browse top 10 public opportunities",
      "Basic 100-point opportunity scores",
      "Standard search & industry filters",
      "Delayed 7-day access to new opportunities",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$49",
    annualPrice: "$39",
    description: "For active builders, startup founders, and PMs.",
    features: [
      "Full 40-attribute venture blueprints",
      "Real-time access to newly discovered opportunities",
      "Uncensored Evidence Confidence breakdown & sources",
      "Unlimited multi-attribute filtering & sorting",
      "Side-by-side opportunity comparison",
      "Saved opportunities & watchlist alerts",
    ],
    cta: "Start 14-Day Free Trial",
    popular: true,
  },
  {
    id: "team",
    name: "Team & Studio",
    monthlyPrice: "$199",
    annualPrice: "$159",
    description: "For software agencies, venture studios, and accelerators.",
    features: [
      "Everything in Pro with 5 team seats",
      "Export audit-ready PDF & CSV venture dossiers",
      "Shared team watchlists & internal notes",
      "Dedicated weekly market briefing emails",
      "Priority requests for custom source indexing",
    ],
    cta: "Subscribe Team",
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    description: "For innovation departments & enterprise automation.",
    features: [
      "Private internal problem space discovery",
      "Custom domain scoring rubrics",
      "Direct REST API & raw vector export access",
      "Dedicated engineering support & SLA",
    ],
    cta: "Contact Enterprise",
    popular: false,
  },
];

const FAQS = [
  {
    q: "Can I cancel or switch my plan anytime?",
    a: "Yes. You can upgrade, downgrade, or cancel your subscription at any time with a single click from your account settings. No lock-in contracts."
  },
  {
    q: "How does the 14-day free trial work?",
    a: "You get full uncensored access to all Pro features for 14 days. You can cancel before the trial ends without being charged a single cent."
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major credit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and SEPA bank transfers."
  },
  {
    q: "How often are new opportunities published?",
    a: "Our Agnes AI discovery pipeline scans global developer & market communities 24/7. New opportunities are analyzed, scored, and published every morning at 06:00 AM."
  }
];

export function PricingClient() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenCheckout = (plan: Plan) => {
    if (plan.id === "free") {
      window.location.href = "/opportunities";
      return;
    }
    setSelectedPlan(plan);
    setIsSuccess(false);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsSuccess(true);
    }, 800);
  };

  return (
    <div className="space-y-16 max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" /> Zero AI Hallucinations • 100% Market Signal Backed
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Invest in Opportunities, Not Hallucinations
        </h1>
        <p className="text-base text-zinc-400">
          Save hundreds of engineering hours by building products with verifiable customer demand and proven willingness to pay.
        </p>

        {/* Billing Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium ${billingPeriod === "monthly" ? "text-white" : "text-zinc-500"}`}>Monthly</span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
            className="w-12 h-6 rounded-full bg-zinc-800 p-1 border border-zinc-700 transition-colors relative"
            aria-label="Toggle billing period"
          >
            <div
              className={`w-4 h-4 rounded-full bg-indigo-500 transition-transform ${billingPeriod === "annual" ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${billingPeriod === "annual" ? "text-white" : "text-zinc-500"}`}>
            Annual Billing
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SAVE 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((p) => {
          const price = billingPeriod === "annual" ? p.annualPrice : p.monthlyPrice;
          const isPopular = p.popular;

          return (
            <div
              key={p.name}
              className={`p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all duration-200 relative ${
                isPopular
                  ? "bg-zinc-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 scale-105 z-10"
                  : "bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90"
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white">{p.name}</h2>
                  {isPopular && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500 text-white shadow-sm">
                      POPULAR
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">{price}</span>
                  {price !== "Custom" && price !== "$0" && (
                    <span className="text-xs text-zinc-500">/month</span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 min-h-[32px]">{p.description}</p>

                <ul className="space-y-2.5 pt-4 border-t border-zinc-800 text-xs text-zinc-300">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleOpenCheckout(p)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isPopular
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                }`}
              >
                <span>{p.cta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-white">Need Custom Source Ingestion or Private Intelligence?</h3>
          <p className="text-xs text-zinc-400">
            We deploy private signal scrapers and customized scoring rubrics for VC funds, private equity, and enterprise R&D.
          </p>
        </div>
        <button
          onClick={() => handleOpenCheckout(PLANS[3]!)}
          className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shrink-0"
        >
          Talk to Enterprise Team
        </button>
      </div>

      {/* FAQ Section */}
      <div className="space-y-6 max-w-3xl mx-auto pt-8">
        <h2 className="text-2xl font-bold text-white text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
              <h4 className="text-sm font-semibold text-zinc-200">{faq.q}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout / Subscription Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!isSuccess ? (
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    {selectedPlan.name} Plan
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {selectedPlan.id === "enterprise" ? "Enterprise Inquiry" : "Complete Your Subscription"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedPlan.id === "enterprise"
                      ? "Tell us about your team and we will reach out within 2 hours."
                      : `Start your 14-day trial of ${selectedPlan.name}. Cancel anytime before day 14 at zero cost.`}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Connor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {selectedPlan.id !== "pro" && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Company / Studio</label>
                      <input
                        type="text"
                        placeholder="e.g. Continuum Ventures"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {selectedPlan.id !== "enterprise" && (
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-2">
                      <div className="flex justify-between items-center text-white font-medium">
                        <span>Due Today:</span>
                        <span className="text-emerald-400 font-bold">$0.00 (14-Day Free Trial)</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-zinc-500">
                        <span>Then:</span>
                        <span>
                          {billingPeriod === "annual" ? selectedPlan.annualPrice : selectedPlan.monthlyPrice}/month (billed {billingPeriod})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{selectedPlan.id === "enterprise" ? "Submit Enterprise Inquiry" : "Activate 14-Day Free Trial"}</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-zinc-500 text-center">
                  🔒 256-bit encrypted checkout. No commitment, cancel anytime.
                </p>
              </form>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">
                    {selectedPlan.id === "enterprise" ? "Inquiry Received!" : "Welcome to BuildWorth Pro!"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedPlan.id === "enterprise"
                      ? "Our venture intelligence team will contact you at " + email + " shortly."
                      : "Your 14-day trial has been activated. You now have full access to all 40-attribute venture blueprints."}
                  </p>
                </div>
                <Link
                  href="/opportunities"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <span>Explore Market Feed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
