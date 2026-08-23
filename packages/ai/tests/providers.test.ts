import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MockDeterministicProvider } from "../src/providers/mock.js";
import { buildSignalClassificationPrompt } from "../src/prompts/classify.js";

describe("AI Providers", () => {
  it("generates validated structured data and updates spend ledger", async () => {
    const provider = new MockDeterministicProvider();
    const prompt = buildSignalClassificationPrompt(
      "Would pay $500/mo for a tool that automates this.",
    );
    const schema = z.object({
      signalType: z.string(),
      confidenceScore: z.number(),
    });

    const result = await provider.generateStructured(prompt, schema);
    expect(result.data.signalType).toBe("PURCHASE_INTENT");
    expect(result.data.confidenceScore).toBe(85);
    expect(result.costMinorUnits).toBe(1);
  });

  it("generates normalized embeddings", async () => {
    const provider = new MockDeterministicProvider();
    const result = await provider.generateEmbedding("Snowflake FinOps Query Anomaly");
    expect(result.dimensions).toBe(64);
    expect(result.embedding.length).toBe(64);
  });
});
