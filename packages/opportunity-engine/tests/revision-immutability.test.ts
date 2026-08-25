import { describe, it, expect } from "vitest";
import { computeBlueprintInputHash } from "../src/revision/revision-service.js";

describe("Revision Immutability & Input Hashing Tests", () => {
  const sampleInput = {
    opportunityId: "opp-123",
    reasonForChange: "Initial revision",
    customerSegments: [
      {
        id: "seg-1",
        segmentName: "Series A Tech Teams",
        industry: "DevOps",
        companySizeRange: "20-100",
        geography: "Global",
        businessModel: "B2B SaaS",
        endUserRole: "DevOps Lead",
        economicBuyerRole: "VP of Engineering",
        procurementComplexity: "Low",
        budgetCategory: "Dev Tools",
        spendingBehavior: "Credit Card",
        buyingTrigger: "SOC2 Audit",
        primaryObjection: "Security concern",
        acquisitionChannels: ["HN", "Reddit"],
        salesCycleMinDays: 14,
        salesCycleMaxDays: 30,
        salesMotion: "FOUNDER_LED" as const,
        confidenceScore: 85,
        provenanceType: "VERIFIED_EVIDENCE_BACKED" as const,
        evidenceLinkIds: ["ev-1"],
      },
    ],
    mvpFeatures: [],
    competitors: [],
    scenarios: [
      {
        scenarioType: "BASE" as const,
        currency: "USD",
        activeCustomers: 25,
        monthlyPriceCents: 19900,
        onboardingPriceCents: 0,
        variableCostPerCustomerCents: 1500,
        monthlyFixedCostCents: 150000,
        customerAcquisitionCostCents: 30000,
        deliveryTimeWeeks: 4,
      },
    ],
    costs: [],
    benefits: [],
    risks: [
      {
        id: "risk-1",
        category: "COMPETITION" as const,
        description: "Incumbents release lightweight feature",
        probabilityScore: 2,
        impactScore: 3,
        severity: "MEDIUM" as const,
        mitigationStrategy: "Focus on deep Git monorepo integration",
        status: "IDENTIFIED" as const,
        evidenceLinkIds: [],
        provenanceType: "MODEL_ESTIMATE" as const,
      },
    ],
    assumptions: [
      {
        id: "as-1",
        statement: "Engineering leads have credit card approval limits of $200/mo",
        category: "WILLINGNESS_TO_PAY" as const,
        importanceScore: 4,
        uncertaintyScore: 2,
        testMethod: "Interviews",
        successThreshold: ">60%",
        failureThreshold: "<20%",
        status: "UNTESTED" as const,
        evidenceLinkIds: [],
        provenanceType: "ASSUMPTION" as const,
      },
    ],
    experiments: [],
    opportunityScore: 88,
    evidenceConfidence: 82,
    criticalClaimsCovered: 4,
    costSummary: {
      minBuildMinorCents: 400000,
      maxBuildMinorCents: 800000,
      minWeeks: 3,
      maxWeeks: 6,
      minMonthlyOpMinorCents: 15000,
      maxMonthlyOpMinorCents: 40000,
    },
  };

  it("produces deterministic identical hashes for identical semantic inputs", () => {
    const hash1 = computeBlueprintInputHash(sampleInput);
    const hash2 = computeBlueprintInputHash({ ...sampleInput });
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes when critical financial inputs change", () => {
    const hash1 = computeBlueprintInputHash(sampleInput);
    const modifiedInput = {
      ...sampleInput,
      scenarios: [
        {
          ...sampleInput.scenarios[0],
          monthlyPriceCents: 29900, // Price changed
        },
      ],
    };
    const hash2 = computeBlueprintInputHash(modifiedInput);
    expect(hash1).not.toBe(hash2);
  });
});
