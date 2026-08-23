import { z } from "zod";
import { MoneyRangeSchema } from "./money.js";

export const OpportunityCreateSchema = z.object({
  title: z.string().min(5).max(150),
  oneSentenceSummary: z.string().min(20).max(300),
  problemStatement: z.string().min(30),
  jobsToBeDone: z.array(z.string().min(5)).min(1),
  proposedProduct: z.string().min(30),
  narrowMvpScope: z.array(z.string().min(5)).min(1),
  targetCustomerSegments: z.array(z.string().min(3)).min(1),
  economicBuyer: z.string().min(3),
  endUser: z.string().min(3),
  buyingTrigger: z.string().min(10),
  existingWorkflow: z.string().min(10),
  painSeverity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  painFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "OCCASIONAL"]),
  customerType: z.enum(["B2B", "B2C", "PROSUMER", "INTERNAL_TOOL"]).default("B2B"),
  industry: z.string().min(2),
  estimatedMvpCost: MoneyRangeSchema,
  estimatedTimeToMvpWeeks: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  estimatedMonthlyOperatingCost: MoneyRangeSchema,
  recommendedNextExperiment: z.string().min(20),
  majorAssumptions: z.array(z.string()).default([]),
  majorRisks: z.array(z.string()).default([]),
});
