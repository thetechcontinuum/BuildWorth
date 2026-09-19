import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";
import { createOpportunityRevisionTransaction } from "@buildworth/opportunity-engine";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertAdminMutation(request, "UPDATE_DRAFT_OPPORTUNITY", "OPPORTUNITY", params.id);
  if (!auth.authorized) {
    return auth.response;
  }

  const opp = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: {
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        include: {
          blueprint: {
            include: {
              customerSegments: true,
              mvpFeatures: true,
              competitors: true,
              financialScenarios: true,
              costLineItems: true,
              benefitDrivers: true,
              risks: true,
              assumptions: true,
              validationExperiments: true,
            },
          },
        },
      },
    },
  });

  if (!opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const { action, reason, status, title, problemStatement, proposedProduct } = body;

  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    return NextResponse.json(
      { error: "A valid editorial reason of at least 5 characters is required" },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // Handle archive action
  if (action === "ARCHIVE" || status === "ARCHIVED") {
    const updated = await prisma.opportunity.update({
      where: { id: opp.id },
      data: { status: "ARCHIVED" },
    });

    await recordAuditLog({
      userId: auth.admin.id,
      action: "OPPORTUNITY_ARCHIVED",
      entityType: "OPPORTUNITY",
      entityId: opp.id,
      reason: reason.trim(),
      details: { previousStatus: opp.status, newStatus: "ARCHIVED" },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({ success: true, opportunity: updated }, { headers: NO_CACHE_HEADERS });
  }

  // Handle editorial revision
  if (action === "CREATE_REVISION" || title || problemStatement || proposedProduct) {
    const latestRev = opp.revisions[0];
    const blueprint = latestRev?.blueprint;

    const newTitle = (title && typeof title === "string") ? title.trim() : opp.title;
    const newProblem = (problemStatement && typeof problemStatement === "string") ? problemStatement.trim() : opp.problemStatement;
    const newProduct = (proposedProduct && typeof proposedProduct === "string") ? proposedProduct.trim() : opp.proposedProduct;

    // Update opportunity fields
    await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        title: newTitle,
        problemStatement: newProblem,
        proposedProduct: newProduct,
      },
    });

    // Create audited revision transaction if blueprint exists
    if (blueprint) {
      await createOpportunityRevisionTransaction(prisma, {
        opportunityId: opp.id,
        reasonForChange: reason.trim(),
        architectureSummary: blueprint.architectureSummary,
        gtmNarrative: blueprint.gtmNarrative,
        first20Plan: blueprint.first20Plan,
        reachableMarket: blueprint.reachableMarket,
        customerSegments: (blueprint.customerSegments as any) || [],
        mvpFeatures: (blueprint.mvpFeatures as any) || [],
        competitors: (blueprint.competitors as any) || [],
        scenarios: (blueprint.financialScenarios as any) || [],
        costs: (blueprint.costLineItems as any) || [],
        benefits: (blueprint.benefitDrivers as any) || [],
        risks: (blueprint.risks as any) || [],
        assumptions: (blueprint.assumptions as any) || [],
        experiments: (blueprint.validationExperiments as any) || [],
        opportunityScore: 70,
        evidenceConfidence: 50,
        criticalClaimsCovered: 3,
        costSummary: {
          minBuildMinorCents: opp.estimatedMvpCostMinCents,
          maxBuildMinorCents: opp.estimatedMvpCostMaxCents,
          minWeeks: opp.estimatedTimeToMvpMinWeeks,
          maxWeeks: opp.estimatedTimeToMvpMaxWeeks,
          minMonthlyOpMinorCents: opp.estimatedMonthlyOpCostMinCents,
          maxMonthlyOpMinorCents: opp.estimatedMonthlyOpCostMaxCents,
        },
      });
    }

    await recordAuditLog({
      userId: auth.admin.id,
      action: "OPPORTUNITY_REVISION_CREATED",
      entityType: "OPPORTUNITY",
      entityId: opp.id,
      reason: reason.trim(),
      details: {
        changes: {
          title: newTitle !== opp.title ? { from: opp.title, to: newTitle } : undefined,
          problemStatement: newProblem !== opp.problemStatement ? { from: opp.problemStatement, to: newProblem } : undefined,
          proposedProduct: newProduct !== opp.proposedProduct ? { from: opp.proposedProduct, to: newProduct } : undefined,
        },
      },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const refreshed = await prisma.opportunity.findUnique({
      where: { id: opp.id },
      include: { revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
    });

    return NextResponse.json({ success: true, opportunity: refreshed }, { headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({ error: "No recognized action or field updates provided" }, { status: 400, headers: NO_CACHE_HEADERS });
}
