import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Users } from "lucide-react";
import { ClaimType } from "@buildworth/shared";
import { getStoredOpportunityBySlug } from "@/lib/opportunity-store";
import { MOCK_BLUEPRINT_DEV_FIXTURE } from "@/lib/blueprint-fixtures";
import { MarketEvidenceSection } from "@/components/MarketEvidenceSection";
import { ClaimEvidenceBadge } from "@/components/ClaimEvidenceBadge";
import { ExecutiveDecisionSummary } from "@/components/blueprint/ExecutiveDecisionSummary";
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
    description: opp ? opp.summary : "Decision-grade venture blueprint and cost-benefit intelligence.",
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

  // Load decision-grade blueprint
  const blueprint = MOCK_BLUEPRINT_DEV_FIXTURE;

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

      {/* Sticky Section Navigation */}
      <StickySectionNav />

      {/* 2. Problem Space & Workaround */}
      <section id="section-problem-workaround" className="p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Problem Space & Workaround
          </h2>
          <div className="flex items-center gap-2">
            <ClaimEvidenceBadge claimType="PAIN_EXISTENCE" sourcesCount={painCount} />
            <ClaimEvidenceBadge claimType="BUYER_DEMAND" sourcesCount={buyerDemandCount} />
          </div>
        </div>

        <div className="space-y-3 text-sm text-zinc-300">
          <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
            <strong className="text-zinc-200">Existing Workaround:</strong>{" "}
            {opp.existingWorkflow || "Manual spreadsheets and scripts."}
          </div>
          <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
            <strong className="text-zinc-200">Buying Trigger:</strong>{" "}
            {opp.buyingTrigger || "Quarterly audit deadline or executive review."}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Jobs to be Done (JTBD)
          </span>
          <ul className="space-y-2 text-sm text-zinc-300">
            {(
              opp.jobsToBeDone || [
                "Collect and verify compliance evidence automatically",
                "Generate audit-ready reports without manual engineering hours",
                "Alert team leads when unreviewed pull requests deploy",
              ]
            ).map((job, idx) => (
              <li key={idx} className="flex items-start gap-2.5 p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <span>{job}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Market Evidence Section (Phase 1 verified intact) */}
      <div id="section-market-evidence">
        <MarketEvidenceSection
          evidenceLinks={opp.evidenceLinks || []}
          publicationQualityStatus={opp.publicationQualityStatus}
          isDemoFixture={opp.isDemoFixture}
          confidenceScore={opp.confidenceScore}
        />
      </div>

      {/* 4. Customer Segments Section */}
      <CustomerSegmentsSection segments={blueprint.customerSegments} />

      {/* 5. Narrow MVP Scope Section */}
      <NarrowMvpSection features={blueprint.mvpFeatures} />

      {/* 6. Competition & Asymmetric Wedge Section */}
      <CompetitionWedgeSection competitors={blueprint.competitors} />

      {/* 7. Cost-Benefit Economics & Financial Scenarios */}
      <CostBenefitEconomicsSection blueprint={blueprint} />

      {/* 8. First 20 Customers Plan */}
      <First20CustomersPlan plan={blueprint.first20Plan} />

      {/* 9. Risks & Assumptions Register */}
      <RiskAssumptionMatrix risks={blueprint.risks} assumptions={blueprint.assumptions} />

      {/* 10. Validation Roadmap */}
      <ValidationRoadmap experiments={blueprint.validationExperiments} />
    </div>
  );
}
