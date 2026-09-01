import {
  SOC2_BLUEPRINT_DEV_FIXTURE,
  SNOWFLAKE_BLUEPRINT_DEV_FIXTURE,
} from "@/lib/blueprint-fixtures";
import React from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { ClaimType, OpportunityBlueprint } from "@buildworth/shared";
import { getStoredOpportunityBySlug, StoredOpportunity } from "@/lib/opportunity-store";
import { cookies } from "next/headers";
import { prisma, resolveServerSession } from "@buildworth/database";
import { resolveUserEntitlements } from "@buildworth/entitlements";
import { filterOpportunityForContext, filterFounderFitForContext } from "@buildworth/opportunity-engine";

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
  const opp = getStoredOpportunityBySlug(params.slug);
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
  const entitlementContext = resolveUserEntitlements(dbUser as any, new Date(), {
    isLiveEnvironment: isLive,
  });
  let opp = getStoredOpportunityBySlug(params.slug);
  try {
    const dbOpp = await prisma.opportunity.findUnique({
      where: { slug: params.slug },
      include: {
        scorecards: { orderBy: { createdAt: "desc" }, take: 1 },
        evidenceLinks: { include: { normalizedSignal: true } },
      },
    });

    if (dbOpp) {
      const sc = dbOpp.scorecards[0];
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

      opp = {
        slug: dbOpp.slug,
        title: dbOpp.title,
        summary: dbOpp.oneSentenceSummary,
        industry: dbOpp.industry,
        customerType: dbOpp.customerType,
        opportunityScore: sc?.opportunityScore || 85,
        confidenceScore: sc?.evidenceConfidenceScore || 80,
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
        signalsCount: evidenceLinks.length || 5,
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

  if (!opp) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-zinc-400">
        Opportunity blueprint not found.
      </div>
    );
  }

  const isSnowflake = params.slug.includes("snowflake");
  const fullBlueprintFixture: OpportunityBlueprint = isSnowflake
    ? SNOWFLAKE_BLUEPRINT_DEV_FIXTURE
    : SOC2_BLUEPRINT_DEV_FIXTURE;

  const opportunityDTO = filterOpportunityForContext(opp, fullBlueprintFixture, entitlementContext);

  const hasAuthenticatedProfile = !!sessionUser;
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
    } else if (isSnowflake) {
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
    } else {
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
  const blueprintData = isProContent ? opportunityDTO.blueprint : fullBlueprintFixture;

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

      {/* 2. Problem Space & Workaround */}
      <section
        id="section-problem-workaround"
        className="p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-lg"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Problem Space & Workaround
          </h2>
          <div className="flex items-center gap-2">
            <ClaimEvidenceBadge claimType="PAIN_EXISTENCE" sourcesCount={painCount} />
            <ClaimEvidenceBadge claimType="BUYER_DEMAND" sourcesCount={buyerDemandCount} />
          </div>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {opportunityDTO.existingWorkflow ||
            "Manual engineering scripts and fragmented spreadsheet tracking."}
        </p>
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
