import { describe, it, expect } from "vitest";
import { MockDeterministicProvider } from "@buildworth/ai";
import { classifySignal } from "../src/classifier.js";
import { extractSignalIntelligence } from "../src/extractor.js";

describe("Signal Classifier & Extractor Pipelines", () => {
  const mockAi = new MockDeterministicProvider();

  it("classifies signals into valid domain categories", async () => {
    const res = await classifySignal(
      mockAi,
      "We would pay $500/mo for a tool that automates this.",
    );
    expect(res.signalType).toBe("PURCHASE_INTENT");
    expect(res.confidenceScore).toBe(85);
  });

  it("extracts structured intelligence with severity and frequency", async () => {
    const res = await extractSignalIntelligence(
      mockAi,
      "Manual screenshot capture takes 40 hours for SOC2.",
    );
    expect(res.severityScore).toBe(4);
    expect(res.extractedEntities).toContain("SOC2");
  });
});
