import { MoneyRange } from "./money.js";

export type OpportunityStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type CustomerType = "B2B" | "B2C" | "PROSUMER" | "INTERNAL_TOOL";

export interface OpportunityCore {
  id: string;
  slug: string;
  title: string;
  oneSentenceSummary: string;
  problemStatement: string;
  jobsToBeDone: string[];
  proposedProduct: string;
  narrowMvpScope: string[];
  targetCustomerSegments: string[];
  economicBuyer: string;
  endUser: string;
  buyingTrigger: string;
  existingWorkflow: string;
  painSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  painFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "OCCASIONAL";
  status: OpportunityStatus;
  customerType: CustomerType;
  industry: string;
  estimatedMvpCost: MoneyRange;
  estimatedTimeToMvpWeeks: { min: number; max: number };
  estimatedMonthlyOperatingCost: MoneyRange;
  recommendedNextExperiment: string;
}
