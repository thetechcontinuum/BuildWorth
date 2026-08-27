import {
  SOC2_BLUEPRINT_DEV_FIXTURE,
  SNOWFLAKE_BLUEPRINT_DEV_FIXTURE,
} from "@/lib/blueprint-fixtures";
import React from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { ClaimType } from "@buildworth/shared";
import { getStoredOpportunityBySlug } from "@/lib/opportunity-store";

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

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const opp = getStoredOpportunityBySlug(params.slug);
  return {
    title: `${opp ? opp.title : "Opportunity Blueprint"} — BuildWorth`,
    description: opp
      ? opp.summary
      : "Decision-grade venture blueprint and cost-benefit intelligence.",
  };
}

export default function OpportunityDetailPage({ params }: { params: { slug: string } }) {
  const opp = getStoredOpportunityBySlug(params.slug);

  if (!opp) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-zinc-400">
        Opportunity blueprint not found.
      </div>
    );
  }

  const isSnowflake = params.slug.includes("snowflake");
  const blueprint = isSnowflake ? SNOWFLAKE_BLUEPRINT_DEV_FIXTURE : SOC2_BLUEPRINT_DEV_FIXTURE;

  const getClaimEvidenceCount = (type: ClaimType) => {
    return (opp.evidenceLinks || []).filter(
      (l) =>
        l.claimType === type &&
        l.signal?.verificationStatus === "VERIFIED" &&
        l.signal?.evidenceOrigin !== "SYNTHETIC_FIXTURE" &&
        l.signal?.evidenceOrigin !== "LEGACY_UNCLASSIFIED",
    ).length;
  };

  const painCount = getClaimEvidenceCount("PAIN_EXISTENCE");
  const buyerDemandCount = getClaimEvidenceCount("BUYER_DEMAND");

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Feed
      </Link>

      {/* 1. Executive Decision Summary Banner */}
      <ExecutiveDecisionSummary
        blueprint={blueprint}
        opportunityTitle={opp.title}
        oneSentenceSummary={opp.summary}
        slug={opp.slug}
      />

      {/* Founder Fit Panel */}
      <FounderFitDetailPanel
        hasProfile={true}
        evaluation={
          isSnowflake
            ? {
                founderFitScore: 88,
                fitConfidence: 70,
                recommendationCategory: "BLOCKED",
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
                    status: "CALCULATED",
                    explanation: "Covers TypeScript, PostgreSQL, and Data Ops.",
                    matchedRequirements: ["TypeScript", "PostgreSQL"],
                    missingRequirements: [],
                  },
                  {
                    name: "Domain Expertise Match",
                    score: 14,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation: "Background in data tooling and warehouse optimization.",
                    matchedRequirements: ["Data Engineering"],
                    missingRequirements: [],
                  },
                  {
                    name: "Budget Fit",
                    score: 15,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation: "Covers Milestone 1 infrastructure.",
                    matchedRequirements: ["USD_5K_TO_20K"],
                    missingRequirements: [],
                  },
                  {
                    name: "Time & Capacity Fit",
                    score: 10,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation: "20+ weekly hours commitment.",
                    matchedRequirements: ["HOURS_21_TO_35"],
                    missingRequirements: [],
                  },
                  {
                    name: "Distribution Advantage",
                    score: 12,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation: "Active in data communities.",
                    matchedRequirements: ["Data Network"],
                    missingRequirements: [],
                  },
                  {
                    name: "Buyer & Market Access",
                    score: 9,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation: "Access to Head of Data buyers.",
                    matchedRequirements: ["Head of Data"],
                    missingRequirements: [],
                  },
                  {
                    name: "Team & Resource Fit",
                    score: 9,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation: "Solo founder capability covers discovery.",
                    matchedRequirements: ["SOLO_FOUNDER"],
                    missingRequirements: [],
                  },
                  {
                    name: "Risk & Constraint Fit",
                    score: 0,
                    maxScore: 5,
                    status: "CALCULATED",
                    explanation: "Exceeds regulatory exposure tolerance.",
                    matchedRequirements: [],
                    missingRequirements: ["SOC2_COMPLIANCE"],
                  },
                ],
                blockers: [
                  {
                    code: "REGULATORY_RISK_REJECTED",
                    severity: "CRITICAL",
                    explanation:
                      "Opportunity requires SOC2 Type II certification exceeding founder current risk profile.",
                    sourceRequirement: "SOC2 Compliance Certification",
                    profileConstraint: "Founder risk tolerance: LOW / Moderate",
                    isRemovable: false,
                    suggestedMitigation:
                      "Pursue automated compliance platform partner prior to enterprise pilots.",
                  },
                  {
                    code: "TEAM_SIZE_INSUFFICIENT",
                    severity: "HIGH",
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
                    category: "CAPABILITY",
                  },
                ],
                gaps: [
                  {
                    title: "Enterprise Compliance Burden",
                    description: "SOC2 required for enterprise query log access.",
                    severity: "CRITICAL",
                    mitigationSuggestion: "Partner with compliance platform.",
                  },
                ],
                rubricVersion: "2.0.0",
                rankingVersion: "2.0.0",
                taxonomyVersion: "1.0.0",
                inputHash: "4f9e8a71b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789a",
                calculatedAt: new Date().toISOString(),
              }
            : {
                founderFitScore: 88,
                fitConfidence: 85,
                recommendationCategory: "EXCELLENT_MATCH",
                personalizedRank: 86.9,
                baseRank: 86.9,
                penalties: [],
                dimensions: [
                  {
                    name: "Capability Match",
                    score: 19,
                    maxScore: 20,
                    status: "CALCULATED",
                    explanation: "Covers TypeScript, PostgreSQL, and DevOps requirements.",
                    matchedRequirements: ["TypeScript", "PostgreSQL", "DevOps"],
                    missingRequirements: [],
                  },
                  {
                    name: "Domain Expertise Match",
                    score: 14,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation: "3+ years background in DevOps & Compliance tooling.",
                    matchedRequirements: ["DevOps & Compliance"],
                    missingRequirements: [],
                  },
                  {
                    name: "Budget Fit",
                    score: 15,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation: "Available budget band covers Milestone 1 build cost comfortably.",
                    matchedRequirements: ["USD_5K_TO_20K"],
                    missingRequirements: [],
                  },
                  {
                    name: "Time & Capacity Fit",
                    score: 10,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation: "20+ weekly hours provides ample runway for 4-week delivery.",
                    matchedRequirements: ["HOURS_21_TO_35"],
                    missingRequirements: [],
                  },
                  {
                    name: "Distribution Advantage",
                    score: 12,
                    maxScore: 15,
                    status: "CALCULATED",
                    explanation:
                      "Existing developer community access accelerates pilot acquisition.",
                    matchedRequirements: ["Developer Network"],
                    missingRequirements: [],
                  },
                  {
                    name: "Buyer & Market Access",
                    score: 9,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation: "Direct network relationships with Engineering leadership.",
                    matchedRequirements: ["VP of Engineering"],
                    missingRequirements: [],
                  },
                  {
                    name: "Team & Resource Fit",
                    score: 9,
                    maxScore: 10,
                    status: "CALCULATED",
                    explanation:
                      "Solo founder capability covers discovery through initial MVP launch.",
                    matchedRequirements: ["SOLO_FOUNDER"],
                    missingRequirements: [],
                  },
                  {
                    name: "Risk & Constraint Fit",
                    score: 5,
                    maxScore: 5,
                    status: "CALCULATED",
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
                    category: "CAPABILITY",
                  },
                  {
                    title: "GTM Channel Access",
                    description:
                      "Existing developer community enables $0 CAC initial customer discovery.",
                    category: "DISTRIBUTION",
                  },
                ],
                gaps: [
                  {
                    title: "Enterprise Procurement Complexity",
                    description: "Enterprise SOC2 pilots may involve legal redlines.",
                    severity: "MODERATE",
                    mitigationSuggestion: "Use standardized click-through pilot DPA agreements.",
                  },
                ],
                rubricVersion: "1.0.0",
                rankingVersion: "1.0.0",
                taxonomyVersion: "1.0.0",
                inputHash: "det-soc2-hash",
                calculatedAt: new Date().toISOString(),
              }
        }
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
          {opp.existingWorkflow ||
            "Manual engineering scripts and fragmented spreadsheet tracking."}
        </p>
      </section>

      {/* 3. Customer Segments & ICP */}
      <CustomerSegmentsSection segments={blueprint.customerSegments} />

      {/* 4. Narrow MVP Scope */}
      <NarrowMvpSection features={blueprint.mvpFeatures} />

      {/* 5. Cost-Benefit Intelligence */}
      <CostBenefitEconomicsSection blueprint={blueprint} />

      {/* 6. Risks & Assumptions */}
      <RiskAssumptionMatrix risks={blueprint.risks} assumptions={blueprint.assumptions} />

      {/* 7. Validation Roadmap & Experiments */}
      <ValidationRoadmap experiments={blueprint.validationExperiments} />

      {/* 8. Competition & Wedge */}
      <CompetitionWedgeSection competitors={blueprint.competitors || []} />

      {/* 9. First 20 Customers Execution Plan */}
      <First20CustomersPlan plan={blueprint.first20Plan} />

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
