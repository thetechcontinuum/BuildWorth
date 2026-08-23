import { describe, it, expect } from "vitest";
import { clusterSignals } from "../src/clustering/cluster-manager.js";

describe("Problem Space Clustering", () => {
  it("clusters similar signals together within same vertical", () => {
    const candidates = [
      {
        id: "sig-1",
        problemSummary: "Snowflake cost alerts",
        vertical: "FinOps",
        embedding: [0.9, 0.1],
      },
      {
        id: "sig-2",
        problemSummary: "Snowflake query runaway blocker",
        vertical: "FinOps",
        embedding: [0.91, 0.09],
      },
      {
        id: "sig-3",
        problemSummary: "SOC2 git commit compliance",
        vertical: "Security",
        embedding: [0.1, 0.9],
      },
    ];

    const clusters = clusterSignals(candidates, 0.85);
    expect(clusters.length).toBe(2);
    const finopsCluster = clusters.find((c) => c.vertical === "FinOps");
    expect(finopsCluster?.signalIds.length).toBe(2);
  });
});
