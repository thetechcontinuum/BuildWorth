"use client";

import React, { useState } from "react";
import { FullVentureBlueprint, ScenarioType } from "@buildworth/shared";

interface Props {
  blueprint: FullVentureBlueprint;
}

export function CostBenefitEconomicsSection({ blueprint }: Props) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("BASE");

  const scenario = blueprint.financialScenarios.find(s => s.scenarioType === selectedScenario) || blueprint.financialScenarios[0];
  const { costLineItems, benefitDrivers } = blueprint;

  const buildCosts = costLineItems.filter(c => c.costType === "ONE_TIME_BUILD");
  
  const totalBuildCents = buildCosts.reduce((acc, c) => acc + c.amountMinorCents, 0);

  return (
    <section id="section-cost-benefit" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>💰</span> Cost-Benefit Economics & Scenarios
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative integer cents arithmetic with explicit scenario models and customer ROI quantification.
          </p>
        </div>

        {/* Scenario Toggle */}
        <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {(["CONSERVATIVE", "BASE", "UPSIDE"] as ScenarioType[]).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedScenario(st)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                selectedScenario === st
                  ? "bg-indigo-600 text-white font-bold shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Key Figures Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-xl">
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">Monthly Price</div>
          <div className="text-lg font-bold text-zinc-100">`$${(scenario?.monthlyPriceCents || 0) / 100} / mo`</div>
          <div className="text-[10px] text-zinc-400">`Var Cost: $${(scenario?.variableCostPerCustomerCents || 0) / 100}/cust`</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">Gross Margin</div>
          <div className="text-lg font-bold text-emerald-400">
            {scenario?.grossMarginPercent.status === "CALCULATED" ? `${scenario.grossMarginPercent.value}%` : "N/A"}
          </div>
          <div className="text-[10px] text-zinc-400">Unit Contribution Margin</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">Break-Even Customers</div>
          <div className="text-lg font-bold text-zinc-100">
            {scenario?.breakEvenCustomers.status === "CALCULATED" ? `${scenario.breakEvenCustomers.value} cust` : "Negative"}
          </div>
          <div className="text-[10px] text-zinc-400">`Fixed Cost: $${(scenario?.monthlyFixedCostCents || 0) / 100}/mo`</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">Customer ROI</div>
          <div className="text-lg font-bold text-indigo-300">
            {scenario?.customerRoiPercent.status === "CALCULATED" ? `${scenario.customerRoiPercent.value}%` : "N/A"}
          </div>
          <div className="text-[10px] text-zinc-400">`Payback: ${scenario?.customerPaybackMonths.value} mos`</div>
        </div>
      </div>

      {/* Itemized Cost Breakdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
              Itemized MVP Build Costs
            </h3>
            <span className="text-xs font-mono font-bold text-zinc-100">
              `Total: $${totalBuildCents / 100}`
            </span>
          </div>
          <div className="space-y-2">
            {buildCosts.map((c) => (
              <div key={c.id} className="p-3 bg-zinc-950/50 border border-zinc-800/60 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-zinc-200">{c.title}</div>
                  <div className="text-[10px] text-zinc-500">{c.estimateMethod}</div>
                </div>
                <div className="font-mono font-bold text-zinc-200">
                  `$${c.amountMinorCents / 100}`
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
              Quantified Customer Benefit Drivers
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-300">
              Annual Value
            </span>
          </div>
          <div className="space-y-2">
            {benefitDrivers.map((b) => (
              <div key={b.id} className="p-3 bg-zinc-950/50 border border-emerald-950/40 rounded-lg space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-emerald-200">{b.title}</div>
                  <div className="font-mono font-bold text-emerald-300">
                    `+$${b.annualValueCents / 100} / yr`
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400">{b.calculationDescription}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
