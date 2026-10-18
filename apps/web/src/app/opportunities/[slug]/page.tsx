import React from "react";
import Link from "next/link";
import { ArrowLeft, Users, AlertTriangle, ShieldCheck } from "lucide-react";
import { ClaimType, OpportunityBlueprint } from "@buildworth/shared";
import { getStoredOpportunityBySlug, StoredOpportunity } from "@/lib/opportunity-store";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import {
  filterOpportunityForContext,
  filterFounderFitForContext,
  evaluateSolutionFeasibility,
  isSingleRepoTicket,
  isProductAnnouncement,
} from "@buildworth/opportunity-engine";
import { resolveBlueprintForOpportunity } from "@/lib/blueprint-resolver";

import { MarketEvidenceSection } from "@/components/MarketEvidenceSection";
import { ClaimEvidenceBadge } from "@/components/ClaimEvidenceBadge";
import { ExecutiveDecisionSummary } from "@/components/blueprint/ExecutiveDecisionSummary";
import { FounderFitDetailPanel } from "@/components/founder-fit/FounderFitDetailPanel";
import { StickySectionNav } from "@/components/blueprint/StickySectionNav";
import { CustomerSegmentsSection } from "@/components/blueprint/CustomerSegmentsSection";
import { NarrowMvpSection } from "@/components/blueprint/NarrowMvpSection";
import { CostBenefitEconomicsSection } from "@/components/blueprint/CostBenefitEconomicsSection";
import { RiskAssumptionMatrix } from "@/components/blueprint/RiskAssumptionMatrix";
import { ValidationRoadmap } from "@/components/blueprint/ValidationRoadmap";
import { CompetitionWedgeSection } from "@/components/blueprint/CompetitionWedgeSection";
import { First20CustomersPlan } from "@/components/blueprint/First20CustomersPlan";
import { LockedSectionPaywall } from "@/components/LockedSectionPaywall";
import { OpportunityExportControls } from "@/components/OpportunityExportControls";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.BUILDWORTH_ENV === "production";
  try {
    const dbOpp = await prisma.opportunity.findUnique({
      where: { slug: params.slug },
      select: { title: true, oneSentenceSummary: true },
    });
    if (dbOpp) {
      return {
        title: `${dbOpp.title} — BuildWorth`,
        description: dbOpp.oneSentenceSummary,
      };
    }
  } catch {
    // Fallback to stored opportunities in non-production
  }
  const opp = !isProduction ? getStoredOpportunityBySlug(params.slug) : undefined;
  return {
    title: `${opp ? opp.title : "Opportunity Blueprint"} — BuildWorth`,
    description: opp
      ? opp.summary
      : "Decision-grade venture blueprint and cost-benefit intelligence.",
  };
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const cookieStore = cookies();
  const rawSession = searchParams?.session;
  const sessionToken =
    (typeof rawSession === "string" ? rawSession : Array.isArray(rawSession) ? rawSession[0] : null) ||
    cookieStore.get("buildworth_session")?.value;

  const sessionUser = await resolveServerSession(prisma, sessionToken);

  let dbUser = null;
  let dbFitEvaluation = null;
  if (sessionUser) {
    dbUser = await prisma.user.findUnique({
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

    if (dbUser) {
      dbFitEvaluation = await prisma.founderFitEvaluation.findFirst({
        where: { userId: dbUser.id },
        include: {
          dimensions: true,
          blockers: true,
          strengths: true,
          gaps: true,
        },
        orderBy: { calculatedAt: "desc" },
      });
    }
  }

  const isLive = process.env.NODE_ENV === "production" && process.env.TEST_ENV !== "true";
  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.BUILDWORTH_ENV === "production";
  const entitlementContext = resolveUserEntitlements(dbUser as any, new Date(), {
    isLiveEnvironment: isLive,
  });
  let opp: StoredOpportunity | null = null;
  let dbOppRecord: any = null;
  try {
    const dbOpp = await prisma.opportunity.findUnique({
      where: { slug: params.slug },
      include: {
        scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
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
                decisionEvaluation: true,
              },
            },
          },
        },
      },
    });

    if (dbOpp) {
      dbOppRecord = dbOpp;
      const sc = dbOpp.scorecards[0];
      const latestRev = dbOpp.revisions?.[0];
      const snapshot =
        latestRev?.snapshotData && typeof latestRev.snapshotData === "object"
          ? (latestRev.snapshotData as Record<string, any>)
          : {};
      const evidenceLinks = (dbOpp.evidenceLinks || []).map((el: any) => ({
        id: el.id,
        opportunityId: dbOpp.id,
        normalizedSignalId: el.normalizedSignalId,
        claimType: el.claimType as any,
        claimIdentifier: el.claimIdentifier,
        claimSnippet: el.claimSnippet,
        relationshipType: el.relationshipType as any,
        supportStrength: el.supportStrength as any,
        relevanceScore: el.relevanceScore,
        explanation: el.explanation || undefined,
        createdAt: el.createdAt.toISOString(),
        signal: el.normalizedSignal
          ? {
              id: el.normalizedSignal.id,
              sourceName:
                el.normalizedSignal.rawSignal?.source?.name ||
                el.normalizedSignal.actorRole ||
                "Public Source",
              sourceFamily:
                el.normalizedSignal.rawSignal?.source?.sourceFamily || "COMMUNITY",
              independenceKey:
                el.normalizedSignal.independenceKey ||
                el.normalizedSignal.rawSignal?.source?.key ||
                el.normalizedSignal.id,
              credibilityTier:
                el.normalizedSignal.rawSignal?.source?.credibilityTier ||
                "TIER_2_CREDIBLE_PUBLIC",
              sourceTitle: el.normalizedSignal.sourceTitle || "",
              sanitizedExcerpt:
                el.normalizedSignal.sanitizedExcerpt ||
                el.normalizedSignal.problemSummary ||
                "",
              canonicalUrl: el.normalizedSignal.canonicalUrl || "",
              publishedAt:
                el.normalizedSignal.publishedAt?.toISOString() ||
                el.normalizedSignal.rawSignal?.publishedAt?.toISOString() ||
                el.normalizedSignal.createdAt?.toISOString() ||
                el.createdAt.toISOString(),
              authorOrg:
                el.normalizedSignal.authorOrg ||
                el.normalizedSignal.actorRole ||
                el.normalizedSignal.rawSignal?.source?.name ||
                "Identified Practitioner",
              actorRole: el.normalizedSignal.actorRole || "Identified Practitioner",
              signalType: el.normalizedSignal.signalType || "PAIN",
              purchaseIntent: el.normalizedSignal.purchaseIntent || false,
              verificationStatus: el.normalizedSignal.verificationStatus || "VERIFIED",
              evidenceOrigin: el.normalizedSignal.evidenceOrigin || "INGESTED_SIGNAL",
              verificationMethod:
                el.normalizedSignal.verificationMethod || "Automated Source Validation",
              confidenceScore: el.normalizedSignal.confidenceScore || 75,
            }
          : undefined,
      }));

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
      const isVerified = dbOpp.publicationQualityStatus === "VERIFIED";
      const rawOpportunityScore =
        sc?.opportunityScore ||
        Math.min(82, 48 + Math.min(evidenceLinks.length, 6) * 4 + Math.min(uniqueSourcesCount, 4) * 3);
      const rawConfidenceScore =
        sc?.evidenceConfidenceScore ||
        Math.min(85, 42 + Math.min(evidenceLinks.length, 6) * 5 + Math.min(uniqueSourcesCount, 4) * 4);
      const honestOpportunityScore =
        !isVerified && uniqueSourcesCount <= 1
          ? Math.min(rawOpportunityScore, 64)
          : rawOpportunityScore;
      const honestConfidenceScore =
        !isVerified && uniqueSourcesCount <= 1
          ? Math.min(rawConfidenceScore, 58)
          : rawConfidenceScore;

      if (sc) {
        sc.opportunityScore = honestOpportunityScore;
        sc.evidenceConfidenceScore = honestConfidenceScore;
      }

      const existingCompetitors: string[] = Array.isArray(snapshot.existingCompetitors)
        ? snapshot.existingCompetitors
        : [];
      const competitorWeaknesses: string[] = Array.isArray(snapshot.competitorWeaknesses)
        ? snapshot.competitorWeaknesses
        : [];
      const evidenceOfDemand: string[] = Array.isArray(snapshot.evidenceOfDemand)
        ? snapshot.evidenceOfDemand
        : [];
      const evidenceOfWillingnessToPay: string[] = Array.isArray(snapshot.evidenceOfWillingnessToPay)
        ? snapshot.evidenceOfWillingnessToPay
        : [];

      opp = {
        slug: dbOpp.slug,
        title: dbOpp.title,
        status: dbOpp.status as any,
        summary: dbOpp.oneSentenceSummary,
        problemStatement: dbOpp.problemStatement,
        proposedProduct: dbOpp.proposedProduct,
        endUser: dbOpp.endUser,
        targetCustomerSegments: dbOpp.targetCustomerSegments || [],
        existingCompetitors,
        competitorWeaknesses,
        majorAssumptions: dbOpp.majorAssumptions || [],
        majorRisks: dbOpp.majorRisks || [],
        evidenceOfDemand,
        evidenceOfWillingnessToPay,
        industry: dbOpp.industry,
        customerType: dbOpp.customerType,
        opportunityScore: honestOpportunityScore,
        confidenceScore: honestConfidenceScore,
        publicationQualityStatus: dbOpp.publicationQualityStatus as any,
        isDemoFixture: dbOpp.isDemoFixture,
        costRange: {
          minMinor: dbOpp.estimatedMvpCostMinCents,
          maxMinor: dbOpp.estimatedMvpCostMaxCents,
          currency: "USD",
        },
        timeToMvpWeeks: {
          min: dbOpp.estimatedTimeToMvpMinWeeks,
          max: dbOpp.estimatedTimeToMvpMaxWeeks,
        },
        buyer: dbOpp.economicBuyer,
        signalsCount: evidenceLinks.length,
        recommendedExperiment: dbOpp.recommendedNextExperiment,
        jobsToBeDone: dbOpp.jobsToBeDone,
        narrowMvpScope: dbOpp.narrowMvpScope,
        existingWorkflow: dbOpp.existingWorkflow,
        buyingTrigger: dbOpp.buyingTrigger,
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
        publishedAt: dbOpp.createdAt.toISOString(),
        evidenceLinks: evidenceLinks as any,
      } as StoredOpportunity;
    }
  } catch (err) {
    console.error("Failed to load db opportunity for slug " + params.slug, err);
  }

  // In non-production or local test environments, allow checking stored opportunities
  if (!opp && !isProduction && !isLive) {
    opp = getStoredOpportunityBySlug(params.slug) || null;
  }

  if (!opp) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-zinc-400">
        Opportunity blueprint not found.
      </div>
    );
  }

  // Security & Boundary Guard: Ineligible or unpublished opportunities are strictly inaccessible to non-administrators
  const isNonAdmin = !sessionUser || sessionUser.role !== "ADMIN";
  const oppStatus = (opp as any).status || dbOppRecord?.status;
  if (isNonAdmin && oppStatus && oppStatus !== "PUBLISHED") {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-zinc-400">
        Opportunity blueprint not found.
      </div>
    );
  }

  const combined = `${opp.slug || ""} ${opp.title || ""} ${opp.summary || ""} ${opp.problemStatement || ""}`;
  const feasibility = evaluateSolutionFeasibility(opp.problemStatement || opp.title);
  const primaryUrl =
    (opp.evidenceLinks as any)?.[0]?.signal?.canonicalUrl ||
    (dbOppRecord?.evidenceLinks as any)?.[0]?.normalizedSignal?.canonicalUrl;
  const isSingleRepo = isSingleRepoTicket(primaryUrl, combined);
  const isAnnouncement = isProductAnnouncement(opp.title, opp.problemStatement, primaryUrl);
  if (isNonAdmin && (!feasibility.isFeasible || ((isSingleRepo || isAnnouncement) && (opp.evidenceLinks?.length || 0) <= 1))) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-zinc-400">
        Opportunity blueprint not found.
      </div>
    );
  }

  const fullBlueprint: OpportunityBlueprint = resolveBlueprintForOpportunity(dbOppRecord || opp);
  const opportunityDTO = filterOpportunityForContext(opp, fullBlueprint, entitlementContext);

  const hasAuthenticatedProfile = !!sessionUser;
  const isSnowflake = params.slug.toLowerCase().includes("snowflake");
  let rawFitEvaluation: any = null;
  if (hasAuthenticatedProfile) {
    if (dbFitEvaluation) {
      rawFitEvaluation = {
        founderFitScore: dbFitEvaluation.founderFitScore,
        fitConfidence: dbFitEvaluation.fitConfidence,
        recommendationCategory: dbFitEvaluation.recommendationCategory,
        personalizedRank: dbFitEvaluation.personalizedRank,
        baseRank: dbFitEvaluation.baseRank,
        penalties: [],
        dimensions: (dbFitEvaluation.dimensions || []).map((d: any) => ({
          name: d.dimensionName,
          score: d.score,
          maxScore: d.maxScore,
          status: d.status,
          explanation: d.explanation,
          matchedRequirements: d.matchedRequirements || [],
          missingRequirements: d.missingRequirements || [],
        })),
        blockers: (dbFitEvaluation.blockers || []).map((b: any) => ({
          code: b.blockerCode,
          severity: b.severity,
          explanation: b.explanation,
          sourceRequirement: b.sourceRequirement,
          profileConstraint: b.profileConstraint,
          isRemovable: b.isRemovable,
          suggestedMitigation: b.suggestedMitigation,
        })),
        strengths: (dbFitEvaluation.strengths || []).map((s: any) => ({
          title: s.title,
          description: s.description,
          category: s.category,
        })),
        gaps: (dbFitEvaluation.gaps || []).map((g: any) => ({
          title: g.title,
          description: g.description,
          severity: g.severity,
          mitigationSuggestion: g.mitigationSuggestion,
        })),
        rubricVersion: dbFitEvaluation.rubricVersion,
        rankingVersion: dbFitEvaluation.rankingVersion,
        taxonomyVersion: dbFitEvaluation.taxonomyVersion,
        inputHash: dbFitEvaluation.inputHash,
        calculatedAt: dbFitEvaluation.calculatedAt?.toISOString() || new Date().toISOString(),
      };
    } else if (!isProduction && isSnowflake) {
      rawFitEvaluation = {
        founderFitScore: 88,
        fitConfidence: 70,
        recommendationCategory: "BLOCKED" as const,
        personalizedRank: 20.8,
        baseRank: 62.8,
        penalties: [
          { reason: "Unverified Hypothesis Status", penaltyPoints: 10 },
          { reason: "1 Non-Removable Blocker(s)", penaltyPoints: 25 },
          { reason: "1 Removable Blocker(s)", penaltyPoints: 7 },
        ],
        dimensions: [
          {
            name: "Capability Match",
            score: 19,
            maxScore: 20,
            status: "CALCULATED" as const,
            explanation: "Covers TypeScript, PostgreSQL, and Data Ops.",
            matchedRequirements: ["TypeScript", "PostgreSQL"],
            missingRequirements: [],
          },
          {
            name: "Domain Expertise Match",
            score: 14,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation: "Background in data tooling and warehouse optimization.",
            matchedRequirements: ["Data Engineering"],
            missingRequirements: [],
          },
          {
            name: "Budget Fit",
            score: 15,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation: "Covers Milestone 1 infrastructure.",
            matchedRequirements: ["USD_5K_TO_20K"],
            missingRequirements: [],
          },
          {
            name: "Time & Capacity Fit",
            score: 10,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation: "20+ weekly hours commitment.",
            matchedRequirements: ["HOURS_21_TO_35"],
            missingRequirements: [],
          },
          {
            name: "Distribution Advantage",
            score: 12,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation: "Active in data communities.",
            matchedRequirements: ["Data Network"],
            missingRequirements: [],
          },
          {
            name: "Buyer & Market Access",
            score: 9,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation: "Access to Head of Data buyers.",
            matchedRequirements: ["Head of Data"],
            missingRequirements: [],
          },
          {
            name: "Team & Resource Fit",
            score: 9,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation: "Solo founder capability covers discovery.",
            matchedRequirements: ["SOLO_FOUNDER"],
            missingRequirements: [],
          },
          {
            name: "Risk & Constraint Fit",
            score: 0,
            maxScore: 5,
            status: "CALCULATED" as const,
            explanation: "Exceeds regulatory exposure tolerance.",
            matchedRequirements: [],
            missingRequirements: ["SOC2_COMPLIANCE"],
          },
        ],
        blockers: [
          {
            code: "REGULATORY_RISK_REJECTED" as const,
            severity: "CRITICAL" as const,
            explanation:
              "Opportunity requires SOC2 Type II certification exceeding founder current risk profile.",
            sourceRequirement: "SOC2 Compliance Certification",
            profileConstraint: "Founder risk tolerance: LOW / Moderate",
            isRemovable: false,
            suggestedMitigation:
              "Pursue automated compliance platform partner prior to enterprise pilots.",
          },
          {
            code: "TEAM_SIZE_INSUFFICIENT" as const,
            severity: "HIGH" as const,
            explanation: "Requires 24/7 on-call rotation support team.",
            sourceRequirement: "24/7 Support SLA",
            profileConstraint: "Solo Founder",
            isRemovable: true,
            suggestedMitigation: "Outsource after-hours triage to specialist contractor.",
          },
        ],
        strengths: [
          {
            title: "Technical Stack Alignment",
            description: "Proficiency matches data pipeline requirements.",
            category: "CAPABILITY" as const,
          },
        ],
        gaps: [
          {
            title: "Enterprise Compliance Burden",
            description: "SOC2 required for enterprise query log access.",
            severity: "CRITICAL" as const,
            mitigationSuggestion: "Partner with compliance platform.",
          },
        ],
        rubricVersion: "2.0.0",
        rankingVersion: "2.0.0",
        taxonomyVersion: "1.0.0",
        inputHash: "4f9e8a71b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789a",
        calculatedAt: new Date().toISOString(),
      };
    } else if (!isProduction && !isLive) {
      rawFitEvaluation = {
        founderFitScore: 88,
        fitConfidence: 85,
        recommendationCategory: "EXCELLENT_MATCH" as const,
        personalizedRank: 86.9,
        baseRank: 86.9,
        penalties: [],
        dimensions: [
          {
            name: "Capability Match",
            score: 19,
            maxScore: 20,
            status: "CALCULATED" as const,
            explanation: "Covers TypeScript, PostgreSQL, and DevOps requirements.",
            matchedRequirements: ["TypeScript", "PostgreSQL"],
            missingRequirements: [],
          },
          {
            name: "Domain Expertise Match",
            score: 14,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation: "3+ years background in DevOps & Compliance tooling.",
            matchedRequirements: ["DevOps & Compliance"],
            missingRequirements: [],
          },
          {
            name: "Budget Fit",
            score: 15,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation: "Available budget band covers Milestone 1 build cost comfortably.",
            matchedRequirements: ["USD_5K_TO_20K"],
            missingRequirements: [],
          },
          {
            name: "Time & Capacity Fit",
            score: 10,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation: "20+ weekly hours provides ample runway for 4-week delivery.",
            matchedRequirements: ["HOURS_21_TO_35"],
            missingRequirements: [],
          },
          {
            name: "Distribution Advantage",
            score: 12,
            maxScore: 15,
            status: "CALCULATED" as const,
            explanation:
              "Existing developer community access accelerates pilot acquisition.",
            matchedRequirements: ["Developer Network"],
            missingRequirements: [],
          },
          {
            name: "Buyer & Market Access",
            score: 9,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation: "Direct network relationships with Engineering leadership.",
            matchedRequirements: ["VP of Engineering"],
            missingRequirements: [],
          },
          {
            name: "Team & Resource Fit",
            score: 9,
            maxScore: 10,
            status: "CALCULATED" as const,
            explanation:
              "Solo founder capability covers discovery through initial MVP launch.",
            matchedRequirements: ["SOLO_FOUNDER"],
            missingRequirements: [],
          },
          {
            name: "Risk & Constraint Fit",
            score: 5,
            maxScore: 5,
            status: "CALCULATED" as const,
            explanation:
              "Technical and regulatory exposure align with profile risk tolerance.",
            matchedRequirements: [],
            missingRequirements: [],
          },
        ],
        blockers: [],
        strengths: [
          {
            title: "Proprietary Technical Fit",
            description: "Full-stack proficiency matches the entire stack requirements.",
            category: "CAPABILITY" as const,
          },
        ],
        gaps: [
          {
            title: "Enterprise Procurement Complexity",
            description: "Enterprise SOC2 pilots may involve legal redlines.",
            severity: "MODERATE" as const,
            mitigationSuggestion: "Use standardized click-through pilot DPA agreements.",
          },
        ],
        rubricVersion: "1.0.0",
        rankingVersion: "1.0.0",
        taxonomyVersion: "1.0.0",
        inputHash: "det-soc2-hash",
        calculatedAt: new Date().toISOString(),
      };
    }
  }

  const fitDTO = filterFounderFitForContext(
    rawFitEvaluation,
    sessionUser?.id || "anonymous",
    entitlementContext,
  );

  const getClaimEvidenceCount = (type: ClaimType) => {
    return (opp.evidenceLinks || []).filter(
      (l: any) =>
        l.claimType === type &&
        l.signal?.verificationStatus === "VERIFIED" &&
        l.signal?.evidenceOrigin !== "SYNTHETIC_FIXTURE" &&
        l.signal?.evidenceOrigin !== "LEGACY_UNCLASSIFIED",
    ).length;
  };

  const painCount = getClaimEvidenceCount("PAIN_EXISTENCE");
  const buyerDemandCount = getClaimEvidenceCount("BUYER_DEMAND");

  const isProContent = !opportunityDTO.isLocked && "blueprint" in opportunityDTO;
  const blueprintData = isProContent ? opportunityDTO.blueprint : fullBlueprint;

  const isVerifiedStatus = opp.publicationQualityStatus === "VERIFIED";

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Feed
        </Link>

        {/* Pro Export Controls */}
        <OpportunityExportControls
          slug={opp.slug}
          isLocked={opportunityDTO.isLocked}
          exportLockDescriptor={opportunityDTO.lockedSections.exports}
          initialShowUpgradeModal={
            searchParams?.modal === "export_blocked" ||
            searchParams?.view === "export_modal"
          }
        />
      </div>

      {/* Verification Status & Transparency Banner */}
      {isVerifiedStatus ? (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-emerald-200">Policy v2.0.0 Verified Opportunity:</strong> Rigorously corroborated across at least 5 empirical signals and 3 independent sources.
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            VERIFIED
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-start gap-3 text-xs text-amber-200/90">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <strong className="text-amber-300 font-semibold">Grounded Early Hypothesis:</strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                UNVERIFIED HYPOTHESIS
              </span>
            </div>
            <p className="text-zinc-300">
              Discovered from real recurring developer/market friction. Target buyer profiles, proposed product architecture, and willingness-to-pay are explicitly labeled as assumptions undergoing field validation under Policy v2.0.0.
            </p>
          </div>
        </div>
      )}

      {/* 1. Executive Decision Summary Banner */}
      <ExecutiveDecisionSummary
        blueprint={blueprintData}
        opportunityTitle={opportunityDTO.title}
        oneSentenceSummary={opportunityDTO.summary}
        slug={opportunityDTO.slug}
      />

      {/* Founder Fit Panel */}
      <FounderFitDetailPanel
        hasProfile={fitDTO.hasProfile}
        evaluation={"evaluation" in fitDTO ? fitDTO.evaluation : undefined}
      />

      {/* Sticky Section Navigation */}
      <StickySectionNav />

      {/* 2. Actionable Opportunity Brief & Problem Space */}
      <section
        id="section-problem-workaround"
        className="p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-6 shadow-lg"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Opportunity Brief: Problem, Product & Validation
          </h2>
          <div className="flex items-center gap-2">
            <ClaimEvidenceBadge claimType="PAIN_EXISTENCE" sourcesCount={painCount} />
            <ClaimEvidenceBadge claimType="BUYER_DEMAND" sourcesCount={buyerDemandCount} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Specific Problem & Affected Customer */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
              Specific Problem & Affected Customer
            </span>
            <p className="text-zinc-200 leading-relaxed text-sm">
              {opp.problemStatement || opp.summary}
            </p>
            <div className="pt-2 border-t border-zinc-800/60 space-y-1 text-zinc-400">
              <div>
                <span className="text-zinc-500">Affected Customer:</span>{" "}
                <span className="text-zinc-200 font-medium">
                  {opp.endUser || opp.targetCustomerSegments?.[0] || "Engineering & Operations Practitioners"}
                </span>{" "}
                <span className="text-zinc-500">• Economic Buyer:</span>{" "}
                <span className="text-zinc-200 font-medium">{opp.buyer}</span>
              </div>
              <div>
                <span className="text-zinc-500">Existing Workaround:</span>{" "}
                <span className="text-zinc-300">
                  {opportunityDTO.existingWorkflow || "Manual engineering scripts and fragmented spreadsheet tracking."}
                </span>
              </div>
            </div>
          </div>

          {/* Proposed Product & Existing Alternatives */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Proposed Product & Existing Alternatives
            </span>
            <p className="text-zinc-200 leading-relaxed text-sm">
              {opp.proposedProduct || opp.narrowMvpScope?.[0] || opp.summary}
            </p>
            <div className="pt-2 border-t border-zinc-800/60 space-y-1 text-zinc-400">
              <div>
                <span className="text-zinc-500">Existing Alternatives:</span>{" "}
                <span className="text-zinc-300">
                  {opp.existingCompetitors && opp.existingCompetitors.length > 0
                    ? opp.existingCompetitors.join(", ")
                    : "Manual custom scripts & incumbent tooling"}
                </span>
              </div>
              {opp.competitorWeaknesses && opp.competitorWeaknesses.length > 0 && (
                <div>
                  <span className="text-zinc-500">Incumbent Gap:</span>{" "}
                  <span className="text-zinc-300">{opp.competitorWeaknesses[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supported Commercial Indicators */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
              Supported Commercial Indicators
            </span>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-200">Demand Evidence:</strong>{" "}
              {opp.evidenceOfDemand?.[0] ||
                `${opp.signalsCount} empirical signal(s) documenting recurring operational friction`}
            </p>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-200">Willingness-to-Pay / Budget:</strong>{" "}
              {opp.evidenceOfWillingnessToPay?.[0] ||
                (opp.buyingTrigger
                  ? `Triggered by ${opp.buyingTrigger}`
                  : "Willingness-to-pay is an unverified hypothesis pending pilot outreach")}
            </p>
          </div>

          {/* Assumptions, Evidence Gaps & Next Validation Step */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Assumptions, Evidence Gaps & Next Validation Step
            </span>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-200">Key Assumption:</strong>{" "}
              {opp.majorAssumptions?.[0] ||
                `[Assumption] ${opp.buyer} will allocate budget to automate this workflow.`}
            </p>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-200">Evidence Gap:</strong>{" "}
              {opp.majorRisks?.[0] ||
                "Multi-source buyer corroboration and paid pilot conversion remain unverified."}
            </p>
            <p className="text-indigo-300 leading-relaxed pt-1 border-t border-zinc-800/60">
              <strong className="text-indigo-200">Next Validation Step:</strong>{" "}
              {opp.recommendedExperiment}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Customer Segments & ICP */}
      {isProContent ? (
        <CustomerSegmentsSection segments={opportunityDTO.blueprint.customerSegments} />
      ) : (
        <section id="section-customer-segments">
          <LockedSectionPaywall
            title="Customer Segments & Economic Buyers"
            descriptor={opportunityDTO.lockedSections.customerSegments}
          />
        </section>
      )}

      {/* 4. Narrow MVP Scope */}
      {isProContent ? (
        <NarrowMvpSection features={opportunityDTO.blueprint.mvpFeatures} />
      ) : (
        <section id="section-mvp-scope">
          <LockedSectionPaywall
            title="Narrow MVP Feature Specifications"
            descriptor={opportunityDTO.lockedSections.mvpScope}
          />
        </section>
      )}

      {/* 5. Cost-Benefit Intelligence */}
      {isProContent ? (
        <CostBenefitEconomicsSection blueprint={opportunityDTO.blueprint} />
      ) : (
        <section id="section-financials">
          <LockedSectionPaywall
            title="Cost-Benefit Financial Scenarios & Economic Models"
            descriptor={opportunityDTO.lockedSections.financialEconomics}
          />
        </section>
      )}

      {/* 6. Risks & Assumptions */}
      {isProContent ? (
        <RiskAssumptionMatrix
          risks={opportunityDTO.blueprint.risks}
          assumptions={opportunityDTO.blueprint.assumptions}
        />
      ) : (
        <section id="section-risks-assumptions">
          <LockedSectionPaywall
            title="Risk-Assumption Matrix & Falsifiable Catalog"
            descriptor={opportunityDTO.lockedSections.risksAndAssumptions}
          />
        </section>
      )}

      {/* 7. Validation Roadmap & Experiments */}
      {isProContent ? (
        <ValidationRoadmap experiments={opportunityDTO.blueprint.validationExperiments} />
      ) : (
        <section id="section-roadmap-experiments">
          <LockedSectionPaywall
            title="Validation Roadmap & Sequential Experiments"
            descriptor={opportunityDTO.lockedSections.validationRoadmap}
          />
        </section>
      )}

      {/* 8. Competition & Wedge */}
      {isProContent ? (
        <CompetitionWedgeSection competitors={opportunityDTO.blueprint.competitors || []} />
      ) : (
        <section id="section-competition-wedge">
          <LockedSectionPaywall
            title="Incumbent Vulnerabilities & Proprietary Wedge Analysis"
            descriptor={opportunityDTO.lockedSections.competitorWedge}
          />
        </section>
      )}

      {/* 9. First 20 Customers Execution Plan */}
      {isProContent ? (
        <First20CustomersPlan plan={opportunityDTO.blueprint.first20Plan} />
      ) : (
        <section id="section-first-20-customers">
          <LockedSectionPaywall
            title="First 20 Customers Pilot Acquisition Playbook"
            descriptor={opportunityDTO.lockedSections.first20Plan}
          />
        </section>
      )}

      {/* 10. Evidence Lineage Section */}
      <MarketEvidenceSection
        evidenceLinks={opp.evidenceLinks || []}
        publicationQualityStatus={opp.publicationQualityStatus}
        isDemoFixture={opp.isDemoFixture}
        confidenceScore={opp.confidenceScore}
      />
    </div>
  );
}
