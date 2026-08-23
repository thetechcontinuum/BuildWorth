import React from "react";

export const metadata = {
  title: "Terms of Service & Research Disclaimer — BuildWorth",
  description: "Terms of service and financial research disclaimer.",
};

export default function TermsPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto py-8 text-sm text-zinc-300 leading-relaxed">
      <h1 className="text-2xl font-bold text-white">Terms of Service & Disclaimer</h1>
      <p className="text-xs text-zinc-500">Last Updated: August 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">1. Research & Investment Disclaimer</h2>
        <p>
          All opportunity scores, cost estimates, and financial projections published on BuildWorth
          are provided for informational and product research purposes only. They do not constitute
          financial, investment, or legal advice.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">2. Acceptable Use & API Rate Limits</h2>
        <p>
          Users may not attempt to reverse engineer the scoring rubric, bypass subscription rate
          limits, or perform automated bulk scraping of our proprietary intelligence database.
        </p>
      </section>
    </div>
  );
}
