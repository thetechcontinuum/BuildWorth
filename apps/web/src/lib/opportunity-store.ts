export interface StoredOpportunity {
  slug: string;
  title: string;
  summary: string;
  industry: string;
  customerType: string;
  opportunityScore: number;
  confidenceScore: number;
  costRange: { minMinor: number; maxMinor: number; currency: "USD" };
  timeToMvpWeeks: { min: number; max: number };
  buyer: string;
  signalsCount: number;
  recommendedExperiment: string;
  jobsToBeDone?: string[];
  narrowMvpScope?: string[];
  existingWorkflow?: string;
  buyingTrigger?: string;
  competitors?: { name: string; weakness: string }[];
  dimensionBreakdown: { name: string; score: number; maxScore: number; explanation: string }[];
  publishedAt: string;
}

const DEFAULT_OPPORTUNITIES: StoredOpportunity[] = [
  {
    slug: "automated-soc2-evidence-collector",
    title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
    summary: "Eliminates quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 89,
    confidenceScore: 84,
    costRange: { minMinor: 500000, maxMinor: 1200000, currency: "USD" },
    timeToMvpWeeks: { min: 4, max: 8 },
    buyer: "VP of Engineering",
    signalsCount: 28,
    recommendedExperiment: "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo with a 14-day refund guarantee.",
    jobsToBeDone: [
      "Collect compliance screenshots and cryptographic logs automatically on every git merge",
      "Export structured audit-ready evidence packages for external auditors",
      "Alert security leads when unreviewed pull requests merge to production"
    ],
    narrowMvpScope: [
      "GitHub Action for PR approval signature verification",
      "Vercel deployment environment snapshot webhook",
      "Evidence dashboard with exportable PDF/ZIP audit bundles"
    ],
    existingWorkflow: "Manual screenshots of PR approvals and Vercel env configs stored in shared Google Drive folders.",
    buyingTrigger: "Upcoming annual SOC2 Type II audit deadline",
    competitors: [
      { name: "Vanta / Drata", weakness: "High price ($15k+/yr), complex setup, lacks native deep git-commit binding" },
      { name: "Manual Google Drive Folders", weakness: "High labor cost (40+ engineering hours per quarter), error-prone" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 14, maxScore: 15, explanation: "Recurring 40hr/quarter screenshot burden documented across 3 platforms." },
      { name: "Buyer Demand & WTP", score: 13, maxScore: 15, explanation: "Target buyers already spending $15k/yr on incomplete audit suites." },
      { name: "Technical Feasibility", score: 15, maxScore: 15, explanation: "Standard GitHub Action + Vercel Webhook architecture." },
      { name: "Cost-Benefit Economics", score: 14, maxScore: 15, explanation: "Saves ~30 engineering hours ($2,000 value) per month." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Growing market driven by mandatory SOC2 compliance for B2B SaaS." },
      { name: "Buyer Accessibility", score: 8, maxScore: 10, explanation: "Reachable via developer communities and LinkedIn." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Incumbents like Vanta lack deep git-level automation." },
      { name: "Speed to Validation", score: 5, maxScore: 5, explanation: "Can be validated via concierge demo in under 14 days." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "High switching cost once embedded in CI pipeline." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
  },
  {
    slug: "finops-snowflake-anomaly-canceler",
    title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
    summary: "Real-time query cost interception that prevents unexpected $10k+ warehouse budget blowouts.",
    industry: "Data Engineering & FinOps",
    customerType: "B2B",
    opportunityScore: 92,
    confidenceScore: 78,
    costRange: { minMinor: 400000, maxMinor: 900000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 6 },
    buyer: "Head of Data",
    signalsCount: 42,
    recommendedExperiment: "Publish an open-source query watchdog script; capture waitlist for the hosted auto-canceler.",
    jobsToBeDone: [
      "Intercept queries exceeding execution thresholds before budget depletion",
      "Notify data leads in Slack with query attribution and cost forecasts",
      "Kill rogue dashboard runaway join queries automatically"
    ],
    narrowMvpScope: [
      "Snowflake REST API query monitor poller",
      "Configurable budget ceiling rules engine",
      "Slack interactive alert bot with 1-click cancel action"
    ],
    existingWorkflow: "End-of-month invoice review after budget has already been blown.",
    buyingTrigger: "Receiving an unexpected $10k+ cloud bill from CFO.",
    competitors: [
      { name: "Native Snowflake Resource Monitors", weakness: "Only suspend warehouses globally after credit depletion, disrupting all users" },
      { name: "Datadog Cloud Cost", weakness: "Post-facto monitoring, cannot proactively kill active rogue queries" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 15, maxScore: 15, explanation: "Frequent 5-figure budget spikes causing severe leadership friction." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "Companies happily pay $200-$500/mo insurance to prevent $10k mistakes." },
      { name: "Technical Feasibility", score: 14, maxScore: 15, explanation: "Requires Snowflake REST API & query log webhooks." },
      { name: "Cost-Benefit Economics", score: 15, maxScore: 15, explanation: "Instant ROI upon preventing first runaway query." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Cloud data warehouse spending expanding rapidly." },
      { name: "Buyer Accessibility", score: 8, maxScore: 10, explanation: "Active community in r/dataengineering and dbt Slack." },
      { name: "Competition & Differentiation", score: 9, maxScore: 10, explanation: "Native Snowflake alerts are delayed by up to 24 hours." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Requires sandbox account for live demo." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Historical query pattern intelligence and tuning heuristics." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString()
  },
  {
    slug: "hubspot-stripe-invoice-reconciler",
    title: "HubSpot <> Stripe Invoice Reconciliation Watchdog",
    summary: "Resolves recurring invoice reconciliation mismatches between sales reps and finance without custom ERP code.",
    industry: "B2B SaaS RevOps",
    customerType: "B2B",
    opportunityScore: 85,
    confidenceScore: 68,
    costRange: { minMinor: 300000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "Director of RevOps",
    signalsCount: 19,
    recommendedExperiment: "Cold outreach to 20 RevOps leads experiencing manual reconciliation friction with demo video.",
    jobsToBeDone: [
      "Automatically reconcile Stripe payouts with HubSpot deal revenue line items",
      "Highlight currency conversion discrepancies and failed churn retries",
      "Generate monthly audit CSV for Quickbooks/Xero import"
    ],
    narrowMvpScope: [
      "HubSpot CRM deal sync webhook",
      "Stripe payment intent state listener",
      "Discrepancy resolution dashboard"
    ],
    existingWorkflow: "Finance and sales arguing over end-of-month commission spreadsheets.",
    buyingTrigger: "Quarterly financial audit or board meeting revenue presentation.",
    competitors: [
      { name: "Zapier / Make", weakness: "Fragile webhooks without state reconciliation or idempotency guarantees" },
      { name: "Custom In-House Scripts", weakness: "Break frequently on API version updates" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 13, maxScore: 15, explanation: "End-of-month finance panic caused by CRM <> Stripe sync lags." },
      { name: "Buyer Demand & WTP", score: 13, maxScore: 15, explanation: "Standard RevOps software budget readily available." },
      { name: "Technical Feasibility", score: 15, maxScore: 15, explanation: "Standard OAuth connectors with Stripe & HubSpot." },
      { name: "Cost-Benefit Economics", score: 13, maxScore: 15, explanation: "Saves 15 hours of manual spreadsheet matching per month." },
      { name: "Market Attractiveness", score: 8, maxScore: 10, explanation: "Large pool of SaaS companies on HubSpot + Stripe stack." },
      { name: "Buyer Accessibility", score: 9, maxScore: 10, explanation: "Very active RevOps Slack and LinkedIn groups." },
      { name: "Competition & Differentiation", score: 7, maxScore: 10, explanation: "Generic iPaaS (Zapier) fails at deep state reconciliation." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Concierge manual audit test can be executed in 7 days." },
      { name: "Defensibility", score: 3, maxScore: 5, explanation: "Moderate switching friction." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
  }
];

let opportunitiesCache: StoredOpportunity[] = [...DEFAULT_OPPORTUNITIES];

export function getAllStoredOpportunities(): StoredOpportunity[] {
  return opportunitiesCache;
}

export function getStoredOpportunityBySlug(slug: string): StoredOpportunity | undefined {
  return opportunitiesCache.find((o) => o.slug === slug) || DEFAULT_OPPORTUNITIES[0];
}

export function addStoredOpportunity(opp: StoredOpportunity): void {
  const index = opportunitiesCache.findIndex((o) => o.slug === opp.slug);
  if (index >= 0) {
    opportunitiesCache[index] = opp;
  } else {
    opportunitiesCache.unshift(opp);
  }
}
