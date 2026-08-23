import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const industry = searchParams.get("industry") || "ALL";

  return NextResponse.json({
    status: "ok",
    query: q,
    industry,
    totalCount: 3,
    opportunities: [
      {
        slug: "automated-soc2-evidence-collector",
        title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
        opportunityScore: 89,
        confidenceScore: 84,
        industry: "DevOps & Compliance",
        economicBuyer: "VP of Engineering",
      },
      {
        slug: "finops-snowflake-anomaly-canceler",
        title: "Snowflake Runaway Query Circuit Breaker for Data Teams",
        opportunityScore: 92,
        confidenceScore: 78,
        industry: "Data Engineering & FinOps",
        economicBuyer: "Head of Data",
      },
      {
        slug: "hubspot-stripe-invoice-reconciler",
        title: "HubSpot <> Stripe Invoice Reconciliation Watchdog",
        opportunityScore: 85,
        confidenceScore: 68,
        industry: "B2B SaaS RevOps",
        economicBuyer: "Director of RevOps",
      },
    ],
  });
}
