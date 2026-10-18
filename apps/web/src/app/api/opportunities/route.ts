import { NextRequest, NextResponse } from "next/server";
import {
  addStoredOpportunity,
  StoredOpportunity,
} from "@/lib/opportunity-store";
import { prisma } from "@buildworth/database";
import { evaluateSolutionFeasibility, isSingleRepoTicket, isProductAnnouncement } from "@buildworth/opportunity-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbOpps = await prisma.opportunity.findMany({
      where: {
        isDemoFixture: false,
        status: "PUBLISHED",
        publicationQualityStatus: { in: ["VERIFIED", "HYPOTHESIS"] },
      },
      include: {
        scorecards: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        revisions: {
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        evidenceLinks: {
          include: {
            normalizedSignal: {
              include: {
                rawSignal: {
                  include: { source: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const validOpps = (dbOpps || []).filter((o) => {
      const combined = `${o.slug || ""} ${o.title || ""} ${o.problemStatement || ""}`;
      if (/vague-question-about|^vague question about|without industry context/i.test(combined)) {
        return false;
      }
      const feasibility = evaluateSolutionFeasibility(o.problemStatement || o.title);
      if (!feasibility.isFeasible) {
        return false;
      }
      const primaryUrl = o.evidenceLinks?.[0]?.normalizedSignal?.canonicalUrl || o.evidenceLinks?.[0]?.normalizedSignal?.rawSignal?.sourceUrl;
      const hasSingleRepoSignal = (o.evidenceLinks || []).some((el: any) => {
        const su = el.normalizedSignal?.canonicalUrl || el.normalizedSignal?.rawSignal?.sourceUrl || "";
        const st = `${el.normalizedSignal?.sourceTitle || el.normalizedSignal?.rawSignal?.title || ""} ${el.normalizedSignal?.sanitizedExcerpt || ""}`;
        return isSingleRepoTicket(su, st);
      });
      const isSingleRepo = isSingleRepoTicket(primaryUrl, combined) || hasSingleRepoSignal;

      const hasAnnouncementSignal = (o.evidenceLinks || []).some((el: any) => {
        const st = el.normalizedSignal?.sourceTitle || el.normalizedSignal?.rawSignal?.title || "";
        const se = el.normalizedSignal?.sanitizedExcerpt || el.normalizedSignal?.rawSignal?.rawContent || "";
        const su = el.normalizedSignal?.canonicalUrl || el.normalizedSignal?.rawSignal?.sourceUrl || "";
        const sk = el.normalizedSignal?.rawSignal?.source?.key || "";
        return isProductAnnouncement(st, se, su, sk);
      });
      const isAnnouncement = isProductAnnouncement(o.title, o.problemStatement, primaryUrl) || hasAnnouncementSignal;

      const independentSignals = (o.evidenceLinks || []).filter((el: any) => {
        const st = el.normalizedSignal?.sourceTitle || el.normalizedSignal?.rawSignal?.title || "";
        const se = el.normalizedSignal?.sanitizedExcerpt || el.normalizedSignal?.rawSignal?.rawContent || "";
        const su = el.normalizedSignal?.canonicalUrl || el.normalizedSignal?.rawSignal?.sourceUrl || "";
        const sk = el.normalizedSignal?.rawSignal?.source?.key || "";
        if (isProductAnnouncement(st, se, su, sk)) return false;
        if (isSingleRepoTicket(su, `${st} ${se}`)) return false;
        return true;
      });

      if ((isSingleRepo || isAnnouncement) && independentSignals.length === 0) {
        return false;
      }
      return true;
    });

    if (validOpps.length > 0) {
      const mapped: StoredOpportunity[] = validOpps.map((o) => {
        const sc = o.scorecards[0];
        const latestRev = o.revisions?.[0];
        const snapshot = (latestRev?.snapshotData && typeof latestRev.snapshotData === "object")
          ? (latestRev.snapshotData as Record<string, any>)
          : {};

        const evidenceLinks = (o.evidenceLinks || []).map((el: any) => {
          const rawPubAt =
            el.normalizedSignal?.publishedAt ||
            el.normalizedSignal?.rawSignal?.publishedAt ||
            el.normalizedSignal?.rawSignal?.createdAt ||
            el.createdAt;
          return {
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
                  sourceTitle: el.normalizedSignal.sourceTitle || el.normalizedSignal.rawSignal?.title || "",
                  sanitizedExcerpt: el.normalizedSignal.sanitizedExcerpt || "",
                  canonicalUrl: el.normalizedSignal.canonicalUrl || el.normalizedSignal.rawSignal?.sourceUrl || "",
                  signalType: el.normalizedSignal.signalType || "PAIN",
                  verificationStatus: el.normalizedSignal.verificationStatus || "VERIFIED",
                  confidenceScore: el.normalizedSignal.confidenceScore || 75,
                  sourceName:
                    el.normalizedSignal.rawSignal?.source?.name ||
                    el.normalizedSignal.actorRole ||
                    "Market Signal",
                  independenceKey:
                    el.normalizedSignal.independenceKey ||
                    el.normalizedSignal.rawSignal?.source?.key ||
                    el.normalizedSignal.id,
                  publishedAt: rawPubAt ? new Date(rawPubAt).toISOString() : el.createdAt.toISOString(),
                }
              : undefined,
          };
        });

        const isVerified = o.publicationQualityStatus === "VERIFIED";
        const uniqueSourcesCount = new Set(
          evidenceLinks
            .map(
              (el: any) =>
                el.signal?.independenceKey ||
                el.signal?.sourceName ||
                el.normalizedSignalId,
            )
            .filter(Boolean),
        ).size;
        const rawOppScore =
          sc?.opportunityScore ||
          Math.min(82, 48 + Math.min(evidenceLinks.length, 6) * 4 + Math.min(uniqueSourcesCount, 4) * 3);
        const rawConfScore =
          sc?.evidenceConfidenceScore ||
          Math.min(85, 42 + Math.min(evidenceLinks.length, 6) * 5 + Math.min(uniqueSourcesCount, 4) * 4);
        // Never inflate single-source uncorroborated hypotheses to 85/80
        const honestOpportunityScore =
          !isVerified && uniqueSourcesCount <= 1
            ? Math.min(rawOppScore, 64)
            : rawOppScore;
        const honestConfidenceScore =
          !isVerified && uniqueSourcesCount <= 1
            ? Math.min(rawConfScore, 58)
            : rawConfScore;

        const existingCompetitors: string[] = Array.isArray(snapshot.existingCompetitors)
          ? snapshot.existingCompetitors
          : [];
        const competitorWeaknesses: string[] = Array.isArray(snapshot.competitorWeaknesses)
          ? snapshot.competitorWeaknesses
          : [];

        const competitors = existingCompetitors.map((name: string, idx: number) => ({
          name,
          weakness: competitorWeaknesses[idx] || competitorWeaknesses[0] || "Manual overhead and lack of targeted workflow automation",
        }));

        const evidenceOfDemand: string[] = Array.isArray(snapshot.evidenceOfDemand) && snapshot.evidenceOfDemand.length > 0
          ? snapshot.evidenceOfDemand
          : evidenceLinks.slice(0, 3).map((el) => {
              const datePart = el.signal?.publishedAt ? new Date(el.signal.publishedAt).toISOString().split("T")[0] : "recent";
              return `[${el.signal?.sourceName || "Source"} · ${datePart}] "${(el.claimSnippet || "").slice(0, 140)}"`;
            });

        const evidenceOfWillingnessToPay: string[] = Array.isArray(snapshot.evidenceOfWillingnessToPay) && snapshot.evidenceOfWillingnessToPay.length > 0
          ? snapshot.evidenceOfWillingnessToPay
          : [
              `[Assumption] Direct willingness-to-pay not yet confirmed in public threads; commercial indicator inferred from engineering labor & operational disruption cost.`,
            ];

        return {
          slug: o.slug,
          title: o.title,
          summary: o.oneSentenceSummary || o.problemStatement,
          problemStatement: o.problemStatement || o.oneSentenceSummary,
          proposedProduct: o.proposedProduct,
          industry: o.industry,
          customerType: o.customerType,
          opportunityScore: honestOpportunityScore,
          confidenceScore: honestConfidenceScore,
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
          endUser: o.endUser,
          targetCustomerSegments: o.targetCustomerSegments || [],
          signalsCount: evidenceLinks.length,
          recommendedExperiment: o.recommendedNextExperiment,
          jobsToBeDone: o.jobsToBeDone,
          narrowMvpScope: o.narrowMvpScope,
          existingWorkflow: o.existingWorkflow,
          existingCompetitors,
          competitorWeaknesses,
          competitors,
          majorAssumptions: o.majorAssumptions || [],
          majorRisks: o.majorRisks || [],
          evidenceOfDemand,
          evidenceOfWillingnessToPay,
          buyingTrigger: o.buyingTrigger,
          dimensionBreakdown: [
            {
              name: "Pain Evidence",
              score: Math.min(15, 9 + uniqueSourcesCount * 2),
              maxScore: 15,
              explanation: `Backed by ${evidenceLinks.length} cited source signal(s) across ${uniqueSourcesCount} independent source(s).`,
            },
            {
              name: "Buyer Demand & WTP",
              score: isVerified ? 13 : 8,
              maxScore: 15,
              explanation: isVerified
                ? "Supported by independent demand and willingness-to-pay evidence."
                : "[Assumption] Inferred from operational cost; direct buyer budget commitment requires validation.",
              isAssumption: !isVerified,
            },
            {
              name: "Technical Feasibility",
              score: 13,
              maxScore: 15,
              explanation: "Deliverable as a focused workflow integration or diagnostic service.",
            },
            {
              name: "Cost-Benefit Economics",
              score: isVerified ? 13 : 10,
              maxScore: 15,
              explanation: "[Assumption] Modeled against engineering hours spent on manual workarounds.",
              isAssumption: !isVerified,
            },
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

    return NextResponse.json({
      success: true,
      totalCount: 0,
      opportunities: [],
    });
  } catch (err: any) {
    console.error("Failed to query opportunities from DB", err);
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_LOAD_OPPORTUNITIES",
        totalCount: 0,
        opportunities: [],
      },
      { status: 500 },
    );
  }
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
