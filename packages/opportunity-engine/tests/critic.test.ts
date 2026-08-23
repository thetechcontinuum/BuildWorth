import { describe, it, expect } from "vitest";
import { critiqueOpportunity } from "../src/critic.js";

describe("Adversarial Critic", () => {
  it("flags opportunities with insufficient evidence sources", () => {
    const opp = {
      title: "Random Idea",
      problemStatement: "Problem description",
      proposedProduct: "Solution",
      economicBuyer: "VP of Engineering",
      supportingEvidenceCount: 1, // only 1 signal
      hasDirectBuyerIntent: false,
      majorRisks: ["Risk 1"],
    };

    const review = critiqueOpportunity(opp);
    expect(review.isApproved).toBe(false);
    expect(review.unsupportedClaims.length).toBeGreaterThan(0);
    expect(review.scoreAdjustment).toBeLessThan(0);
  });

  it("approves well-supported opportunities with specific buyers", () => {
    const opp = {
      title: "Automated SOC2 Collector",
      problemStatement: "Detailed problem",
      proposedProduct: "Solution",
      economicBuyer: "VP of Engineering",
      supportingEvidenceCount: 15,
      hasDirectBuyerIntent: true,
      majorRisks: ["Risk 1"],
    };

    const review = critiqueOpportunity(opp);
    expect(review.isApproved).toBe(true);
    expect(review.unsupportedClaims.length).toBe(0);
  });
});
