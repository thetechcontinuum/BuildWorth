import { z } from "zod";

export const SignalTypeSchema = z.enum([
  "PAIN_COMPLAINT",
  "WORKAROUND_REQUEST",
  "PURCHASE_INTENT",
  "COMPETITOR_DISSATISFACTION",
  "FEATURE_REQUEST",
  "EMERGING_TECH",
  "NOISE",
]);

export const RawSignalInputSchema = z.object({
  sourceId: z.string().uuid(),
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  authorFingerprint: z.string().optional(),
  title: z.string().max(500).optional(),
  rawContent: z.string().min(10).max(50000),
  publishedAt: z.date().or(z.string().datetime()),
  metadata: z.record(z.unknown()).default({}),
});

export const NormalizedSignalSchema = z.object({
  signalType: SignalTypeSchema,
  sanitizedExcerpt: z.string().max(1000),
  problemSummary: z.string().min(5),
  actorRole: z.string().optional(),
  workflowContext: z.string().optional(),
  severityScore: z.number().min(1).max(5),
  frequencyScore: z.number().min(1).max(5),
  intentToPayScore: z.number().min(0).max(5),
  extractedEntities: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100),
});
