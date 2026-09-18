import { describe, it, expect, vi, afterEach } from "vitest";
import { MockDeterministicProvider, AgnesAIProvider } from "@buildworth/ai";
import { classifySignal } from "../src/classifier.js";
import { extractSignalIntelligence } from "../src/extractor.js";

describe("Signal Classifier & Extractor Pipelines", () => {
  const mockAi = new MockDeterministicProvider();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("classifies signals into valid domain categories with deterministic provider", async () => {
    const res = await classifySignal(
      mockAi,
      "We would pay $500/mo for a tool that automates this.",
    );
    expect(res.signalType).toBe("PURCHASE_INTENT");
    expect(res.confidenceScore).toBe(85);
  });

  it("classifies signals end-to-end using AgnesAIProvider with schema-compliant response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  signalType: "PAIN_COMPLAINT",
                  confidenceScore: 92,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const agnes = new AgnesAIProvider({ apiKey: "test-key" });
    const res = await classifySignal(
      agnes,
      "Our deployments are constantly failing due to manual configs.",
      "Deployment issues",
    );

    expect(res.signalType).toBe("PAIN_COMPLAINT");
    expect(res.confidenceScore).toBe(92);
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
