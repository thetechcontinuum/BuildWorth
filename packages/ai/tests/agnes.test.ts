import { describe, it, expect } from "vitest";
import { AgnesAIProvider } from "../src/providers/agnes.js";
import { z } from "zod";

describe("Agnes AI Provider (https://agnes-ai.com)", () => {
  it("initializes Agnes AI provider with default config and generates structured data", async () => {
    const agnes = new AgnesAIProvider();
    expect(agnes.name).toBe("agnes-ai");

    const TestSchema = z.object({
      signalType: z.string(),
      confidenceScore: z.number(),
    });

    const result = await agnes.generateStructured(
      [{ role: "user", content: "Classify this signal complaint" }],
      TestSchema,
      { purpose: "signal_classification" },
    );

    expect(result.data.signalType).toBeDefined();
    expect(result.data.confidenceScore).toBeGreaterThan(0);
    expect(result.costMinorUnits).toBeGreaterThanOrEqual(1);
  });

  it("generates embeddings via Agnes AI", async () => {
    const agnes = new AgnesAIProvider();
    const embResult = await agnes.generateEmbedding("Manual SOC2 screenshot compliance problem");

    expect(embResult.dimensions).toBe(64);
    expect(embResult.embedding.length).toBe(64);
    expect(embResult.costMinorUnits).toBe(1);
  });
});
