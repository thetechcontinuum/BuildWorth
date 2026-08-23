import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    queueCount: 1,
    items: [
      {
        id: "rev-1",
        title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
        opportunityScore: 89,
        confidenceScore: 84,
        status: "PENDING_REVIEW",
      },
    ],
  });
}
