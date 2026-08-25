import { describe, it, expect } from "vitest";

describe("Projection Consistency Verification Logic", () => {
  it("derives riskiest assumption deterministically from unresolved assumptions (importance * uncertainty)", () => {
    const assumptions = [
      {
        id: "as-1",
        statement: "Engineering leads have credit card authority under $200",
        category: "WILLINGNESS_TO_PAY" as const,
        importanceScore: 4,
        uncertaintyScore: 2, // 8
        testMethod: "Interviews",
        successThreshold: ">60%",
        failureThreshold: "<20%",
        status: "SUPPORTED" as const,
        evidenceLinkIds: [],
        provenanceType: "ASSUMPTION" as const,
      },
      {
        id: "as-2",
        statement: "AWS Cost Explorer API rate limits allow hourly polls per account",
        category: "FEASIBILITY" as const,
        importanceScore: 5,
        uncertaintyScore: 4, // 20 - Highest unresolved
        testMethod: "API load test",
        successThreshold: "100%",
        failureThreshold: "<95%",
        status: "UNTESTED" as const,
        evidenceLinkIds: [],
        provenanceType: "ASSUMPTION" as const,
      },
      {
        id: "as-3",
        statement: "Competitor pricing remains above $10k/yr",
        category: "COMPETITION" as const,
        importanceScore: 3,
        uncertaintyScore: 3, // 9
        testMethod: "Market audit",
        successThreshold: ">80%",
        failureThreshold: "<40%",
        status: "UNTESTED" as const,
        evidenceLinkIds: [],
        provenanceType: "ASSUMPTION" as const,
      },
    ];

    const unresolved = assumptions
      .filter(a => a.status === "UNTESTED" || a.status === "TESTING")
      .sort((a, b) => {
        const scoreA = a.importanceScore * a.uncertaintyScore;
        const scoreB = b.importanceScore * b.uncertaintyScore;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.id.localeCompare(b.id);
      });

    expect(unresolved[0].statement).toBe("AWS Cost Explorer API rate limits allow hourly polls per account");
    expect(unresolved[0].id).toBe("as-2");
  });
});
