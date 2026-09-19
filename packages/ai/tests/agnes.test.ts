import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgnesAIProvider, normalizeBaseUrl, normalizeApiKey } from "../src/providers/agnes.js";
import { z } from "zod";

describe("Agnes AI Provider (https://agnes-ai.com)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("URL and Key Normalization", () => {
    it("normalizes documented base URL, trailing slashes, duplicate /v1, and /chat/completions", () => {
      expect(normalizeBaseUrl()).toBe("https://apihub.agnes-ai.com/v1");
      expect(normalizeBaseUrl("https://apihub.agnes-ai.com/v1")).toBe("https://apihub.agnes-ai.com/v1");
      expect(normalizeBaseUrl("https://apihub.agnes-ai.com/v1/")).toBe("https://apihub.agnes-ai.com/v1");
      expect(normalizeBaseUrl("https://apihub.agnes-ai.com")).toBe("https://apihub.agnes-ai.com/v1");
      expect(normalizeBaseUrl("https://apihub.agnes-ai.com/v1/v1")).toBe("https://apihub.agnes-ai.com/v1");
      expect(normalizeBaseUrl("https://apihub.agnes-ai.com/v1/chat/completions")).toBe("https://apihub.agnes-ai.com/v1");
    });

    it("normalizes API keys, trims whitespace, and strips duplicate Bearer prefix", () => {
      expect(normalizeApiKey("  secret-key-123  ")).toBe("secret-key-123");
      expect(normalizeApiKey("Bearer secret-key-123")).toBe("secret-key-123");
      expect(normalizeApiKey("bearer  secret-key-123  ")).toBe("secret-key-123");
      expect(normalizeApiKey("")).toBe("");
    });
  });

  describe("Default Configuration and Model", () => {
    it("initializes with documented defaults: agnes-2.5-flash and https://apihub.agnes-ai.com/v1", () => {
      const agnes = new AgnesAIProvider();
      expect(agnes.name).toBe("agnes-ai");
      // @ts-ignore
      expect(agnes.baseUrl).toBe("https://apihub.agnes-ai.com/v1");
      // @ts-ignore
      expect(agnes.defaultModel).toBe("agnes-2.5-flash");
    });

    it("fails safely with AI_PROVIDER_NOT_CONFIGURED when API key is missing", async () => {
      const agnes = new AgnesAIProvider({ apiKey: "" });
      const TestSchema = z.object({ signalType: z.string() });

      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_NOT_CONFIGURED");
    });
  });

  describe("OpenAI-compatible chat completion, content formatting and bounded retries", () => {
    const TestSchema = z.object({
      signalType: z.string(),
      confidenceScore: z.number(),
    });

    it("parses plain valid JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signalType: "PAIN_COMPLAINT",
                    confidenceScore: 90,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      const result = await agnes.generateStructured(
        [{ role: "user", content: "Classify" }],
        TestSchema,
      );

      expect(result.data.signalType).toBe("PAIN_COMPLAINT");
      expect(result.data.confidenceScore).toBe(90);
    });

    it("parses valid JSON wrapped in markdown code fencing", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "```json\n{\"signalType\": \"PURCHASE_INTENT\", \"confidenceScore\": 88}\n```",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      const result = await agnes.generateStructured(
        [{ role: "user", content: "Classify" }],
        TestSchema,
      );

      expect(result.data.signalType).toBe("PURCHASE_INTENT");
      expect(result.data.confidenceScore).toBe(88);
    });

    it("parses content returned as a text-content array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    { type: "text", text: "{\"signalType\": \"WORKAROUND_REQUEST\"," },
                    { type: "text", text: " \"confidenceScore\": 85}" },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      const result = await agnes.generateStructured(
        [{ role: "user", content: "Classify" }],
        TestSchema,
      );

      expect(result.data.signalType).toBe("WORKAROUND_REQUEST");
      expect(result.data.confidenceScore).toBe(85);
    });

    it("handles missing/empty content by retrying and throwing AI_OUTPUT_EMPTY if still empty", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "Classify" }], TestSchema),
      ).rejects.toThrow("AI_OUTPUT_EMPTY");
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("handles finish_reason=length by retrying and throwing AI_OUTPUT_TRUNCATED if retry also truncates", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: "{\"signalType\": \"PAIN_POINT\"" },
                finish_reason: "length",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "Classify" }], TestSchema),
      ).rejects.toThrow("AI_OUTPUT_TRUNCATED");
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("succeeds on bounded retry after initial malformed JSON", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First attempt: malformed JSON
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: "invalid json string {" } }],
            }),
            { status: 200 },
          );
        }
        // Second attempt (retry): valid JSON
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signalType: "EMERGING_TECH",
                    confidenceScore: 95,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        );
      });

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      const result = await agnes.generateStructured(
        [{ role: "user", content: "Classify" }],
        TestSchema,
      );

      expect(callCount).toBe(2);
      expect(result.data.signalType).toBe("EMERGING_TECH");
      expect(result.data.confidenceScore).toBe(95);
    });

    it("fails closed with AI_OUTPUT_INVALID after failed retry on schema mismatch", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ wrongField: 123 }),
                },
              },
            ],
          }),
          { status: 200 },
        );
      });

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "Classify" }], TestSchema),
      ).rejects.toThrow("AI_OUTPUT_INVALID");

      expect(callCount).toBe(2);
    });
  });

  describe("Sanitized Diagnostic Error Mappings", () => {
    const TestSchema = z.object({ signalType: z.string() });

    it("maps 401 and 403 to AI_PROVIDER_AUTHENTICATION_FAILED without retrying", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Unauthorized", code: "invalid_api_key" } }), {
          status: 401,
        }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "invalid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_AUTHENTICATION_FAILED");

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("maps 404 model not found to AI_MODEL_NOT_FOUND", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "The model `agnes-xyz` does not exist", code: "model_not_found" } }), {
          status: 404,
        }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_MODEL_NOT_FOUND");
    });

    it("maps 404 invalid endpoint to AI_PROVIDER_ENDPOINT_INVALID", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("404 page not found", { status: 404 }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_ENDPOINT_INVALID");
    });

    it("maps 429 to AI_PROVIDER_RATE_LIMITED", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), { status: 429 }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_RATE_LIMITED");
    });

    it("maps 5xx and network errors to AI_PROVIDER_UNAVAILABLE", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Internal server error" } }), { status: 503 }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_UNAVAILABLE: HTTP 503");

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_UNAVAILABLE: ECONNREFUSED");
    });
  });

  describe("Embedding generation", () => {
    it("generates fallback deterministic embedding when API key is missing", async () => {
      const agnes = new AgnesAIProvider({ apiKey: "" });
      const embResult = await agnes.generateEmbedding("Manual SOC2 screenshot compliance problem");

      expect(embResult.dimensions).toBe(64);
      expect(embResult.embedding.length).toBe(64);
      expect(embResult.costMinorUnits).toBe(1);
    });
  });
});
