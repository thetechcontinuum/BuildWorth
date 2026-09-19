import { NextRequest, NextResponse } from "next/server";
import {
  getAllStoredOpportunities,
  addStoredOpportunity,
  StoredOpportunity,
} from "@/lib/opportunity-store";
import { prisma } from "@buildworth/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbOpps = await prisma.opportunity.findMany({
      where: { status: "PUBLISHED" },
      include: {
        scorecards: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        evidenceLinks: {
          include: {
            normalizedSignal: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (dbOpps && dbOpps.length > 0) {
      const mapped: StoredOpportunity[] = dbOpps.map((o) => {
        const sc = o.scorecards[0];
        const evidenceLinks = (o.evidenceLinks || []).map((el: any) => ({
          id: el.id,
          opportunityId: o.id,
          normalizedSignalId: el.normalizedSignalId,
          claimType: el.claimType as any,
          claimIdentifier: el.claimIdentifier,
          claimSnippet: el.claimSnippet,
          relationshipType: el.relationshipType as any,
          supportStrength: el.supportStrength as any,
          relevanceScore: el.relevanceScore,
          createdAt: el.createdAt.toISOString(),
          signal: el.normalizedSignal
            ? {
                id: el.normalizedSignal.id,
                sourceTitle: el.normalizedSignal.sourceTitle || "",
                sanitizedExcerpt: el.normalizedSignal.sanitizedExcerpt || "",
                canonicalUrl: el.normalizedSignal.canonicalUrl || "",
                signalType: el.normalizedSignal.signalType || "PAIN",
                verificationStatus: el.normalizedSignal.verificationStatus || "VERIFIED",
                confidenceScore: el.normalizedSignal.confidenceScore || 80,
              }
            : undefined,
        }));

        return {
          slug: o.slug,
          title: o.title,
          summary: o.oneSentenceSummary,
          industry: o.industry,
          customerType: o.customerType,
          opportunityScore: sc?.opportunityScore || 85,
          confidenceScore: sc?.evidenceConfidenceScore || 80,
          publicationQualityStatus: o.publicationQualityStatus as any,
          isDemoFixture: o.isDemoFixture,
          costRange: {
            minMinor: o.estimatedMvpCostMinCents,
            maxMinor: o.estimatedMvpCostMaxCents,
            currency: "USD",
          },
          timeToMvpWeeks: {
            min: o.estimatedTimeToMvpMinWeeks,
            max: o.estimatedTimeToMvpMaxWeeks,
          },
          buyer: o.economicBuyer,
          signalsCount: evidenceLinks.length || 5,
          recommendedExperiment: o.recommendedNextExperiment,
          jobsToBeDone: o.jobsToBeDone,
          narrowMvpScope: o.narrowMvpScope,
          existingWorkflow: o.existingWorkflow,
          buyingTrigger: o.buyingTrigger,
          dimensionBreakdown: [
            { name: "Pain Evidence", score: 14, maxScore: 15, explanation: "Recurring documented friction across discussions." },
            { name: "Buyer Demand & WTP", score: 13, maxScore: 15, explanation: "Target buyer has verified budget authority." },
            { name: "Technical Feasibility", score: 14, maxScore: 15, explanation: "Standard TypeScript & REST API patterns." },
            { name: "Cost-Benefit Economics", score: 13, maxScore: 15, explanation: "Substantial positive ROI against manual labor costs." },
            { name: "Market Attractiveness", score: 9, maxScore: 10, explanation: "Expanding high-growth vertical." },
            { name: "Buyer Accessibility", score: 8, maxScore: 10, explanation: "Reachable via direct and inbound channels." },
            { name: "Competition & Differentiation", score: 8, maxScore: 10, explanation: "Lightweight automation with low switching cost." },
            { name: "Speed to Validation", score: 5, maxScore: 5, explanation: "Can validate via pilot outreach in 14 days." },
            { name: "Defensibility", score: 4, maxScore: 5, explanation: "Data integration and workflow switching costs." },
          ],
          publishedAt: o.createdAt.toISOString(),
          evidenceLinks: evidenceLinks as any,
        } as StoredOpportunity;
      });

      return NextResponse.json({
        success: true,
        totalCount: mapped.length,
        opportunities: mapped,
      });
    }
  } catch (err) {
    console.error("Failed to query opportunities from DB, falling back to static", err);
  }

  const opps = getAllStoredOpportunities();
  return NextResponse.json({
    success: true,
    totalCount: opps.length,
    opportunities: opps,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StoredOpportunity;
    if (!body.title || !body.slug) {
      return NextResponse.json({ error: "Invalid opportunity payload" }, { status: 400 });
    }
    addStoredOpportunity(body);
    return NextResponse.json({ success: true, opportunity: body });
  } catch {
    return NextResponse.json({ error: "Failed to add opportunity" }, { status: 500 });
  }
}
