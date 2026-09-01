import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { executeOpportunityExport } from "@buildworth/opportunity-engine";
import { getStoredOpportunityBySlug } from "@/lib/opportunity-store";
import {
  SOC2_BLUEPRINT_DEV_FIXTURE,
  SNOWFLAKE_BLUEPRINT_DEV_FIXTURE,
} from "@/lib/blueprint-fixtures";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = await resolveServerSession(prisma, sessionToken);

    if (!sessionUser) {
      return NextResponse.json(
        {
          error: "PRO_REQUIRED: You must be signed in with an active Pro subscription to export blueprints.",
          upgradeRequired: true,
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            Vary: "Cookie",
          },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const format = (body.format === "CSV" ? "CSV" : "PDF") as "PDF" | "CSV";
    const slug = params.slug;

    // Fetch full user data for entitlement resolution
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        billingSubscriptions: {
          include: {
            planPrice: {
              include: {
                plan: true,
              },
            },
          },
        },
        entitlementGrants: true,
      },
    });

    const isLive = process.env.NODE_ENV === "production" && !process.env.TEST_ENV;
    const entitlementContext = resolveUserEntitlements(dbUser as any, new Date(), {
      isLiveEnvironment: isLive,
    });

    // Resolve Opportunity and Blueprint data from DB or store
    let opp = await prisma.opportunity.findUnique({ where: { slug } });
    let revisionId: string | undefined;

    if (!opp) {
      const stored = getStoredOpportunityBySlug(slug);
      if (stored) {
        opp = await prisma.opportunity.upsert({
          where: { slug },
          update: {},
          create: {
            slug: stored.slug,
            title: stored.title,
            oneSentenceSummary: stored.summary,
            problemStatement: stored.summary,
            jobsToBeDone: stored.jobsToBeDone || ["Validation", "Discovery"],
            proposedProduct: stored.title,
            narrowMvpScope: stored.narrowMvpScope || ["Core Engine"],
            targetCustomerSegments: ["B2B SaaS"],
            economicBuyer: stored.buyer || "VP Engineering",
            endUser: "Lead Architect",
            buyingTrigger: stored.buyingTrigger || "Quarterly Audit",
            existingWorkflow: stored.existingWorkflow || "Manual spreadsheets",
            painSeverity: "CRITICAL",
            painFrequency: "MONTHLY",
            customerType: "B2B",
            industry: stored.industry || "DevOps & Compliance",
            publicationQualityStatus: stored.publicationQualityStatus || "VERIFIED",
            estimatedMvpCostMinCents: stored.costRange?.minMinor || 100000,
            estimatedMvpCostMaxCents: stored.costRange?.maxMinor || 200000,
            estimatedTimeToMvpMinWeeks: stored.timeToMvpWeeks?.min || 4,
            estimatedTimeToMvpMaxWeeks: stored.timeToMvpWeeks?.max || 8,
            estimatedMonthlyOpCostMinCents: 10000,
            estimatedMonthlyOpCostMaxCents: 20000,
            currency: "USD",
            recommendedNextExperiment: stored.recommendedExperiment || "Customer Interviews",
          },
        });

        const rev = await prisma.opportunityRevision.upsert({
          where: {
            opportunityId_revisionNumber: {
              opportunityId: opp.id,
              revisionNumber: 1,
            },
          },
          update: {},
          create: {
            opportunityId: opp.id,
            revisionNumber: 1,
            reasonForChange: "Initial revision for export",
            snapshotData: { title: opp.title, slug: opp.slug },
          },
        });
        revisionId = rev.id;

        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { currentRevisionId: rev.id },
        });
      }
    }

    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    const isSnowflake = slug.includes("snowflake");
    const blueprintData = isSnowflake ? SNOWFLAKE_BLUEPRINT_DEV_FIXTURE : SOC2_BLUEPRINT_DEV_FIXTURE;

    const result = await executeOpportunityExport(prisma, sessionUser.id, slug, format, {
      context: entitlementContext,
      opportunityData: opp,
      blueprintData,
      revisionId,
      includeFounderFit: body.includeFounderFit ?? true,
    });

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        {
          error: result.error || "Export failed.",
          upgradeRequired: result.statusCode === 403,
        },
        {
          status: result.statusCode,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            Vary: "Cookie",
          },
        },
      );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Vary: "Cookie",
      },
    });
  } catch (err: any) {
    console.error("Export Error:", err?.message || err, err?.stack);
    return NextResponse.json(
      { error: "Internal server error generating export.", details: err?.message || String(err) },
      { status: 500 },
    );
  }
}
