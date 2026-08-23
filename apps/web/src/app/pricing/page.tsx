import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@buildworth/ui";

export const metadata = {
  title: "Pricing & Membership Plans — BuildWorth",
  description: "Subscription tiers for indie hackers, founders, and venture studios.",
};

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "$0",
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
      name: "Pro",
      price: "$49",
      period: "/month",
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
      name: "Team & Studio",
      price: "$199",
      period: "/month",
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
      name: "Enterprise",
      price: "Custom",
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

  return (
    <div className="space-y-12 max-w-6xl mx-auto py-8">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Invest in Opportunities, Not Hallucinations
        </h1>
        <p className="text-base text-zinc-400">
          Save hundreds of engineering hours by building products with verifiable customer demand
          and proven willingness to pay.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all ${
              p.popular
                ? "bg-zinc-900 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10"
                : "bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">{p.name}</h2>
                {p.popular && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500 text-white">
                    POPULAR
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{p.price}</span>
                {p.period && <span className="text-xs text-zinc-500">{p.period}</span>}
              </div>

              <p className="text-xs text-zinc-400">{p.description}</p>

              <ul className="space-y-2 pt-4 border-t border-zinc-800 text-xs text-zinc-300">
                {p.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button variant={p.popular ? "primary" : "secondary"} className="w-full text-xs py-2">
              {p.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
