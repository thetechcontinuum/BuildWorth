import { describe, it, expect } from "vitest";
import { calculateBenchmarkReport } from "../src/evaluation/benchmark.js";

describe("Evaluation Benchmark Engine", () => {
  it("blocks automatic publishing if evaluation sample size is insufficient", () => {
    const report = calculateBenchmarkReport({
      totalEvaluated: 30, // < 50
      unsupportedClaimsCount: 0,
      validBuyerDefinitionsCount: 30,
      scoreDeviationSum: 10,
      relevantEvidenceCount: 60,
      totalEvidenceCount: 60,
      duplicateOpportunityCount: 0,
    });
    expect(report.isAutoPublishPermitted).toBe(false);
    expect(report.blockers[0]).toContain("Evaluation sample size too small");
  });

  it("approves auto-publish when 100 sample opportunities meet all quality thresholds", () => {
    const report = calculateBenchmarkReport({
      totalEvaluated: 100,
      unsupportedClaimsCount: 1, // 1% (< 2%)
      validBuyerDefinitionsCount: 98, // 98% (> 95%)
      scoreDeviationSum: 250, // 2.5 pts (< 5.0 pts)
      relevantEvidenceCount: 285, // 95% (> 90%)
      totalEvidenceCount: 300,
      duplicateOpportunityCount: 0, // 0% (< 1%)
    });
    expect(report.isAutoPublishPermitted).toBe(true);
    expect(report.blockers.length).toBe(0);
  });
});
