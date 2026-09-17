import { describe, it, expect, vi } from "vitest";
import { sourceRegistry } from "../src/registry.js";
import { runAdapterIngestion } from "../src/runner.js";

describe("Source Registry & Adapters", () => {
  it("has 4 registered adapters by default", () => {
    const adapters = sourceRegistry.getAllAdapters();
    expect(adapters.length).toBe(4);
  });

  it("returns zero items cleanly when external API is unreachable or unconfigured", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    // Default fetch in test environment fails or is unconfigured -> returns 0 items, never mocks
    const result = await runAdapterIngestion(adapter);
    expect(result.totalIngested).toBe(0);
    expect(result.signals.length).toBe(0);
  });

  it("successfully ingests and sanitizes real API responses when available", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          {
            objectID: "99991234",
            title: "Ask HN: How do you handle multi-cloud secret rotation?",
            story_text: "Our team struggles with synchronizing KMS keys across AWS and GCP securely.",
            author: "cloud_eng",
            created_at: "2026-09-15T12:00:00Z",
            points: 55,
            num_comments: 23,
          },
        ],
      }),
    } as any);

    const result = await runAdapterIngestion(adapter);
    expect(result.totalIngested).toBe(1);
    expect(result.signals[0]?.externalId).toBe("hn-99991234");
    expect(result.signals[0]?.canonicalUrl).toBe("https://news.ycombinator.com/item?id=99991234");
    expect(result.signals[0]?.sanitizedExcerpt).toBeDefined();
    expect(result.signals[0]?.contentHash).toBeDefined();

    mockFetch.mockRestore();
  });
});

