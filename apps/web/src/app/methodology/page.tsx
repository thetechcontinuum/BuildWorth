import React from "react";

export const metadata = {
  title: "Methodology & Scoring System — BuildWorth",
  description: "How BuildWorth discovers, validates, and scores startup opportunities.",
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Scoring & Evidence Methodology
        </h1>
        <p className="text-zinc-400">
          Our systematic framework for separating raw opportunity potential from evidence
          confidence.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Core Principle</h2>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 leading-relaxed">
          <strong>Never confuse market promise with empirical proof.</strong> An idea can score
          90/100 in structural market appeal, but if it is supported by only a single anonymous
          post, it remains a <em>low-confidence hypothesis</em> until verified across multiple
          independent channels.
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">The 100-Point Opportunity Rubric</h2>
        <div className="border border-zinc-800 rounded-xl overflow-hidden text-sm">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-3">Dimension</th>
                <th className="p-3">Max Pts</th>
                <th className="p-3">Key Metric Evaluated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              <tr>
                <td className="p-3 font-medium">Pain Evidence</td>
                <td className="p-3 font-mono">15</td>
                <td className="p-3">Severity and frequency of status-quo friction</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Buyer Demand & WTP</td>
                <td className="p-3 font-mono">15</td>
                <td className="p-3">Documented willingness to allocate budget</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Technical Feasibility</td>
                <td className="p-3 font-mono">15</td>
                <td className="p-3">Standard stack vs. research novelty risk</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Cost-Benefit Economics</td>
                <td className="p-3 font-mono">15</td>
                <td className="p-3">Customer ROI &gt; 5x and gross margin &gt; 80%</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Market Attractiveness</td>
                <td className="p-3 font-mono">10</td>
                <td className="p-3">Reachable market size and trend velocity</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Buyer Accessibility</td>
                <td className="p-3 font-mono">10</td>
                <td className="p-3">Clarity of acquisition channels and buyer title</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Competition & Differentiation</td>
                <td className="p-3 font-mono">10</td>
                <td className="p-3">Competitor flaws and whitespace positioning</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Speed to Validation</td>
                <td className="p-3 font-mono">5</td>
                <td className="p-3">Feasibility of 14-day &lt;$500 pre-sell experiment</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Defensibility</td>
                <td className="p-3 font-mono">5</td>
                <td className="p-3">Workflow lock-in and switching cost moat</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
