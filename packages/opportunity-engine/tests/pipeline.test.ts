import { describe, it, expect } from "vitest";
import { executeIntelligencePipeline } from "../src/pipeline.js";
import { generateVentureDossierMarkdown } from "../src/dossier.js";

describe("End-to-End Intelligence Pipeline", () => {
  it("executes full ingestion -> clustering -> opportunity synthesis pipeline", async () => {
    const result = await executeIntelligencePipeline();
    expect(result.sourcesScanned).toBe(4);
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
