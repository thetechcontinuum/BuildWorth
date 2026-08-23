import { z } from "zod";

export const ScoreDimensionSchema = z.object({
  dimensionKey: z.string(),
  name: z.string(),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  explanation: z.string().min(5),
  evidenceIds: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

export const ScorecardEvaluationSchema = z.object({
  opportunityScore: z.number().int().min(0).max(100),
  evidenceConfidenceScore: z.number().int().min(0).max(100),
  demandScore: z.number().int().min(0).max(100),
  feasibilityScore: z.number().int().min(0).max(100),
  economicsScore: z.number().int().min(0).max(100),
  competitionScore: z.number().int().min(0).max(100),
  goMarketScore: z.number().int().min(0).max(100),
  rubricVersion: z.string().min(1),
  isHypothesisOnly: z.boolean(),
  dimensions: z.array(ScoreDimensionSchema),
});
