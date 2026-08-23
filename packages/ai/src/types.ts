import { z } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  purpose?: string;
}

export interface StructuredCompletionResult<T> {
  data: T;
  rawResponse: string;
  promptTokens: number;
  completionTokens: number;
  costMinorUnits: number; // in cents
  model: string;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  costMinorUnits: number;
}

export interface LLMProvider {
  name: string;
  generateStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    options?: CompletionOptions,
  ): Promise<StructuredCompletionResult<T>>;
  generateEmbedding(text: string): Promise<EmbeddingResult>;
}
