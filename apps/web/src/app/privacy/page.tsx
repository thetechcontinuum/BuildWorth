import React from "react";

export const metadata = {
  title: "Privacy Policy — BuildWorth",
  description: "Privacy Policy, GDPR compliance, and data practices.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto py-8 text-sm text-zinc-300 leading-relaxed">
      <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="text-xs text-zinc-500">Last Updated: August 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">1. Data Collection & Source Indexing</h2>
        <p>
          BuildWorth aggregates publicly available developer discussions, community issue trackers,
          and product reviews. We do not store complete copyrighted webpages. We only extract
          anonymized problem summaries, structural metadata, and canonical links for attribution.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-white">2. User Account Data</h2>
        <p>
          We store your account email and subscription tier to provide authenticated access to saved
          opportunities and custom watchlists. We never sell your personal information to third
          parties.
        </p>
      </section>
    </div>
  );
}
