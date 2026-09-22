import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockDeterministicProvider } from "@buildworth/ai";
import { executeIntelligencePipeline } from "../src/pipeline.js";
import { generateVentureDossierMarkdown } from "../src/dossier.js";

describe("End-to-End Intelligence Pipeline", () => {
  const mockAi = new MockDeterministicProvider();
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("algolia")) {
        return {
          ok: true,
          json: async () => ({
            hits: [
              {
                objectID: "777701",
                title: "Ask HN: How do you handle secrets rotation in CI/CD?",
                story_text: "Managing cross-cloud secrets rotation causes constant friction and downtime risk.",
                author: "hn_user_1",
                created_at: new Date().toISOString(),
                points: 90,
                num_comments: 30,
              },
            ],
          }),
        } as any;
      }
      if (urlStr.includes("github.com")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 666601,
                html_url: "https://github.com/org/repo/issues/666601",
                title: "Secrets rotation synchronization failure",
                body: "Friction in rotating secrets across environments causes deployment blockers.",
                user: { login: "gh_user_1" },
                created_at: new Date().toISOString(),
                comments: 15,
              },
            ],
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({ hits: [], items: [] }),
      } as any;
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it("executes full ingestion -> clustering -> opportunity synthesis pipeline", async () => {
    const result = await executeIntelligencePipeline(mockAi);
    expect(result.sourcesScanned).toBe(10);
    expect(result.totalSignalsIngested).toBeGreaterThan(0);
    expect(result.problemSpacesDiscovered).toBeGreaterThan(0);
    expect(result.opportunitiesSynthesized.length).toBeGreaterThan(0);

    const firstOpp = result.opportunitiesSynthesized[0];
    expect(firstOpp).toBeDefined();
    if (!firstOpp) return;

    const dossier = generateVentureDossierMarkdown(firstOpp);
    expect(dossier).toContain("VENTURE BLUEPRINT");
    expect(dossier).toContain("Opportunity Score:");
    expect(dossier).toContain("Financial Modeling & Unit Economics");
  });
});
