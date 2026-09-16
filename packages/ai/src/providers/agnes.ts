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

export function normalizeBaseUrl(rawUrl?: string): string {
  let url = (rawUrl || "https://apihub.agnes-ai.com/v1").trim();
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/, "");
  url = url.replace(/\/+$/, "");
  while (url.endsWith("/v1/v1")) {
    url = url.slice(0, -3);
  }
  if (!url.endsWith("/v1")) {
    url = `${url}/v1`;
  }
  return url;
}

export function normalizeApiKey(rawKey?: string): string {
  let key = (rawKey || "").trim();
  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }
  return key;
}

export function extractContentString(rawMsgContent: unknown): string {
  if (typeof rawMsgContent === "string") {
    return rawMsgContent;
  }
  if (Array.isArray(rawMsgContent)) {
    return rawMsgContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function parseModelOutput<T>(
  choice: { message?: { content?: unknown }; finish_reason?: string } | undefined,
  schema: z.ZodSchema<T>,
): T {
  if (!choice) {
    throw new Error("AI_OUTPUT_EMPTY");
  }

  if (choice.finish_reason === "length") {
    throw new Error("AI_OUTPUT_TRUNCATED");
  }

  const rawContent = extractContentString(choice.message?.content).trim();
  if (!rawContent) {
    throw new Error("AI_OUTPUT_EMPTY");
  }

  let jsonStr = rawContent;
  const fenceMatch = rawContent.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err: any) {
    throw new Error(`AI_OUTPUT_INVALID: JSON parse error: ${err?.message || "Invalid JSON"}`);
  }

  try {
    return schema.parse(parsed);
  } catch (err: any) {
    throw new Error(`AI_OUTPUT_INVALID: Schema validation error: ${err?.message || "Invalid schema"}`);
  }
}

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
    this.apiKey = normalizeApiKey(config?.apiKey || env.AGNES_AI_API_KEY || "");
    this.baseUrl = normalizeBaseUrl(config?.baseUrl || env.AGNES_AI_BASE_URL || "https://apihub.agnes-ai.com/v1");
    this.defaultModel = config?.model || env.AGNES_AI_MODEL || "agnes-2.5-flash";
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

    if (!this.apiKey || this.apiKey.trim() === "") {
      logger.warn("Agnes AI API Key not configured.");
      throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    }

    const endpoint = `${this.baseUrl}/chat/completions`;

    const formatMessages = (msgs: ChatMessage[]): ChatMessage[] => {
      const formatted = [...msgs];
      const systemPromptIndex = formatted.findIndex((m) => m.role === "system");
      const jsonInstruction =
        "Respond strictly with a single valid JSON object matching the requested schema. Do not wrap with markdown code blocks or add any explanatory text outside JSON.";
      if (systemPromptIndex >= 0 && formatted[systemPromptIndex]) {
        const existing = formatted[systemPromptIndex];
        formatted[systemPromptIndex] = {
          role: "system",
          content: `${existing?.content || ""}\n\n${jsonInstruction}`,
        };
      } else {
        formatted.unshift({
          role: "system",
          content: jsonInstruction,
        });
      }
      return formatted;
    };

    const callApi = async (reqMessages: ChatMessage[], isRetry = false): Promise<any> => {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: reqMessages,
            temperature: options?.temperature ?? 0.1,
            max_tokens: isRetry ? 2500 : (options?.maxTokens ?? 2000),
            response_format: { type: "json_object" },
          }),
        });
      } catch (netErr: any) {
        logger.error(
          "Agnes AI fetch failed",
          netErr instanceof Error ? netErr : new Error(String(netErr)),
        );
        throw new Error(`AI_PROVIDER_UNAVAILABLE: ${netErr?.message || "Network error"}`);
      }

      if (!response.ok) {
        const status = response.status;
        const requestId =
          response.headers.get("x-request-id") ||
          response.headers.get("request-id") ||
          undefined;

        let errorBodyText = "";
        try {
          errorBodyText = await response.text();
        } catch {
          // ignore
        }

        let providerCode = "";
        try {
          const errJson = JSON.parse(errorBodyText);
          providerCode = errJson?.error?.code || errJson?.code || errJson?.error?.type || "";
        } catch {
          // not json
        }

        logger.error("Agnes AI request error", undefined, {
          status,
          providerCode,
          requestId,
        });

        if (status === 401 || status === 403) {
          throw new Error("AI_PROVIDER_AUTHENTICATION_FAILED");
        }

        if (status === 404) {
          const lowerBody = errorBodyText.toLowerCase();
          if (lowerBody.includes("model") || providerCode.toLowerCase().includes("model")) {
            throw new Error("AI_MODEL_NOT_FOUND");
          }
          throw new Error("AI_PROVIDER_ENDPOINT_INVALID");
        }

        if (status === 429) {
          throw new Error("AI_PROVIDER_RATE_LIMITED");
        }

        if (status >= 500) {
          throw new Error(`AI_PROVIDER_UNAVAILABLE: HTTP ${status}`);
        }

        throw new Error(`AI_PROVIDER_UNAVAILABLE: HTTP ${status}`);
      }

      try {
        return await response.json();
      } catch {
        throw new Error("AI_OUTPUT_INVALID: Invalid JSON response from provider");
      }
    };

    const initialMessages = formatMessages(messages);
    let json = await callApi(initialMessages, false);

    let data: T;
    let rawResponse = extractContentString(json?.choices?.[0]?.message?.content);

    try {
      data = parseModelOutput(json?.choices?.[0], schema);
    } catch (firstErr: any) {
      const errMsg = firstErr?.message || "";
      const isRetryable =
        errMsg.startsWith("AI_OUTPUT_TRUNCATED") ||
        errMsg.startsWith("AI_OUTPUT_INVALID") ||
        errMsg.startsWith("AI_OUTPUT_EMPTY");

      if (!isRetryable) {
        throw firstErr;
      }

      logger.warn("First AI structured output attempt failed, performing bounded retry", {
        reason: errMsg,
        model,
        purpose,
      });

      const retryMessages: ChatMessage[] = [
        ...initialMessages,
        ...(rawResponse ? [{ role: "assistant" as const, content: rawResponse }] : []),
        {
          role: "user",
          content:
            "Your previous response was malformed, truncated, or failed JSON schema validation. Return strictly a single valid JSON object conforming directly to the required schema. Do NOT wrap in markdown fencing. Do NOT include any explanations outside JSON.",
        },
      ];

      json = await callApi(retryMessages, true);
      rawResponse = extractContentString(json?.choices?.[0]?.message?.content);

      try {
        data = parseModelOutput(json?.choices?.[0], schema);
      } catch (retryErr: any) {
        logger.error(
          "Bounded AI retry failed",
          retryErr instanceof Error ? retryErr : new Error(String(retryErr)),
          {
            model,
            purpose,
          },
        );
        throw retryErr;
      }
    }

    const promptTokens = json?.usage?.prompt_tokens || 100;
    const completionTokens = json?.usage?.completion_tokens || 100;
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
      rawResponse,
      promptTokens,
      completionTokens,
      costMinorUnits: costCents,
      model,
    };
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
        return {
          embedding: this.deterministicEmbedding(text, 64),
          dimensions: 64,
          costMinorUnits: costCents,
        };
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
