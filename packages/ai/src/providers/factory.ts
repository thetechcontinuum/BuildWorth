import { LLMProvider } from "../types.js";
import { AgnesAIProvider } from "./agnes.js";
import { MockDeterministicProvider } from "./mock.js";
import { getEnv } from "@buildworth/config";

export function getLLMProvider(providerName?: string): LLMProvider {
  const env = getEnv();
  const selected = providerName || env.AI_PROVIDER || "agnes";

  if (selected === "mock") {
    return new MockDeterministicProvider();
  }

  // Default to Agnes AI (https://agnes-ai.com)
  return new AgnesAIProvider();
}

export const defaultAI = getLLMProvider();
