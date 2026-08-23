import { describe, it, expect, beforeEach } from "vitest";
import { AiSpendLedger } from "../src/spend-ledger.js";
import { KillSwitchError } from "@buildworth/shared";

describe("AI Spend Guardrail", () => {
  let ledger: AiSpendLedger;

  beforeEach(() => {
    ledger = new AiSpendLedger(500, 15000); // $5.00 daily, $150 monthly
  });

  it("allows spend within daily limit", () => {
    expect(() => ledger.checkBudgetAvailable(100)).not.toThrow();
    ledger.recordSpend({
      model: "gpt-4o-mini",
      promptTokens: 1000,
      completionTokens: 200,
      costMinorUnits: 100,
      purpose: "signal_extraction",
      timestamp: new Date(),
    });
    expect(ledger.getSpendTotals().dailySpendCents).toBe(100);
  });

  it("blocks and trips kill switch when daily limit is exceeded", () => {
    ledger.recordSpend({
      model: "gpt-4o",
      promptTokens: 5000,
      completionTokens: 2000,
      costMinorUnits: 450,
      purpose: "opportunity_synthesis",
      timestamp: new Date(),
    });

    // Next request of 60 cents pushes past 500 cents limit
    expect(() => ledger.checkBudgetAvailable(60)).toThrow(KillSwitchError);
    expect(ledger.getSpendTotals().isKilled).toBe(true);
  });
});
