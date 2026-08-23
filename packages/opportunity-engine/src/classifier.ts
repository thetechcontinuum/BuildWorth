import { LLMProvider, buildSignalClassificationPrompt } from "@buildworth/ai";
import { SignalTypeSchema } from "@buildworth/validation";
import { z } from "zod";

const ClassificationResultSchema = z.object({
  signalType: SignalTypeSchema,
  confidenceScore: z.number().min(0).max(100),
});

export async function classifySignal(ai: LLMProvider, rawContent: string, title?: string) {
  const prompt = buildSignalClassificationPrompt(rawContent, title);
  const result = await ai.generateStructured(prompt, ClassificationResultSchema, {
    purpose: "signal_classification",
  });
  return result.data;
}
