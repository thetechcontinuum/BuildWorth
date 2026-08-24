import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, DollarSign, Users, Wrench } from "lucide-react";
import { ScoreBadge, ConfidenceMeter } from "@buildworth/ui";
import { formatMoneyRange, ClaimType } from "@buildworth/shared";
import { getStoredOpportunityBySlug } from "@/lib/opportunity-store";
import { MarketEvidenceSection } from "@/components/MarketEvidenceSection";
import { ClaimEvidenceBadge } from "@/components/ClaimEvidenceBadge";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const opp = getStoredOpportunityBySlug(params.slug);
  return {
    title: `${opp ? opp.title : "Opportunity Blueprint"} — BuildWorth`,
    description: opp ? opp.summary : "In-depth 40-attribute startup opportunity blueprint.",
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
  const wtpCount = getClaimEvidenceCount("WILLINGNESS_TO_PAY");
  const feasibilityCount = getClaimEvidenceCount("TECHNICAL_FEASIBILITY");

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Feed
      </Link>

      {/* Header Summary Card */}
      <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded">
              {opp.industry} • {opp.customerType}
            </span>
            {opp.publicationQualityStatus === "VERIFIED" ? (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded">
                Verified Market Intelligence
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded">
                Hypothesis — Evidence not yet verified
              </span>
            )}
          </div>
          <ScoreBadge score={opp.opportunityScore} size="lg" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {opp.title}
          </h1>
          <p className="text-base text-zinc-300 leading-relaxed">{opp.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
          <div>
            <span className="text-zinc-500 block font-medium">Economic Buyer</span>
            <span className="text-zinc-200 font-semibold">{opp.buyer}</span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Est. MVP Build</span>
            <span className="text-zinc-200 font-mono font-semibold">
              {formatMoneyRange(opp.costRange)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Time to MVP</span>
            <span className="text-zinc-200 font-semibold">
              {opp.timeToMvpWeeks.min}–{opp.timeToMvpWeeks.max} Weeks
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block font-medium">Plausible Pricing</span>
            <span className="text-zinc-200 font-mono font-semibold">$149 - $399 /mo</span>
          </div>
        </div>

        <ConfidenceMeter confidence={opp.confidenceScore} />
      </div>

      {/* Structured Sections */}
      <div className="space-y-8">
        {/* Section 1: Problem & Jobs to be Done with Claim Citation Badges */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Problem Space & Workaround
            </h2>
            <div className="flex items-center gap-2">
              <ClaimEvidenceBadge claimType="PAIN_EXISTENCE" sourcesCount={painCount} />
              <ClaimEvidenceBadge claimType="BUYER_DEMAND" sourcesCount={buyerDemandCount} />
            </div>
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <div>
              <strong className="text-zinc-200">Existing Workaround:</strong>{" "}
              {opp.existingWorkflow || "Manual spreadsheets and scripts."}
            </div>
            <div>
              <strong className="text-zinc-200">Buying Trigger:</strong>{" "}
              {opp.buyingTrigger || "Quarterly audit deadline or executive review."}
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Jobs to be Done
            </span>
            <ul className="space-y-1.5 text-sm text-zinc-300">
              {(
                opp.jobsToBeDone || [
                  "Collect and verify compliance evidence automatically",
                  "Generate audit-ready reports without manual engineering hours",
                  "Alert team leads when unreviewed pull requests deploy",
                ]
              ).map((job, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span>{job}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 2: Core Market Evidence & Source Attribution (Prominently Placed) */}
        <MarketEvidenceSection
          evidenceLinks={opp.evidenceLinks || []}
          publicationQualityStatus={opp.publicationQualityStatus}
          isDemoFixture={opp.isDemoFixture}
          confidenceScore={opp.confidenceScore}
        />

        {/* Section 3: Proposed Product & MVP Scope */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-400" /> Proposed Product & Narrow MVP Scope
            </h2>
            <ClaimEvidenceBadge claimType="TECHNICAL_FEASIBILITY" sourcesCount={feasibilityCount} />
          </div>

          <ul className="space-y-1.5 text-sm text-zinc-300">
            {(
              opp.narrowMvpScope || [
                "Automated webhook ingestion adapter",
                "Real-time heuristic evaluation engine",
                "Dashboard with exportable audit packages",
              ]
            ).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 4: Competition & Differentiation */}
        <section className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-400" /> Competition & Buyer Willingness to
              Pay
            </h2>
            <ClaimEvidenceBadge claimType="WILLINGNESS_TO_PAY" sourcesCount={wtpCount} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {(
              opp.competitors || [
                {
                  name: "Incumbent Enterprise Platforms",
                  weakness: "Complex $15k+ annual contracts and heavy onboarding",
                },
                {
                  name: "Manual In-House Scripts",
                  weakness: "Fragile maintenance burden and high developer hourly cost",
                },
              ]
            ).map((comp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1"
              >
                <div className="font-semibold text-white">{comp.name}</div>
                <p className="text-xs text-zinc-400">{comp.weakness}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Recommended Next Validation Experiment */}
        <section className="p-6 rounded-xl bg-gradient-to-br from-indigo-950/30 to-zinc-900/40 border border-indigo-500/30 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-base">
            <ShieldCheck className="w-5 h-5" /> Recommended Next Validation Experiment
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{opp.recommendedExperiment}</p>
        </section>
      </div>
    </div>
  );
}
