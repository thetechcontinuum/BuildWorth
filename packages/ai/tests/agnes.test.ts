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

  describe("OpenAI-compatible chat completion and Bearer header", () => {
    const TestSchema = z.object({
      signalType: z.string(),
      confidenceScore: z.number(),
    });

    it("sends Bearer exactly once and requests JSON with agnes-2.5-flash model", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = init.headers as Record<string, string>;
        capturedBody = JSON.parse(init.body as string);

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signalType: "PAIN_POINT",
                    confidenceScore: 92,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 150, completion_tokens: 50 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const agnes = new AgnesAIProvider({
        apiKey: "Bearer my-secret-key",
        baseUrl: "https://apihub.agnes-ai.com/v1/",
      });

      const result = await agnes.generateStructured(
        [{ role: "user", content: "Classify this signal" }],
        TestSchema,
      );

      expect(capturedUrl).toBe("https://apihub.agnes-ai.com/v1/chat/completions");
      expect(capturedHeaders["Authorization"]).toBe("Bearer my-secret-key");
      expect(capturedHeaders["Content-Type"]).toBe("application/json");
      expect(capturedBody.model).toBe("agnes-2.5-flash");
      expect(capturedBody.response_format).toEqual({ type: "json_object" });
      expect(result.data.signalType).toBe("PAIN_POINT");
      expect(result.data.confidenceScore).toBe(92);
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
  });

  describe("Sanitized Diagnostic Error Mappings", () => {
    const TestSchema = z.object({ signalType: z.string() });

    it("maps 401 and 403 to AI_PROVIDER_AUTHENTICATION_FAILED", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Unauthorized", code: "invalid_api_key" } }), {
          status: 401,
        }),
      );

      const agnes = new AgnesAIProvider({ apiKey: "invalid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_AUTHENTICATION_FAILED");

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }),
      );
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_PROVIDER_AUTHENTICATION_FAILED");
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

    it("maps malformed JSON and schema mismatches to AI_OUTPUT_INVALID", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "not valid json {" } }] }),
          { status: 200 },
        ),
      );

      const agnes = new AgnesAIProvider({ apiKey: "valid-key" });
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_OUTPUT_INVALID");

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ wrongField: 123 }) } }] }),
          { status: 200 },
        ),
      );
      await expect(
        agnes.generateStructured([{ role: "user", content: "test" }], TestSchema),
      ).rejects.toThrow("AI_OUTPUT_INVALID");
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
