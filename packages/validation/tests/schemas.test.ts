import { describe, it, expect } from "vitest";
import { MoneyRangeSchema } from "../src/schemas/money.js";
import { OpportunityCreateSchema } from "../src/schemas/opportunity.js";

describe("Validation Schemas", () => {
  it("validates valid money range", () => {
    const valid = { minMinor: 1000, maxMinor: 5000, currency: "USD" };
    expect(MoneyRangeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid money range where max < min", () => {
    const invalid = { minMinor: 5000, maxMinor: 1000, currency: "USD" };
    expect(MoneyRangeSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates full opportunity create payload", () => {
    const payload = {
      title: "Automated SOC2 Evidence Collector for Vercel Monorepos",
      oneSentenceSummary:
        "Eliminate manual screenshot collection for SOC2 audits in modern Next.js deployments.",
      problemStatement:
        "DevOps engineers spend 40+ hours per quarter taking screenshots for compliance auditors.",
      jobsToBeDone: [
        "Collect compliance screenshots automatically",
        "Export audit-ready evidence packages",
      ],
      proposedProduct:
        "A lightweight GitHub Action and dashboard connecting git commits to compliance controls.",
      narrowMvpScope: ["GitHub Action for commit signing", "Basic evidence dashboard"],
      targetCustomerSegments: ["Series A SaaS startups", "DevOps teams"],
      economicBuyer: "VP of Engineering or Head of Security",
      endUser: "DevOps Engineer / Platform Engineer",
      buyingTrigger: "Upcoming annual SOC2 Type II audit deadline",
      existingWorkflow: "Manual screenshots stored in Google Drive folders",
      painSeverity: "HIGH",
      painFrequency: "MONTHLY",
      customerType: "B2B",
      industry: "DevOps / Security Compliance",
      estimatedMvpCost: { minMinor: 500000, maxMinor: 1200000, currency: "USD" },
      estimatedTimeToMvpWeeks: { min: 4, max: 8 },
      estimatedMonthlyOperatingCost: { minMinor: 15000, maxMinor: 40000, currency: "USD" },
      recommendedNextExperiment: "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo.",
      majorAssumptions: ["CTOs have budget for compliance tooling"],
      majorRisks: ["Incumbents like Vanta add native GitHub actions"],
    };
    const result = OpportunityCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
