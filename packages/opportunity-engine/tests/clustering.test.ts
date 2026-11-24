import { describe, it, expect } from "vitest";
import { clusterSignals } from "../src/clustering/cluster-manager.js";
import {
  formatMeaningfulTitle,
  resolveCompleteOpportunityTitle,
} from "../src/ingestion/manual-staging-ingestion.js";

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

  it("preserves full problemSummary in cluster.title without slicing at 60 chars", () => {
    const longProblem =
      "High token costs for Qwen4-Max versus cheaper open-weight alternatives with comparable benchmark performance";
    const clusters = clusterSignals(
      [
        {
          id: "sig-long-1",
          problemSummary: longProblem,
          vertical: "Software Engineering & DevOps",
          embedding: [0.8, 0.2],
        },
      ],
      0.75,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.title).toBe(longProblem);
  });
});

describe("Opportunity Headline Formatting & Recovery", () => {
  it("keeps complete single-sentence headlines intact without truncating at 60 or 75 chars", () => {
    const qwenHeadline =
      "High token costs for Qwen4-Max versus cheaper open-weight alternatives with comparable benchmark performance";
    const serverlessHeadline =
      "Unpredictable cost escalation and service suspension when traffic spikes occur on serverless hosting platforms";

    expect(formatMeaningfulTitle(qwenHeadline)).toBe(qwenHeadline);
    expect(formatMeaningfulTitle(serverlessHeadline)).toBe(serverlessHeadline);
  });

  it("repairs legacy 60-character truncated titles using problemStatement", () => {
    const truncatedQwen = "High token costs for Qwen4-Max versus cheaper open-weight al";
    const fullQwen =
      "High token costs for Qwen4-Max versus cheaper open-weight alternatives with comparable benchmark performance";

    expect(resolveCompleteOpportunityTitle(truncatedQwen, fullQwen)).toBe(fullQwen);

    const truncatedServerless = "Unpredictable cost escalation and service suspension when tr";
    const fullServerless =
      "Unpredictable cost escalation and service suspension when traffic spikes occur on serverless hosting platforms";

    expect(resolveCompleteOpportunityTitle(truncatedServerless, fullServerless)).toBe(
      fullServerless,
    );
  });

  it("preserves bespoke titles that are not truncated prefixes of problemStatement", () => {
    expect(
      resolveCompleteOpportunityTitle(
        "Snowflake Runaway Query Circuit Breaker",
        "Data platform leads suffer unexpected $10k+ warehouse budget spikes when unoptimized SQL queries run unnoticed.",
      ),
    ).toBe("Snowflake Runaway Query Circuit Breaker");
  });
});
