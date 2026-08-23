import { describe, it, expect } from "vitest";
import { synthesizeOpportunity } from "../src/synthesizer.js";

describe("Opportunity Synthesizer", () => {
  it("generates full 40-attribute venture blueprint", () => {
    const cluster = {
      clusterId: "cluster-1",
      title: "Snowflake Runaway Query Circuit Breaker",
      summary:
        "Data platform leads suffer unexpected $10k+ warehouse budget spikes when unoptimized SQL queries run unnoticed.",
      vertical: "Data Engineering",
      signalIds: ["sig-1", "sig-2"],
      centroid: [0.9, 0.1],
    };

    const opp = synthesizeOpportunity(cluster, 12);
    expect(opp.title).toBe(cluster.title);
    expect(opp.jobsToBeDone.length).toBeGreaterThanOrEqual(1);
    expect(opp.narrowMvpScope.length).toBeGreaterThanOrEqual(1);
    expect(opp.scorecard.opportunityScore).toBeGreaterThanOrEqual(70);
    expect(opp.criticReport).toBeDefined();
    expect(opp.economics.estimatedMvpCost.minMinor).toBeDefined();
  });
});
