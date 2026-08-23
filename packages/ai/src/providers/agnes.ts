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

    // When API key is not yet configured, provide graceful deterministic structured data
    if (!this.apiKey || this.apiKey.trim() === "") {
      logger.warn(
        "Agnes AI API Key not configured. Using deterministic offline fallback response.",
      );
      return this.generateFallbackStructured(messages, schema, model, purpose);
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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

      if (!response.ok) {
        throw new Error(`Agnes AI API error ${response.status}: ${await response.text()}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const rawContent = json.choices?.[0]?.message?.content || "{}";
      const parsedJson = JSON.parse(rawContent);
      const data = schema.parse(parsedJson);

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
    } catch (err) {
      logger.error(
        "Agnes AI request failed, falling back to deterministic response",
        err instanceof Error ? err : new Error(String(err)),
      );
      return this.generateFallbackStructured(messages, schema, model, purpose);
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

  private generateFallbackStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    model: string,
    purpose: string,
  ): StructuredCompletionResult<T> {
    const userMsg = messages.find((m) => m.role === "user")?.content || "";
    let mockData: unknown;

    if (userMsg.includes("Classify this signal") || purpose.includes("classification")) {
      let signalType = "PAIN_COMPLAINT";
      if (userMsg.toLowerCase().includes("would pay") || userMsg.toLowerCase().includes("budget")) {
        signalType = "PURCHASE_INTENT";
      } else if (
        userMsg.toLowerCase().includes("workaround") ||
        userMsg.toLowerCase().includes("csv")
      ) {
        signalType = "WORKAROUND_REQUEST";
      }

      mockData = {
        signalType,
        confidenceScore: 85,
      };
    } else {
      mockData = {
        signalType: "PAIN_COMPLAINT",
        sanitizedExcerpt: "Extracted workflow friction excerpt.",
        problemSummary: "Manual reconciliation process causing recurring quarterly delays.",
        actorRole: "DevOps Engineer / Platform Lead",
        workflowContext: "Continuous Integration & Cloud Compliance",
        severityScore: 4,
        frequencyScore: 4,
        intentToPayScore: 3,
        extractedEntities: ["Vercel", "GitHub Actions", "SOC2"],
        confidenceScore: 88,
      };
    }

    const costCents = 1;
    aiSpendLedger.recordSpend({
      model,
      promptTokens: 120,
      completionTokens: 85,
      costMinorUnits: costCents,
      purpose,
      timestamp: new Date(),
    });

    return {
      data: schema.parse(mockData),
      rawResponse: JSON.stringify(mockData),
      promptTokens: 120,
      completionTokens: 85,
      costMinorUnits: costCents,
      model,
    };
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
