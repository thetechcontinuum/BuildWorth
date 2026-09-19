import {
  OpportunityPreviewDTO,
  OpportunityFullDTO,
  FounderFitPreviewDTO,
  FounderFitFullDTO,
  LockedContentDescriptor,
  UserEntitlementContext,
  OpportunityBlueprint,
  FounderFitEvaluation,
} from "@buildworth/shared";

/**
 * Server-authoritative content access policy engine.
 * Never leaks Pro fields in preview DTOs; constructs preview DTOs strictly by allowlisting.
 */

export function createLockedDescriptor(
  capability:
    | "opportunity.view.preview"
    | "opportunity.view.full"
    | "opportunity.export.pdf"
    | "opportunity.export.csv"
    | "opportunity.radar.history"
    | "founder_fit.view.full",
  reason: "PRO_REQUIRED" | "UNAUTHENTICATED" | "QUOTA_EXCEEDED" | "NOT_OWNER" = "PRO_REQUIRED",
  previewTeaser?: string,
): LockedContentDescriptor {
  return {
    locked: true,
    capability,
    reason,
    previewTeaser,
  };
}

export function filterOpportunityForContext(
  opportunity: any,
  blueprint: OpportunityBlueprint | null | undefined,
  context: UserEntitlementContext,
): OpportunityPreviewDTO | OpportunityFullDTO {
  const isPro =
    context.tier === "PRO" || context.tier === "TEAM" || context.tier === "ENTERPRISE";
  const canViewFull =
    isPro && (context.entitlements?.VENTURE_BLUEPRINT_FINANCIALS?.isGranted ?? false);

  const previewDTO: OpportunityPreviewDTO = {
    id: String(opportunity.id || ""),
    slug: String(opportunity.slug || ""),
    title: String(opportunity.title || ""),
    category: String(opportunity.category || opportunity.industry || "B2B SaaS"),
    industry: String(opportunity.industry || "B2B SaaS"),
    summary: String(
      opportunity.summary || opportunity.oneSentenceSummary || "Decision-grade venture opportunity",
    ),
    problemStatement: String(opportunity.problemStatement || ""),
    opportunityScore: Number(opportunity.opportunityScore || 0),
    confidenceScore: Number(opportunity.confidenceScore || 0),
    publicEvidenceCount: Array.isArray(opportunity.evidenceLinks)
      ? opportunity.evidenceLinks.length
      : 0,
    evidenceTeasers: (opportunity.evidenceLinks || []).slice(0, 3).map((link: any, idx: number) => ({
      id: link.id || `teaser-${idx}`,
      sourceFamily: link.signal?.sourceFamily || "COMMUNITY",
      credibilityTier: link.signal?.credibilityTier || "TIER_2",
      publishedAt: link.signal?.collectedAt || link.signal?.createdAt,
      excerptTeaser: (link.signal?.rawContent || "").slice(0, 140),
    })),
    existingWorkflow: String(opportunity.existingWorkflow || ""),
    economicBuyer: String(opportunity.economicBuyer || ""),
    endUser: String(opportunity.endUser || ""),
    painSeverity: String(opportunity.painSeverity || "MEDIUM"),
    painFrequency: String(opportunity.painFrequency || "WEEKLY"),
    decisionRecommendation: String(opportunity.decisionRecommendation || "UNASSESSED"),
    isLocked: !canViewFull,
    lockedSections: {
      customerSegments: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Detailed ICP breakdown, budget authority, and buyer persona mapping.",
      ),
      mvpScope: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Target feature specifications, technical boundaries, and trade-offs.",
      ),
      financialEconomics: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "3-scenario economic model, payback period, and gross margin projections.",
      ),
      risksAndAssumptions: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Ranked risk matrix and falsifiable assumption catalog.",
      ),
      validationRoadmap: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Ordered experiment schedule with cost and time estimates.",
      ),
      competitorWedge: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Incumbent vulnerabilities and proprietary wedge analysis.",
      ),
      first20Plan: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Zero-CAC customer acquisition playbooks and pilot conversion terms.",
      ),
      fullEvidenceLineage: createLockedDescriptor(
        "opportunity.view.full",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Unfiltered primary source signals with cryptographic verification.",
      ),
      exports: createLockedDescriptor(
        "opportunity.export.pdf",
        context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
        "Decision-grade PDF dossier and structured CSV data export.",
      ),
    },
  };

  if (!canViewFull || !blueprint) {
    return previewDTO;
  }

  const fullDTO: OpportunityFullDTO = {
    ...previewDTO,
    isLocked: false,
    blueprint,
    fullEvidenceSignals: opportunity.evidenceSignals || [],
    rawEvidenceExcerpts: opportunity.rawEvidenceExcerpts || [],
  };

  return fullDTO;
}

export function filterFounderFitForContext(
  evaluation: FounderFitEvaluation | null | undefined,
  targetUserId: string,
  context: UserEntitlementContext,
): FounderFitPreviewDTO | FounderFitFullDTO {
  if (!evaluation) {
    return {
      hasProfile: false,
      founderFitScore: 0,
      fitConfidence: 0,
      recommendationCategory: "UNASSESSED",
      isLocked: false,
      lockedBreakdown: createLockedDescriptor("founder_fit.view.full", "PRO_REQUIRED"),
    };
  }

  // Cross-user ownership enforcement: User A cannot see User B evaluation breakdown
  const isOwner = context.userId === targetUserId;
  const isPro =
    context.tier === "PRO" || context.tier === "TEAM" || context.tier === "ENTERPRISE";
  const canViewFull =
    isOwner && isPro && (context.entitlements?.FOUNDER_FIT_FULL_BREAKDOWN?.isGranted ?? false);

  const previewDTO: FounderFitPreviewDTO = {
    hasProfile: true,
    founderFitScore: evaluation.founderFitScore,
    fitConfidence: evaluation.fitConfidence,
    recommendationCategory: evaluation.recommendationCategory,
    personalizedRank: evaluation.personalizedRank,
    baseRank: evaluation.baseRank,
    isLocked: !canViewFull,
    lockedBreakdown: createLockedDescriptor(
      "founder_fit.view.full",
      !isOwner ? "NOT_OWNER" : context.userId === "anonymous" ? "UNAUTHENTICATED" : "PRO_REQUIRED",
      "8-dimension fit breakdown, blocker analysis, and customized risk mitigations.",
    ),
  };

  if (!canViewFull) {
    return previewDTO;
  }

  const fullDTO: FounderFitFullDTO = {
    ...previewDTO,
    isLocked: false,
    evaluation,
  };

  return fullDTO;
}
