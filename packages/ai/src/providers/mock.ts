import { z } from "zod";
import {
  LLMProvider,
  ChatMessage,
  CompletionOptions,
  StructuredCompletionResult,
  EmbeddingResult,
} from "../types.js";
import { aiSpendLedger } from "@buildworth/observability";

export class MockDeterministicProvider implements LLMProvider {
  public readonly name = "mock-deterministic";

  public async generateStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    options: CompletionOptions = {},
  ): Promise<StructuredCompletionResult<T>> {
    const costMinorUnits = 1; // 1 cent for mock
    aiSpendLedger.checkBudgetAvailable(costMinorUnits);

    const userMsg = messages.find((m) => m.role === "user")?.content || "";

    // Deterministic mock generation based on keywords
    let mockData: unknown;

    if (userMsg.includes("Classify this signal")) {
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

    const validated = schema.parse(mockData);

    aiSpendLedger.recordSpend({
      model: this.name,
      promptTokens: 250,
      completionTokens: 80,
      costMinorUnits,
      purpose: options.purpose || "mock_completion",
      timestamp: new Date(),
    });

    return {
      data: validated,
      rawResponse: JSON.stringify(validated),
      promptTokens: 250,
      completionTokens: 80,
      costMinorUnits,
      model: this.name,
    };
  }

  public async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Generate deterministic 64-dimension embedding for test vectors
    const embedding: number[] = new Array(64).fill(0);
    for (let i = 0; i < text.length; i++) {
      const idx = i % 64;
      embedding[idx] = ((embedding[idx] || 0) + text.charCodeAt(i)) / 1000;
    }
    // Normalize vector
    const mag = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    const normalized = embedding.map((v) => v / mag);

    return {
      embedding: normalized,
      dimensions: 64,
      costMinorUnits: 0,
    };
  }
}
