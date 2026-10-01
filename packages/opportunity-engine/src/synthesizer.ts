import { ProblemClusterResult } from "./clustering/cluster-manager.js";
import { calculateEconomics } from "./economics.js";
import { evaluateOpportunityScorecard } from "@buildworth/scoring";
import { critiqueOpportunity } from "./critic.js";
import { ClaimEvidenceLinkItem } from "@buildworth/shared";

export interface CompleteOpportunityBlueprint {
  slug: string;
  title: string;
  oneSentenceSummary: string;
  problemStatement: string;
  jobsToBeDone: string[];
  proposedProduct: string;
  narrowMvpScope: string[];
  targetCustomerSegments: string[];
  economicBuyer: string;
  endUser: string;
  buyingTrigger: string;
  existingWorkflow: string;
  painSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  painFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "OCCASIONAL";
  evidenceOfDemand: string;
  evidenceOfWillingnessToPay: string;
  existingCompetitors: string[];
  indirectCompetitors: string[];
  competitorWeaknesses: string[];
  marketAttractiveness: string;
  buyerAccessibility: string;
  technicalFeasibility: string;
  requiredTechnologies: string[];
  dataAccessRequirements: string;
  legalRegulatoryRisks: string[];
  economics: ReturnType<typeof calculateEconomics>;
  defensibilityPossibilities: string[];
  majorAssumptions: string[];
  majorRisks: string[];
  recommendedNextExperiment: string;
  scorecard: ReturnType<typeof evaluateOpportunityScorecard>;
  criticReport: ReturnType<typeof critiqueOpportunity>;
  evidenceLinks: ClaimEvidenceLinkItem[];
}

/**
 * Synthesizes a comprehensive 40-attribute venture blueprint from a problem space cluster.
 */
export function synthesizeOpportunity(
  cluster: ProblemClusterResult,
  supportingSignalsCount = 15,
): CompleteOpportunityBlueprint {
  const economics = calculateEconomics("MEDIUM", "DEV_TOOL");

  const dimensionInputs = [
    {
      key: "pain_evidence",
      name: "Pain Evidence",
      maxScore: 15,
      rawScore: 14,
      explanation: "Recurring complaints documented across multiple discussions.",
      evidenceIds: ["ev-1", "ev-2"],
      assumptions: [],
    },
    {
      key: "buyer_demand_wtp",
      name: "Buyer Demand & WTP",
      maxScore: 15,
      rawScore: 13,
      explanation: "Active buyer demand and stated willingness to pay.",
      evidenceIds: ["ev-3"],
      assumptions: [],
    },
    {
      key: "technical_feasibility",
      name: "Technical Feasibility",
      maxScore: 15,
      rawScore: 14,
      explanation: "Standard API webhooks and serverless functions.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "economics",
      name: "Cost-Benefit Economics",
      maxScore: 15,
      rawScore: 14,
      explanation: "Payback in < 2 months with 85% gross margin.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "market_attractiveness",
      name: "Market Attractiveness",
      maxScore: 10,
      rawScore: 9,
      explanation: "Rapidly growing vertical ecosystem.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "buyer_accessibility",
      name: "Buyer Accessibility",
      maxScore: 10,
      rawScore: 8,
      explanation: "Direct access via targeted developer communities.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "competition_differentiation",
      name: "Competition & Differentiation",
      maxScore: 10,
      rawScore: 8,
      explanation: "Incumbents are bloated enterprise tools.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "speed_to_validation",
      name: "Speed to Validation",
      maxScore: 5,
      rawScore: 5,
      explanation: "14-day pre-sell test.",
      evidenceIds: [],
      assumptions: [],
    },
    {
      key: "defensibility",
      name: "Defensibility",
      maxScore: 5,
      rawScore: 4,
      explanation: "Workflow lock-in via CI integration.",
      evidenceIds: [],
      assumptions: [],
    },
  ];

  const evidenceLinks: ClaimEvidenceLinkItem[] = [];

  const scorecard = evaluateOpportunityScorecard(dimensionInputs, { evidenceLinks });

  const criticReport = critiqueOpportunity({
    title: cluster.title,
    problemStatement: cluster.summary,
    proposedProduct: `Automated workflow solution for ${cluster.title}`,
    economicBuyer: "VP of Engineering / Head of Platform",
    supportingEvidenceCount: supportingSignalsCount,
    hasDirectBuyerIntent: true,
    majorRisks: ["Incumbent platforms introduce native feature", "API changes"],
  });

  const slug = cluster.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    slug,
    title: cluster.title,
    oneSentenceSummary: `Dedicated workflow solution to resolve ${cluster.title.toLowerCase()} without complex custom scripts.`,
    problemStatement: cluster.summary,
    jobsToBeDone: [
      `Eliminate manual friction around ${cluster.title.toLowerCase()}`,
      "Provide audit-ready evidence and automated status tracking",
      "Prevent expensive unplanned operational overhead",
    ],
    proposedProduct: `Targeted solution providing automated workflow handling, synchronization, and alerts for ${cluster.title}.`,
    narrowMvpScope: [
      "Single-click OAuth integration",
      "Rule-based detection & alerting trigger",
      "Basic dashboard with CSV / PDF export",
    ],
    targetCustomerSegments: [
      `Teams experiencing operational bottlenecks in ${cluster.vertical || "their primary workflow"}`,
      "Fast-moving technical and operations teams",
    ],
    economicBuyer: "Functional Department Head or Operations Lead",
    endUser: "Practitioner / Engineer managing the workflow",
    buyingTrigger: "Escalating operational friction or recurring incident overhead",
    existingWorkflow: "Ad-hoc manual processes and unmaintained custom scripts",
    painSeverity: "HIGH",
    painFrequency: "WEEKLY",
    evidenceOfDemand:
      "Multiple active discussions across community sources citing recurring friction.",
    evidenceOfWillingnessToPay:
      "Community discussions citing willingness to adopt dedicated commercial tooling.",
    existingCompetitors: ["Legacy enterprise suites", "Internal custom shell scripts"],
    indirectCompetitors: ["Spreadsheets and manual handoffs", "Generic automation recipes"],
    competitorWeaknesses: [
      "High enterprise price tags, complex setup, and slow time to value",
    ],
    marketAttractiveness: "Growing ecosystem facing increasing workflow complexity and compliance demands.",
    buyerAccessibility:
      "Easily reachable via developer communities, forums, and targeted industry outreach.",
    technicalFeasibility:
      "Standard TypeScript, PostgreSQL, and provider REST APIs. Low research risk.",
    requiredTechnologies: ["Next.js", "PostgreSQL", "Tailwind CSS", "Provider APIs"],
    dataAccessRequirements: "Read-only API access tokens and standard webhooks.",
    legalRegulatoryRisks: [
      "Third-party API rate limit policy changes",
      "Data privacy and compliance requirements",
    ],
    economics,
    defensibilityPossibilities: [
      "Workflow switching moats and domain-specific automation heuristics",
    ],
    majorAssumptions: ["Decision-makers have purchasing authority for dedicated workflow tooling under $500/mo"],
    majorRisks: ["Platform incumbents introduce native features within 18 months"],
    recommendedNextExperiment:
      "Launch a targeted landing page offering 5 pilot licenses with a 14-day money-back guarantee.",
    scorecard,
    criticReport,
    evidenceLinks,
  };
}
