import React from "react";
import { OpportunityFeedClient } from "../../components/OpportunityFeedClient";

export const metadata = {
  title: "Opportunity Feed — BuildWorth",
  description: "Browse verified, evidence-scored startup opportunities with multi-filter search.",
};

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Market Opportunity Feed</h1>
        <p className="text-sm text-zinc-400">
          Systematically discovered and validated through empirical market signals.
        </p>
      </div>

      <OpportunityFeedClient />
    </div>
  );
}
