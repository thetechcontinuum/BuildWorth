import { MoneyRange } from "@buildworth/shared";

export interface EconomicModelResult {
  estimatedMvpCost: MoneyRange;
  estimatedTimeToMvpWeeks: { min: number; max: number };
  estimatedMonthlyOperatingCost: MoneyRange;
  plausibleMonthlyPriceRange: MoneyRange;
  estimatedCustomerHoursSavedMonthly: number;
  estimatedCustomerValueCreatedMonthlyCents: number;
  breakEvenCustomerCount: { min: number; max: number };
  grossMarginPercent: number;
}

/**
 * Calculates conservative unit economics, payback, and break-even scenarios.
 */
export function calculateEconomics(
  complexityLevel: "LOW" | "MEDIUM" | "HIGH",
  targetAudience: "DEV_TOOL" | "B2B_SAAS_OPS" | "ENTERPRISE_COMPLIANCE",
): EconomicModelResult {
  let mvpCostMin = 400000; // $4,000
  let mvpCostMax = 800000; // $8,000
  let weeksMin = 3;
  let weeksMax = 6;
  let opCostMin = 15000; // $150/mo
  let opCostMax = 35000; // $350/mo
  let priceMin = 4900; // $49/mo
  let priceMax = 19900; // $199/mo
  let hoursSaved = 20;

  if (complexityLevel === "MEDIUM") {
    mvpCostMin = 600000;
    mvpCostMax = 1200000;
    weeksMin = 4;
    weeksMax = 8;
    opCostMin = 25000;
    opCostMax = 60000;
    priceMin = 9900;
    priceMax = 39900;
    hoursSaved = 35;
  } else if (complexityLevel === "HIGH") {
    mvpCostMin = 1200000;
    mvpCostMax = 2500000;
    weeksMin = 8;
    weeksMax = 14;
    opCostMin = 50000;
    opCostMax = 150000;
    priceMin = 29900;
    priceMax = 99900;
    hoursSaved = 60;
  }

  if (targetAudience === "ENTERPRISE_COMPLIANCE") {
    priceMin = Math.round(priceMin * 1.5);
    priceMax = Math.round(priceMax * 2.0);
  }

  // Value created: assume $65/hr skilled labor rate
  const valueCreatedCents = hoursSaved * 65 * 100;

  // Break-even customer count based on monthly operating cost + 12-month MVP amortization
  const monthlyAmortizedMvp = (mvpCostMin + mvpCostMax) / 2 / 12;
  const avgMonthlyOpCost = (opCostMin + opCostMax) / 2;
  const totalMonthlyBurden = monthlyAmortizedMvp + avgMonthlyOpCost;

  const breakEvenMin = Math.ceil(totalMonthlyBurden / priceMax);
  const breakEvenMax = Math.ceil(totalMonthlyBurden / priceMin);

  return {
    estimatedMvpCost: { minMinor: mvpCostMin, maxMinor: mvpCostMax, currency: "USD" },
    estimatedTimeToMvpWeeks: { min: weeksMin, max: weeksMax },
    estimatedMonthlyOperatingCost: { minMinor: opCostMin, maxMinor: opCostMax, currency: "USD" },
    plausibleMonthlyPriceRange: { minMinor: priceMin, maxMinor: priceMax, currency: "USD" },
    estimatedCustomerHoursSavedMonthly: hoursSaved,
    estimatedCustomerValueCreatedMonthlyCents: valueCreatedCents,
    breakEvenCustomerCount: { min: breakEvenMin, max: breakEvenMax },
    grossMarginPercent: 85,
  };
}

export interface OpportunityEconomicsContext {
  title?: string | null;
  problemStatement?: string | null;
  proposedProduct?: string | null;
  vertical?: string | null;
  supportingSignalsCount?: number;
}

function stableTextHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Derives realistic, problem-specific MVP cost and timeline estimates
 * across 6 complexity tiers instead of defaulting every opportunity to MEDIUM.
 */
export function deriveOpportunityEconomics(
  context: OpportunityEconomicsContext,
): EconomicModelResult {
  // Classify strictly on problem description & proposed solution, not coarse vertical labels
  // like "DevOps & Compliance" or "Data Engineering & FinOps" which would otherwise match Tier 6/3 for everything.
  const text = `${context.title || ""} ${context.problemStatement || ""} ${context.proposedProduct || ""}`;
  const hash = stableTextHash((context.title || text).toLowerCase().trim() || "opportunity");
  const hashOffsetCents = (hash % 4) * 50000; // $0 to $1,500 variation within tier
  const hashWeekOffset = hash % 2; // 0 or 1 week variation within tier

  let mvpCostMin: number;
  let mvpCostMax: number;
  let weeksMin: number;
  let weeksMax: number;
  let opCostMin: number;
  let opCostMax: number;
  let priceMin: number;
  let priceMax: number;
  let hoursSaved: number;

  if (/\b(security|defender|bot attack|firewall|zero trust|soc2|compliance|audit|iam|cve|vulnerability|ransomware|procurement|tender|encryption)\b/i.test(text)) {
    // Tier 6 — Enterprise Security, Bot Defense, Endpoint Protection, & Compliance
    mvpCostMin = 1350000 + hashOffsetCents;
    mvpCostMax = 2500000 + hashOffsetCents;
    weeksMin = 7;
    weeksMax = 11 + hashWeekOffset;
    opCostMin = 50000;
    opCostMax = 140000;
    priceMin = 29900;
    priceMax = 99900;
    hoursSaved = 55;
  } else if (/\b(kubernetes|k8s|pod|cgroup|cpu limit|datadog|opentelemetry|prometheus|observability|cardinality|cluster|gpu|vllm|cuda|accelerator|bandwidth)\b/i.test(text)) {
    // Tier 5 — Kubernetes / Container Runtime / Observability & GPU Infrastructure
    mvpCostMin = 1000000 + hashOffsetCents;
    mvpCostMax = 1900000 + hashOffsetCents;
    weeksMin = 6;
    weeksMax = 9 + hashWeekOffset;
    opCostMin = 45000;
    opCostMax = 110000;
    priceMin = 19900;
    priceMax = 69900;
    hoursSaved = 48;
  } else if (/\b(postgres|postgresql|clickhouse|snowflake|kafka|database|sql|query|connection pool|consumer lag|vector database|memory leak|oom|out of memory)\b/i.test(text)) {
    // Tier 4 — Database, Streaming, & Query / Memory Telemetry
    mvpCostMin = 800000 + hashOffsetCents;
    mvpCostMax = 1550000 + hashOffsetCents;
    weeksMin = 5;
    weeksMax = 8 + hashWeekOffset;
    opCostMin = 35000;
    opCostMax = 85000;
    priceMin = 14900;
    priceMax = 49900;
    hoursSaved = 40;
  } else if (/\b(terraform|state lock|argocd|github actions|ci\/cd|finops|billing|cost spike|cloud cost|cost escalation|lambda|serverless|egress|non-renewal)\b/i.test(text)) {
    // Tier 3 — CI/CD, GitOps, & Cloud FinOps / Billing Automation
    mvpCostMin = 550000 + hashOffsetCents;
    mvpCostMax = 1050000 + hashOffsetCents;
    weeksMin = 3 + hashWeekOffset;
    weeksMax = 6 + hashWeekOffset;
    opCostMin = 25000;
    opCostMax = 60000;
    priceMin = 9900;
    priceMax = 34900;
    hoursSaved = 32;
  } else if (
    /\b(cli|linter|pre-commit|git hook|vscode|ide|sdk|shim|crashpad|minidump|compaction|context window|compiler|incremental compilation|rust|opengl|test runner|harness)\b/i.test(text) ||
    /(?:^|[^a-z0-9])c\+\+(?:$|[^a-z0-9])/i.test(text)
  ) {
    // Tier 1 — Lightweight CLI / Linter / SDK Shim / Compiler / Desktop Guardrail
    mvpCostMin = 250000 + hashOffsetCents;
    mvpCostMax = 500000 + hashOffsetCents;
    weeksMin = 2;
    weeksMax = 3 + hashWeekOffset;
    opCostMin = 8000;
    opCostMax = 20000;
    priceMin = 2900;
    priceMax = 9900;
    hoursSaved = 15;
  } else if (/\b(llm|token cost|qwen|claude|openai|prompt|rag|hallucination|agent|eval|embedding|inference|serving cost|classification ml)\b/i.test(text)) {
    // Tier 2 — AI / LLM Token Routing, Prompt Evaluation, & Agent Guardrails
    mvpCostMin = 450000 + hashOffsetCents;
    mvpCostMax = 850000 + hashOffsetCents;
    weeksMin = 3;
    weeksMax = 5 + hashWeekOffset;
    opCostMin = 20000;
    opCostMax = 50000;
    priceMin = 7900;
    priceMax = 24900;
    hoursSaved = 28;
  } else {
    // Default fallback
    mvpCostMin = 500000 + hashOffsetCents;
    mvpCostMax = 950000 + hashOffsetCents * 2;
    weeksMin = 3 + hashWeekOffset;
    weeksMax = 6 + hashWeekOffset;
    opCostMin = 20000;
    opCostMax = 50000;
    priceMin = 7900;
    priceMax = 24900;
    hoursSaved = 25;
  }

  const valueCreatedCents = hoursSaved * 65 * 100;
  const monthlyAmortizedMvp = (mvpCostMin + mvpCostMax) / 2 / 12;
  const avgMonthlyOpCost = (opCostMin + opCostMax) / 2;
  const totalMonthlyBurden = monthlyAmortizedMvp + avgMonthlyOpCost;

  const breakEvenMin = Math.ceil(totalMonthlyBurden / priceMax);
  const breakEvenMax = Math.ceil(totalMonthlyBurden / priceMin);

  return {
    estimatedMvpCost: { minMinor: mvpCostMin, maxMinor: mvpCostMax, currency: "USD" },
    estimatedTimeToMvpWeeks: { min: weeksMin, max: weeksMax },
    estimatedMonthlyOperatingCost: { minMinor: opCostMin, maxMinor: opCostMax, currency: "USD" },
    plausibleMonthlyPriceRange: { minMinor: priceMin, maxMinor: priceMax, currency: "USD" },
    estimatedCustomerHoursSavedMonthly: hoursSaved,
    estimatedCustomerValueCreatedMonthlyCents: valueCreatedCents,
    breakEvenCustomerCount: { min: breakEvenMin, max: breakEvenMax },
    grossMarginPercent: 85,
  };
}
