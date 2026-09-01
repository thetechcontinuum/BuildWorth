import { z } from "zod";
import {
  LLMProvider,
  ChatMessage,
  CompletionOptions,
  StructuredCompletionResult,
  EmbeddingResult,
} from "../types.js";
import { aiSpendLedger, logger } from "@buildworth/observability";
import { getEnv } from "@buildworth/config";

export class AgnesAIProvider implements LLMProvider {
  public readonly name = "agnes-ai";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultEmbeddingModel: string;

  constructor(config?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    embeddingModel?: string;
  }) {
    const env = getEnv();
    this.apiKey = config?.apiKey || env.AGNES_AI_API_KEY || "";
    this.baseUrl = config?.baseUrl || env.AGNES_AI_BASE_URL || "https://api.agnes-ai.com/v1";
    this.defaultModel = config?.model || env.AGNES_AI_MODEL || "agnes-default";
    this.defaultEmbeddingModel =
      config?.embeddingModel || env.AGNES_AI_EMBEDDING_MODEL || "agnes-embed-default";
  }

  public async generateStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    options?: CompletionOptions,
  ): Promise<StructuredCompletionResult<T>> {
    const model = options?.model || this.defaultModel;
    const purpose = options?.purpose || "structured_completion";

    logger.info(`Calling Agnes AI (${this.baseUrl}) model: ${model}`, { purpose });

    // When API key is not configured, throw AI_PROVIDER_NOT_CONFIGURED
    if (!this.apiKey || this.apiKey.trim() === "") {
      logger.warn("Agnes AI API Key not configured.");
      throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    }

    try {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? 0.1,
            max_tokens: options?.maxTokens ?? 2000,
            response_format: { type: "json_object" },
          }),
        });
      } catch (netErr: any) {
        throw new Error(`AI_PROVIDER_UNAVAILABLE: ${netErr.message}`);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("AI_PROVIDER_NOT_CONFIGURED: Invalid API key");
        }
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`AI_PROVIDER_UNAVAILABLE: HTTP ${response.status}`);
        }
        throw new Error(`AI_PROVIDER_UNAVAILABLE: HTTP ${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const rawContent = json.choices?.[0]?.message?.content || "{}";
      
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        throw new Error("AI_OUTPUT_INVALID: JSON parse error");
      }

      let data: T;
      try {
        data = schema.parse(parsedJson);
      } catch (parseErr: any) {
        throw new Error(`AI_OUTPUT_INVALID: ${parseErr.message}`);
      }

      const promptTokens = json.usage?.prompt_tokens || 100;
      const completionTokens = json.usage?.completion_tokens || 100;
      const costCents = Math.max(1, Math.round((promptTokens + completionTokens) * 0.0005));

      aiSpendLedger.recordSpend({
        model,
        promptTokens,
        completionTokens,
        costMinorUnits: costCents,
        purpose,
        timestamp: new Date(),
      });

      return {
        data,
        rawResponse: rawContent,
        promptTokens,
        completionTokens,
        costMinorUnits: costCents,
        model,
      };
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.startsWith("AI_PROVIDER_NOT_CONFIGURED") ||
        msg.startsWith("AI_PROVIDER_UNAVAILABLE") ||
        msg.startsWith("AI_OUTPUT_INVALID")
      ) {
        throw err;
      }
      throw new Error(`AI_PROVIDER_UNAVAILABLE: ${msg}`);
    }
  }

  public async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const model = this.defaultEmbeddingModel;
    const costCents = 1;

    if (!this.apiKey || this.apiKey.trim() === "") {
      aiSpendLedger.recordSpend({
        model,
        promptTokens: 10,
        completionTokens: 0,
        costMinorUnits: costCents,
        purpose: "text_embedding",
        timestamp: new Date(),
      });
      return {
        embedding: this.deterministicEmbedding(text, 64),
        dimensions: 64,
        costMinorUnits: costCents,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Agnes AI embeddings error ${response.status}`);
      }

      const json = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embedding = json.data?.[0]?.embedding || this.deterministicEmbedding(text, 64);

      aiSpendLedger.recordSpend({
        model,
        promptTokens: 10,
        completionTokens: 0,
        costMinorUnits: costCents,
        purpose: "text_embedding",
        timestamp: new Date(),
      });

      return {
        embedding,
        dimensions: embedding.length,
        costMinorUnits: costCents,
      };
    } catch {
      aiSpendLedger.recordSpend({
        model,
        promptTokens: 10,
        completionTokens: 0,
        costMinorUnits: costCents,
        purpose: "text_embedding",
        timestamp: new Date(),
      });
      return {
        embedding: this.deterministicEmbedding(text, 64),
        dimensions: 64,
        costMinorUnits: costCents,
      };
    }
  }


  private deterministicEmbedding(text: string, dims = 64): number[] {
    const vector = new Array(dims).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < dims; i++) {
      vector[i] = Math.sin(hash + i);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map((val) => val / (magnitude || 1));
  }
}
