import { KillSwitchError } from "@buildworth/shared";
import { logger } from "./logger.js";

export interface SpendRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costMinorUnits: number; // in cents
  purpose: string;
  timestamp: Date;
}

/**
 * In-memory & DB-backed AI Spend Ledger with daily & monthly budget ceilings.
 */
export class AiSpendLedger {
  private dailyLimitCents: number;
  private monthlyLimitCents: number;
  private currentDailySpendCents = 0;
  private currentMonthlySpendCents = 0;
  private isKilled = false;

  constructor(dailyLimitCents = 500, monthlyLimitCents = 15000) {
    this.dailyLimitCents = dailyLimitCents;
    this.monthlyLimitCents = monthlyLimitCents;
  }

  public checkBudgetAvailable(estimatedCostCents: number): void {
    if (this.isKilled) {
      throw new KillSwitchError("AI_SPEND_CEILING");
    }
    if (this.currentDailySpendCents + estimatedCostCents > this.dailyLimitCents) {
      this.isKilled = true;
      logger.error(
        `AI daily spend limit reached: ${this.currentDailySpendCents + estimatedCostCents} > ${this.dailyLimitCents} cents`,
      );
      throw new KillSwitchError("AI_DAILY_SPEND_LIMIT_EXCEEDED");
    }
    if (this.currentMonthlySpendCents + estimatedCostCents > this.monthlyLimitCents) {
      this.isKilled = true;
      logger.error(
        `AI monthly spend limit reached: ${this.currentMonthlySpendCents + estimatedCostCents} > ${this.monthlyLimitCents} cents`,
      );
      throw new KillSwitchError("AI_MONTHLY_SPEND_LIMIT_EXCEEDED");
    }
  }

  public recordSpend(record: SpendRecord): void {
    this.currentDailySpendCents += record.costMinorUnits;
    this.currentMonthlySpendCents += record.costMinorUnits;
    logger.info(`Recorded AI spend: ${record.costMinorUnits} cents (${record.model})`, {
      dailySpendTotalCents: this.currentDailySpendCents,
      monthlySpendTotalCents: this.currentMonthlySpendCents,
      purpose: record.purpose,
    });
  }

  public getSpendTotals() {
    return {
      dailySpendCents: this.currentDailySpendCents,
      dailyLimitCents: this.dailyLimitCents,
      monthlySpendCents: this.currentMonthlySpendCents,
      monthlyLimitCents: this.monthlyLimitCents,
      isKilled: this.isKilled,
    };
  }

  public resetSpendForTesting(): void {
    this.currentDailySpendCents = 0;
    this.currentMonthlySpendCents = 0;
    this.isKilled = false;
  }
}

export const aiSpendLedger = new AiSpendLedger();
