import { LLMProvider, buildSignalExtractionPrompt } from "@buildworth/ai";
import { NormalizedSignalSchema } from "@buildworth/validation";

export async function extractSignalIntelligence(
  ai: LLMProvider,
  sanitizedExcerpt: string,
  title?: string,
) {
  const prompt = buildSignalExtractionPrompt(sanitizedExcerpt, title);
  const result = await ai.generateStructured(prompt, NormalizedSignalSchema, {
    purpose: "signal_extraction",
  });
  return result.data;
}
