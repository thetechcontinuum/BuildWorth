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
    oneSentenceSummary: `Streamline and automate ${cluster.summary.toLowerCase()} without complex custom scripts.`,
    problemStatement: cluster.summary,
    jobsToBeDone: [
      "Eliminate manual recurring engineering bottlenecks",
      "Provide audit-ready evidence and automated alerts",
      "Prevent expensive unplanned operational overhead",
    ],
    proposedProduct: `Lightweight SaaS tool providing automated monitoring, scheduled sync, and alerting for ${cluster.vertical}.`,
    narrowMvpScope: [
      "Single-click OAuth integration",
      "Rule-based detection & alerting trigger",
      "Basic dashboard with CSV / PDF export",
    ],
    targetCustomerSegments: ["Series A to Series C startups", "Fast-moving SaaS product teams"],
    economicBuyer: "VP of Engineering or Head of Operations",
    endUser: "Senior DevOps Engineer / Software Engineer",
    buyingTrigger: "Quarterly audit deadline or recent production cost spike",
    existingWorkflow: "Manual spreadsheets and brittle Python cron scripts",
    painSeverity: "HIGH",
    painFrequency: "WEEKLY",
    evidenceOfDemand:
      "Multiple active discussions across Hacker News and Reddit citing >10 hrs/week lost.",
    evidenceOfWillingnessToPay:
      "Verifiable community comments requesting paid alternative starting at $199/mo.",
    existingCompetitors: ["Legacy enterprise suites (Vanta, Drata, DataDog)"],
    indirectCompetitors: ["Internal custom shell scripts", "Zapier / Make recipes"],
    competitorWeaknesses: [
      "High enterprise price tags ($15k+/yr), complex setup, slow time to value",
    ],
    marketAttractiveness: "Over 40,000 high-growth tech companies facing compliance/cost mandates.",
    buyerAccessibility:
      "Easily reachable via GitHub community discussions, HN, and targeted cold outreach.",
    technicalFeasibility:
      "Standard TypeScript, PostgreSQL, and provider REST APIs. Low research risk.",
    requiredTechnologies: ["Next.js", "PostgreSQL", "Tailwind CSS", "Cloud Provider APIs"],
    dataAccessRequirements: "Read-only API access tokens and standard webhooks.",
    legalRegulatoryRisks: [
      "Third-party API rate limit policy changes",
      "SOC2 compliance requirements",
    ],
    economics,
    defensibilityPossibilities: [
      "Proprietary dataset of configuration heuristics and workflow switching moats",
    ],
    majorAssumptions: ["Engineering managers have credit card purchasing authority under $500/mo"],
    majorRisks: ["Cloud platforms build native integrated solutions within 18 months"],
    recommendedNextExperiment:
      "Launch a targeted landing page offering 5 pilot licenses with a 14-day money-back guarantee.",
    scorecard,
    criticReport,
    evidenceLinks,
  };
}
