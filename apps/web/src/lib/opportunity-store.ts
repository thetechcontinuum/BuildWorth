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

export const INITIAL_OPPORTUNITIES: StoredOpportunity[] = [
  {
    slug: "llm-prompt-regression-ci-interceptor",
    title: "LLM Prompt Regression & Token Cost Interceptor for CI/CD",
    summary: "Automated test harness in GitHub Actions that detects LLM output quality regressions and token surges before deployment.",
    industry: "AI Engineering & Ops",
    customerType: "B2B",
    opportunityScore: 94,
    confidenceScore: 89,
    costRange: { minMinor: 350000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "Head of AI / VP of Engineering",
    signalsCount: 56,
    recommendedExperiment: "Publish open-source GitHub Action runner; capture waitlist for enterprise hosted benchmark dashboard.",
    jobsToBeDone: [
      "Catch prompt regressions and hallucinations on every Git Pull Request",
      "Enforce token cost budgets during automated integration testing",
      "Generate synthetic benchmark datasets automatically from production edge cases"
    ],
    narrowMvpScope: [
      "GitHub Action action.yml test harness runner",
      "Automated Agnes AI prompt diff evaluation",
      "PR comment bot showing pass/fail status and cost delta"
    ],
    existingWorkflow: "Manual inspection of prompt changes with unexpected production accuracy drops.",
    buyingTrigger: "Recent production hallucination incident that damaged customer trust.",
    competitors: [
      { name: "LangSmith / Braintrust", weakness: "Complex cloud onboarding, lacks native 1-click GitHub Action PR blocker" },
      { name: "Manual Unit Tests", weakness: "Flaky non-deterministic evaluations without statistical scoring" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 15, maxScore: 15, explanation: "Engineers terrified of pushing prompt updates without CI safeguards." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "AI teams readily paying $200-$400/mo for deployment guardrails." },
      { name: "Technical Feasibility", score: 15, maxScore: 15, explanation: "Standard GitHub Action container calling Agnes AI evaluation API." },
      { name: "Cost-Benefit Economics", score: 14, maxScore: 15, explanation: "Prevents high-cost production outages and bad rollouts." },
      { name: "Market Attractiveness", score: 10, maxScore: 10, explanation: "Fastest growing developer tooling segment in 2026." },
      { name: "Buyer Accessibility", score: 9, maxScore: 10, explanation: "Easily reachable via GitHub, Twitter/X, and AI Discord channels." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "No lightweight zero-config GitHub Action alternative." },
      { name: "Speed to Validation", score: 5, maxScore: 5, explanation: "Working MVP action can be distributed in 7 days." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Pre-built regression test library creates strong retention." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
  },
  {
    slug: "snowflake-runaway-query-circuit-breaker",
    title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
    summary: "Real-time query cost interception that prevents unexpected $10k+ warehouse budget blowouts.",
    industry: "Data Engineering & FinOps",
    customerType: "B2B",
    opportunityScore: 92,
    confidenceScore: 88,
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
    publishedAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString()
  },
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
    signalsCount: 38,
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
    publishedAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString()
  },
  {
    slug: "postgres-pool-exhaustion-watchdog-nextjs",
    title: "Postgres Connection Pool Interceptor for Serverless Next.js",
    summary: "Prevents high-traffic database downtime on Neon / Supabase by multiplexing serverless edge connections and auto-throttling.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 91,
    confidenceScore: 86,
    costRange: { minMinor: 300000, maxMinor: 650000, currency: "USD" },
    timeToMvpWeeks: { min: 2, max: 4 },
    buyer: "CTO / Lead Architect",
    signalsCount: 31,
    recommendedExperiment: "Deploy npm wrapper package with free 50k requests/mo tier; offer paid hosted failover pool.",
    jobsToBeDone: [
      "Queue surge connection spikes without throwing 500 database connection errors",
      "Provide connection telemetry and idle client reaper",
      "Gracefully degrade read-heavy endpoints to cached stale data during DB locks"
    ],
    narrowMvpScope: [
      "Lightweight Prisma / Drizzle middleware client",
      "Redis-backed token bucket request queue",
      "Slack incident alert integration"
    ],
    existingWorkflow: "Apps crashing during marketing launches because serverless lambdas exhaust max 100 Postgres connections.",
    buyingTrigger: "Major outage during a Product Hunt launch or paid ad campaign.",
    competitors: [
      { name: "PgBouncer", weakness: "Difficult to configure in serverless edge environments" },
      { name: "AWS RDS Proxy", weakness: "Expensive, slow to provision, AWS-locked" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 14, maxScore: 15, explanation: "Ubiquitous complaint in r/nextjs and Vercel GitHub discussions." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "Founders willing to pay $49-$199/mo to guarantee zero downtime." },
      { name: "Technical Feasibility", score: 15, maxScore: 15, explanation: "Standard serverless connection pooling pattern." },
      { name: "Cost-Benefit Economics", score: 14, maxScore: 15, explanation: "Saves thousands in lost launch day customer conversions." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Tens of thousands of companies adopting Next.js + serverless DBs." },
      { name: "Buyer Accessibility", score: 9, maxScore: 10, explanation: "Direct access via Next.js and Supabase Discord channels." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Zero configuration drop-in client library." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Can be validated with 10 beta testers in 1 week." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Deep integration with framework query life-cycles." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 14).toISOString()
  },
  {
    slug: "hubspot-stripe-invoice-reconciler",
    title: "HubSpot <> Stripe Invoice Reconciliation Watchdog",
    summary: "Resolves recurring invoice reconciliation mismatches between sales reps and finance without custom ERP code.",
    industry: "B2B SaaS RevOps",
    customerType: "B2B",
    opportunityScore: 85,
    confidenceScore: 74,
    costRange: { minMinor: 300000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "Director of RevOps",
    signalsCount: 22,
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
    publishedAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString()
  },
  {
    slug: "k8s-microservice-egress-cost-attributor",
    title: "Kubernetes Cross-AZ Egress Cost Attribution & Optimizer",
    summary: "Visualizes hidden AWS cross-AZ network transfer charges in Kubernetes clusters and auto-routes local traffic.",
    industry: "Data Engineering & FinOps",
    customerType: "B2B",
    opportunityScore: 90,
    confidenceScore: 83,
    costRange: { minMinor: 450000, maxMinor: 950000, currency: "USD" },
    timeToMvpWeeks: { min: 4, max: 7 },
    buyer: "Director of Infrastructure / FinOps Lead",
    signalsCount: 29,
    recommendedExperiment: "Offer a free 1-time egress cost audit script that generates an instant savings report.",
    jobsToBeDone: [
      "Break down AWS data transfer charges by microservice pod and namespace",
      "Apply Kubernetes Topology Aware Routing to prioritize same-zone traffic",
      "Alert platform teams when single services generate anomalous bandwidth fees"
    ],
    narrowMvpScope: [
      "DaemonSet eBPF network probe",
      "Cost calculation engine applying AWS AZ billing matrix",
      "Summary report dashboard with 1-click Topology Aware Hints enablement"
    ],
    existingWorkflow: "Opening a massive $25k monthly AWS bill and having no idea which engineering team caused it.",
    buyingTrigger: "CFO mandate to cut cloud infrastructure bills by 20%.",
    competitors: [
      { name: "Kubecost", weakness: "Complex enterprise pricing and heavy resource footprint" },
      { name: "AWS Cost Explorer", weakness: "Lacks pod-level granular network attribution" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 14, maxScore: 15, explanation: "Network transfer is the #1 surprise cost in cloud bills." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "Companies gladly pay 10% of their monthly savings ($500-$2k/mo)." },
      { name: "Technical Feasibility", score: 14, maxScore: 15, explanation: "Standard eBPF probe or Envoy access log parser." },
      { name: "Cost-Benefit Economics", score: 15, maxScore: 15, explanation: "Instantly pays for itself within 72 hours of installation." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Enterprise Kubernetes adoption continues to accelerate." },
      { name: "Buyer Accessibility", score: 8, maxScore: 10, explanation: "Targetable on Kubernetes Slack channels and DevOps meetups." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Laser-focused on zero-config network cost optimization." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Pilot test with 3 mid-market companies in 14 days." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Proprietary eBPF filtering rules and traffic telemetry." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 22).toISOString()
  },
  {
    slug: "hipaa-audit-log-vault-telehealth",
    title: "Cryptographic HIPAA Audit Log Vault for Telehealth Startups",
    summary: "Immutable tamper-proof event logging with 1-click auditor export for digital health apps.",
    industry: "DevOps & Compliance",
    customerType: "B2B",
    opportunityScore: 88,
    confidenceScore: 81,
    costRange: { minMinor: 400000, maxMinor: 850000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 6 },
    buyer: "Chief Information Security Officer (CISO)",
    signalsCount: 25,
    recommendedExperiment: "Pre-sell HIPAA compliance acceleration kit to 10 YC / Techstars healthtech founders.",
    jobsToBeDone: [
      "Record patient record access events with SHA-256 cryptographic signatures",
      "Maintain strict 6-year retention policy with automated cold storage archiving",
      "Generate instant HIPAA Security Rule § 164.312(b) audit reports"
    ],
    narrowMvpScope: [
      "Node.js / Python SDK for logging PHI access events",
      "WORM (Write Once Read Many) compliant AWS S3 storage backend",
      "Audit trail export UI for external healthcare compliance reviewers"
    ],
    existingWorkflow: "Writing unstructured logs to Datadog / CloudWatch that are wiped after 30 days.",
    buyingTrigger: "First enterprise hospital partnership or upcoming HIPAA audit.",
    competitors: [
      { name: "Generic CloudWatch / Datadog", weakness: "Not immutable, lacks compliance proof-of-authenticity packaging" },
      { name: "Enterprise SIEM (Splunk)", weakness: "Starting price >$25k/yr and massive overhead" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 14, maxScore: 15, explanation: "Telehealth founders dread failing partner compliance audits." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "Healthtech startups pay $299-$999/mo for compliance tools." },
      { name: "Technical Feasibility", score: 14, maxScore: 15, explanation: "Cryptographic hash chaining + S3 object lock." },
      { name: "Cost-Benefit Economics", score: 13, maxScore: 15, explanation: "Enables millions in enterprise health systems contracts." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Telehealth software market expanding at 18% CAGR." },
      { name: "Buyer Accessibility", score: 8, maxScore: 10, explanation: "Reachable via HealthTech founders communities." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Purpose-built for modern Next.js/FastAPI stacks." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Can be validated via security lead interviews in 10 days." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Regulatory compliance lock-in." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 26).toISOString()
  },
  {
    slug: "b2b-saas-churn-intent-radar-zendesk",
    title: "AI Churn Intent Early Warning Radar from Support Tickets",
    summary: "Scans Zendesk and Intercom tickets with Agnes AI to detect hidden cancellation signals 60 days before contract renewal.",
    industry: "AI Engineering & Ops",
    customerType: "B2B",
    opportunityScore: 92,
    confidenceScore: 85,
    costRange: { minMinor: 350000, maxMinor: 750000, currency: "USD" },
    timeToMvpWeeks: { min: 3, max: 5 },
    buyer: "VP of Customer Success / Chief Revenue Officer",
    signalsCount: 36,
    recommendedExperiment: "Run a free historical churn audit on 10 SaaS companies; show tickets that led to churned accounts.",
    jobsToBeDone: [
      "Identify subtle frustration, budget cut mentions, and executive turnover in support conversations",
      "Calculate health score drop probability and alert Customer Success managers in Slack",
      "Recommend proactive retention plays based on the exact unresolved feature complaints"
    ],
    narrowMvpScope: [
      "1-Click Zendesk & Intercom OAuth connector",
      "Agnes AI sentiment & churn intent classifier",
      "Weekly executive risk digest with revenue at risk metrics"
    ],
    existingWorkflow: "CSMs only find out a customer is leaving when they receive the formal cancellation notice.",
    buyingTrigger: "A major enterprise customer churns unexpectedly, missing annual ARR targets.",
    competitors: [
      { name: "Gainsight / ChurnZero", weakness: "Complex $30k/yr enterprise deployments requiring dedicated CS ops engineers" },
      { name: "Manual NPS Surveys", weakness: "Extremely low response rates (<5%), lagging indicator" }
    ],
    dimensionBreakdown: [
      { name: "Pain Evidence", score: 15, maxScore: 15, explanation: "Unexpected customer churn is the #1 threat to B2B SaaS valuations." },
      { name: "Buyer Demand & WTP", score: 14, maxScore: 15, explanation: "Saving a single $20k customer pays for years of subscription." },
      { name: "Technical Feasibility", score: 14, maxScore: 15, explanation: "Zendesk Webhook + Agnes AI batch processing." },
      { name: "Cost-Benefit Economics", score: 15, maxScore: 15, explanation: "Massive ROI by saving 2-5 accounts per quarter." },
      { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Every B2B subscription business obsesses over Net Revenue Retention." },
      { name: "Buyer Accessibility", score: 9, maxScore: 10, explanation: "Very active CS and CRO communities on LinkedIn and Slack." },
      { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Zero-config 5-minute setup vs 3-month enterprise onboardings." },
      { name: "Speed to Validation", score: 4, maxScore: 5, explanation: "Validated immediately by analyzing past churned ticket dumps." },
      { name: "Defensibility", score: 4, maxScore: 5, explanation: "Fine-tuned domain churn prediction models." }
    ],
    publishedAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString()
  }
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
