import { describe, it, expect } from "vitest";
import { sourceRegistry } from "../src/registry.js";
import { runAdapterIngestion } from "../src/runner.js";

describe("Source Registry & Adapters", () => {
  it("has 4 registered adapters by default", () => {
    const adapters = sourceRegistry.getAllAdapters();
    expect(adapters.length).toBe(4);
  });

  it("successfully ingests and sanitizes signals from Hacker News adapter", async () => {
    const adapter = sourceRegistry.getAdapter("hackernews");
    expect(adapter).toBeDefined();
    if (!adapter) return;

    const result = await runAdapterIngestion(adapter);
    expect(result.totalIngested).toBeGreaterThanOrEqual(1);
    expect(result.signals[0]?.sanitizedExcerpt).toBeDefined();
    expect(result.signals[0]?.contentHash).toBeDefined();
  });
});
