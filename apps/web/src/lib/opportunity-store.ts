import { ClaimEvidenceLinkItem, PublicationQualityStatus } from "@buildworth/shared";
import { VERIFIED_FIXTURE_EVIDENCE } from "./fixtures";

export interface StoredOpportunity {
  slug: string;
  title: string;
  summary: string;
  industry: string;
  customerType: string;
  opportunityScore: number;
  confidenceScore: number;
  publicationQualityStatus: PublicationQualityStatus;
  isDemoFixture: boolean;
  costRange: { minMinor: number; maxMinor: number; currency: "USD" };
  timeToMvpWeeks: { min: number; max: number };
  buyer: string;
  signalsCount: number; // 0 for unverified hypotheses, computed for verified
  recommendedExperiment: string;
  jobsToBeDone?: string[];
  narrowMvpScope?: string[];
  existingWorkflow?: string;
  buyingTrigger?: string;
  competitors?: { name: string; weakness: string }[];
  dimensionBreakdown: {
    name: string;
    score: number;
    maxScore: number;
    explanation: string;
    isAssumption?: boolean;
  }[];
  publishedAt: string;
  evidenceLinks: ClaimEvidenceLinkItem[];
}

export const INITIAL_OPPORTUNITIES: StoredOpportunity[] = [
  {
    slug: "automated-soc2-evidence-collector",
    title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
    summary:
      "Eliminates quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 89,
    confidenceScore: 82,
    publicationQualityStatus: "VERIFIED",
    isDemoFixture: false,
    costRange: { minMinor: 500000, maxMinor: 1200000, currency: "USD" },
    timeToMvpWeeks: { min: 4, max: 8 },
    buyer: "VP of Engineering or Head of Security",
    signalsCount: 5,
    recommendedExperiment:
      "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo with a 14-day refund guarantee.",
    jobsToBeDone: [
      "Collect compliance screenshots and cryptographic logs automatically on every git merge",
      "Export structured audit-ready evidence packages for external auditors",
      "Alert security leads when unreviewed pull requests merge to production",
    ],
    narrowMvpScope: [
      "GitHub Action for PR approval signature verification",
      "Vercel deployment environment snapshot webhook",
      "Evidence dashboard with exportable PDF/ZIP audit bundles",
    ],
    existingWorkflow:
      "Manual screenshots of PR approvals and Vercel env configs stored in shared Google Drive folders.",
    buyingTrigger: "Upcoming annual SOC2 Type II audit deadline",
    competitors: [
      {
        name: "Vanta / Drata",
        weakness: "High price ($15k+/yr), complex setup, lacks native deep git-commit binding",
      },
      {
        name: "Manual Google Drive Folders",
        weakness: "High labor cost (40+ engineering hours per quarter), error-prone",
      },
    ],
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 14,
        maxScore: 15,
        explanation: "Documented recurring screenshot burden across multiple practitioner forums.",
      },
      {
        name: "Buyer Demand & WTP",
        score: 13,
        maxScore: 15,
        explanation:
          "Target buyers actively seeking and stating willingness to pay for point solution.",
      },
      {
        name: "Technical Feasibility",
        score: 15,
        maxScore: 15,
        explanation: "Standard GitHub Action + Vercel Webhook architecture.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 14,
        maxScore: 15,
        explanation: "Saves ~30 engineering hours ($2,000 value) per month.",
        isAssumption: true,
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Mandatory compliance requirements for enterprise B2B SaaS.",
      },
      {
        name: "Buyer Accessibility",
        score: 8,
        maxScore: 10,
        explanation: "Reachable via developer communities and professional networks.",
      },
      {
        name: "Competition & Differentiation",
        score: 8,
        maxScore: 10,
        explanation: "Incumbents focus on broad GRC rather than deep git-commit automation.",
      },
      {
        name: "Speed to Validation",
        score: 5,
        maxScore: 5,
        explanation: "Can be validated via concierge demo in under 14 days.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "High retention once embedded in CI pipeline.",
        isAssumption: true,
      },
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
    evidenceLinks: VERIFIED_FIXTURE_EVIDENCE,
  },
  {
    slug: "llm-prompt-regression-ci-interceptor",
    title: "LLM Prompt Regression & Token Cost Interceptor for CI/CD",
    summary:
      "Automated test harness in GitHub Actions that detects LLM output quality regressions and token surges before deployment.",
    industry: "AI Engineering & Ops",
    customerType: "B2B",
    opportunityScore: 78,
    confidenceScore: 0,
    publicationQualityStatus: "HYPOTHESIS",
    isDemoFixture: true,
    costRange: { minMinor: 350000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "Head of AI / VP of Engineering",
    signalsCount: 0,
    recommendedExperiment:
      "Publish open-source GitHub Action runner; capture waitlist for enterprise hosted benchmark dashboard.",
    jobsToBeDone: [
      "Catch prompt regressions and unexpected quality drops on every Git Pull Request",
      "Enforce token cost budgets during automated integration testing",
      "Generate synthetic benchmark datasets automatically from production edge cases",
    ],
    narrowMvpScope: [
      "GitHub Action action.yml test harness runner",
      "Automated evaluation diff against baseline golden dataset",
      "PR comment bot showing pass/fail status and cost delta",
    ],
    existingWorkflow:
      "Manual inspection of prompt changes with unexpected production accuracy drops.",
    buyingTrigger: "Recent production regression incident that damaged customer trust.",
    competitors: [
      {
        name: "LangSmith / Braintrust",
        weakness: "Complex cloud onboarding, lacks native 1-click GitHub Action PR blocker",
      },
      {
        name: "Manual Unit Tests",
        weakness: "Flaky non-deterministic evaluations without statistical scoring",
      },
    ],
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 12,
        maxScore: 15,
        explanation: "Assumption: Engineers need CI safeguards for prompt updates.",
        isAssumption: true,
      },
      {
        name: "Buyer Demand & WTP",
        score: 10,
        maxScore: 15,
        explanation: "Assumption: AI teams will allocate budget for deployment guardrails.",
        isAssumption: true,
      },
      {
        name: "Technical Feasibility",
        score: 14,
        maxScore: 15,
        explanation: "Standard GitHub Action container calling evaluation API.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 12,
        maxScore: 15,
        explanation: "Potential to prevent high-cost production outages.",
        isAssumption: true,
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Rapidly expanding developer tooling segment.",
      },
      {
        name: "Buyer Accessibility",
        score: 8,
        maxScore: 10,
        explanation: "Reachable via developer communities and AI practitioner groups.",
      },
      {
        name: "Competition & Differentiation",
        score: 8,
        maxScore: 10,
        explanation: "Lack of zero-config GitHub Action alternatives.",
      },
      {
        name: "Speed to Validation",
        score: 5,
        maxScore: 5,
        explanation: "Working MVP action can be distributed in 7 days.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "Regression test libraries create retention.",
        isAssumption: true,
      },
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    evidenceLinks: [],
  },
  {
    slug: "snowflake-runaway-query-circuit-breaker",
    title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
    summary:
      "Real-time query cost interception that prevents unexpected $10k+ warehouse budget blowouts.",
    industry: "Data Engineering & FinOps",
    customerType: "B2B",
    opportunityScore: 80,
    confidenceScore: 0,
    publicationQualityStatus: "HYPOTHESIS",
    isDemoFixture: true,
    costRange: { minMinor: 400000, maxMinor: 900000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 6 },
    buyer: "Head of Data",
    signalsCount: 0,
    recommendedExperiment:
      "Publish an open-source query watchdog script; capture waitlist for the hosted auto-canceler.",
    jobsToBeDone: [
      "Intercept queries exceeding execution thresholds before budget depletion",
      "Notify data leads in Slack with query attribution and cost forecasts",
      "Kill rogue dashboard runaway join queries automatically",
    ],
    narrowMvpScope: [
      "Snowflake REST API query monitor poller",
      "Configurable budget ceiling rules engine",
      "Slack interactive alert bot with 1-click cancel action",
    ],
    existingWorkflow: "End-of-month invoice review after budget has already been blown.",
    buyingTrigger: "Receiving an unexpected $10k+ cloud bill from CFO.",
    competitors: [
      {
        name: "Native Snowflake Resource Monitors",
        weakness: "Only suspend warehouses globally after credit depletion, disrupting all users",
      },
      {
        name: "Datadog Cloud Cost",
        weakness: "Post-facto monitoring, cannot proactively kill active rogue queries",
      },
    ],
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 13,
        maxScore: 15,
        explanation: "Assumption: Frequent budget spikes cause leadership friction.",
        isAssumption: true,
      },
      {
        name: "Buyer Demand & WTP",
        score: 11,
        maxScore: 15,
        explanation: "Assumption: Companies will purchase preventative budget insurance.",
        isAssumption: true,
      },
      {
        name: "Technical Feasibility",
        score: 14,
        maxScore: 15,
        explanation: "Requires Snowflake REST API & query log webhooks.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 13,
        maxScore: 15,
        explanation: "ROI upon preventing runaway queries.",
        isAssumption: true,
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Cloud data warehouse spending expanding rapidly.",
      },
      {
        name: "Buyer Accessibility",
        score: 8,
        maxScore: 10,
        explanation: "Active communities in data engineering forums.",
      },
      {
        name: "Competition & Differentiation",
        score: 8,
        maxScore: 10,
        explanation: "Native alerts have delay windows.",
      },
      {
        name: "Speed to Validation",
        score: 4,
        maxScore: 5,
        explanation: "Requires sandbox account for live demo.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "Historical query pattern intelligence.",
        isAssumption: true,
      },
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    evidenceLinks: [],
  },
  {
    slug: "postgres-pool-exhaustion-watchdog-nextjs",
    title: "Postgres Connection Pool Interceptor for Serverless Next.js",
    summary:
      "Prevents high-traffic database downtime on Neon / Supabase by multiplexing serverless edge connections and auto-throttling.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 76,
    confidenceScore: 0,
    publicationQualityStatus: "HYPOTHESIS",
    isDemoFixture: true,
    costRange: { minMinor: 300000, maxMinor: 650000, currency: "USD" },
    timeToMvpWeeks: { min: 2, max: 4 },
    buyer: "CTO / Lead Architect",
    signalsCount: 0,
    recommendedExperiment:
      "Deploy npm wrapper package with free 50k requests/mo tier; offer paid hosted failover pool.",
    jobsToBeDone: [
      "Queue surge connection spikes without throwing 500 database connection errors",
      "Provide connection telemetry and idle client reaper",
      "Gracefully degrade read-heavy endpoints to cached stale data during DB locks",
    ],
    narrowMvpScope: [
      "Lightweight Prisma / Drizzle middleware client",
      "Redis-backed token bucket request queue",
      "Slack incident alert integration",
    ],
    existingWorkflow:
      "Apps crashing during marketing launches because serverless lambdas exhaust max 100 Postgres connections.",
    buyingTrigger: "Major outage during a Product Hunt launch or paid ad campaign.",
    competitors: [
      { name: "PgBouncer", weakness: "Difficult to configure in serverless edge environments" },
      { name: "AWS RDS Proxy", weakness: "Expensive, slow to provision, AWS-locked" },
    ],
    dimensionBreakdown: [
      {
        name: "Pain Evidence",
        score: 12,
        maxScore: 15,
        explanation: "Assumption: Serverless connection pooling is a recurring friction point.",
        isAssumption: true,
      },
      {
        name: "Buyer Demand & WTP",
        score: 11,
        maxScore: 15,
        explanation: "Assumption: Founders will pay for zero downtime guarantees.",
        isAssumption: true,
      },
      {
        name: "Technical Feasibility",
        score: 15,
        maxScore: 15,
        explanation: "Standard serverless connection pooling pattern.",
      },
      {
        name: "Cost-Benefit Economics",
        score: 12,
        maxScore: 15,
        explanation: "Saves lost launch day customer conversions.",
        isAssumption: true,
      },
      {
        name: "Market Attractiveness",
        score: 9,
        maxScore: 10,
        explanation: "Growing adoption of Next.js and serverless DBs.",
      },
      {
        name: "Buyer Accessibility",
        score: 9,
        maxScore: 10,
        explanation: "Direct access via Next.js communities.",
      },
      {
        name: "Competition & Differentiation",
        score: 8,
        maxScore: 10,
        explanation: "Zero configuration drop-in client library.",
      },
      {
        name: "Speed to Validation",
        score: 4,
        maxScore: 5,
        explanation: "Can be validated with beta testers in 1 week.",
      },
      {
        name: "Defensibility",
        score: 4,
        maxScore: 5,
        explanation: "Framework query life-cycle integration.",
        isAssumption: true,
      },
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
    evidenceLinks: [],
  },
];

let dynamicOpportunities: StoredOpportunity[] = [...INITIAL_OPPORTUNITIES];

export function getAllStoredOpportunities(): StoredOpportunity[] {
  return dynamicOpportunities;
}

export function getStoredOpportunityBySlug(slug: string): StoredOpportunity | undefined {
  return dynamicOpportunities.find((o) => o.slug === slug) || INITIAL_OPPORTUNITIES[0];
}

export function addStoredOpportunity(opp: StoredOpportunity): void {
  const index = dynamicOpportunities.findIndex((o) => o.slug === opp.slug);
  if (index >= 0) {
    dynamicOpportunities[index] = opp;
  } else {
    dynamicOpportunities.unshift(opp);
  }
}
