"use client";

import React, { useState } from "react";
import { ClaimEvidenceLinkItem, ClaimType, PublicationQualityStatus } from "@buildworth/shared";
import { ShieldCheck, Calendar, CheckCircle2, HelpCircle, ExternalLink } from "lucide-react";
import { LockedEvidencePreview } from "./LockedEvidencePreview";

interface MarketEvidenceSectionProps {
  evidenceLinks: ClaimEvidenceLinkItem[];
  publicationQualityStatus: PublicationQualityStatus;
  isDemoFixture: boolean;
  confidenceScore: number;
  selectedFilter?: ClaimType | "ALL" | "CONTRADICTING";
}

export function MarketEvidenceSection({
  evidenceLinks = [],
  publicationQualityStatus,
  isDemoFixture,
  confidenceScore,
  selectedFilter: initialFilter = "ALL",
}: MarketEvidenceSectionProps) {
  const [filter, setFilter] = useState<string>(initialFilter);

  const verifiedLinks = evidenceLinks.filter(
    (l) =>
      l.signal &&
      l.signal.verificationStatus === "VERIFIED" &&
      l.signal.evidenceOrigin !== "SYNTHETIC_FIXTURE" &&
      l.signal.evidenceOrigin !== "LEGACY_UNCLASSIFIED",
  );

  const totalVerifiedCount = verifiedLinks.length;
  const contradictingCount = verifiedLinks.filter(
    (l) => l.relationshipType === "CONTRADICTS",
  ).length;

  const uniqueSourceGroups = new Set(
    verifiedLinks.map((l) => l.signal?.independenceKey || `id:${l.signal?.id}`),
  );
  const uniqueFamilies = new Set(
    verifiedLinks.map((l) => l.signal?.sourceFamily || "COMMUNITY").filter(Boolean),
  );

  // Direct buyer intent
  const buyerIntentCount = verifiedLinks.filter(
    (l) =>
      l.signal?.signalType === "PURCHASE_INTENT" ||
      l.signal?.signalType === "WILLINGNESS_TO_PAY" ||
      l.signal?.purchaseIntent === true,
  ).length;

  // Filtered links
  const displayedLinks = verifiedLinks.filter((l) => {
    if (filter === "ALL") return true;
    if (filter === "CONTRADICTING") return l.relationshipType === "CONTRADICTS";
    return l.claimType === filter;
  });

  return (
    <section id="market-evidence-section" className="space-y-6 scroll-mt-20">
      {/* Header with Title & Quality Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Market Evidence & Source
              Attribution
            </h2>
            {isDemoFixture && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 rounded-full">
                DEMO TEST FIXTURE
              </span>
            )}
            {publicationQualityStatus === "VERIFIED" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                VERIFIED STATUS
              </span>
            ) : publicationQualityStatus === "PARTIALLY_VERIFIED" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 rounded-full">
                PARTIALLY VERIFIED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                <HelpCircle className="w-3 h-3 text-amber-400" />
                HYPOTHESIS STAGE
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Every claim is attributed to verified source signals. Zero synthetic data or unverified
            assumptions are counted toward verification.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider font-sans">
              Evidence Confidence
            </span>
            <span className="text-emerald-400 font-bold text-base">{confidenceScore}%</span>
          </div>
        </div>
      </div>

      {/* Top Evidence Summary Metrics Bar */}
      {totalVerifiedCount > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs">
          <div className="space-y-0.5">
            <span className="text-zinc-500 block">Verified Signals</span>
            <span className="text-emerald-400 font-bold font-mono text-sm">
              {totalVerifiedCount}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-zinc-500 block">Independent Sources</span>
            <span className="text-zinc-200 font-bold font-mono text-sm">
              {uniqueSourceGroups.size} Groups
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-zinc-500 block">Source Families</span>
            <span className="text-zinc-200 font-bold font-mono text-sm">
              {uniqueFamilies.size} Families
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-zinc-500 block">Direct Buyer Intent</span>
            <span className="text-indigo-400 font-bold font-mono text-sm">
              {buyerIntentCount} Signals
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-zinc-500 block">Contradictions</span>
            <span
              className={
                contradictingCount > 0
                  ? "text-amber-400 font-bold font-mono text-sm"
                  : "text-zinc-500 font-mono text-sm"
              }
            >
              {contradictingCount} Contradicting
            </span>
          </div>
        </div>
      ) : null}

      {/* Filter Tabs */}
      {totalVerifiedCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "ALL"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            All Verified ({totalVerifiedCount})
          </button>
          <button
            onClick={() => setFilter("PAIN_EXISTENCE")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "PAIN_EXISTENCE"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            Pain Existence
          </button>
          <button
            onClick={() => setFilter("BUYER_IDENTITY")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "BUYER_IDENTITY"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            Buyer Identity
          </button>
          <button
            onClick={() => setFilter("BUYER_DEMAND")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "BUYER_DEMAND"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            Buyer Demand
          </button>
          <button
            onClick={() => setFilter("WILLINGNESS_TO_PAY")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "WILLINGNESS_TO_PAY"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            Willingness to Pay
          </button>
          <button
            onClick={() => setFilter("TECHNICAL_FEASIBILITY")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === "TECHNICAL_FEASIBILITY"
                ? "bg-zinc-800 text-white border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            Technical Feasibility
          </button>
          {contradictingCount > 0 && (
            <button
              onClick={() => setFilter("CONTRADICTING")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "CONTRADICTING"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              Contradictions ({contradictingCount})
            </button>
          )}
        </div>
      )}

      {/* Verified Evidence Cards */}
      {totalVerifiedCount > 0 ? (
        <div className="space-y-4">
          {displayedLinks.map((link) => {
            const sig = link.signal;
            if (!sig) return null;

            const isContradiction = link.relationshipType === "CONTRADICTS";

            return (
              <div
                key={link.id}
                className={`p-5 rounded-xl border transition-all ${
                  isContradiction
                    ? "bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50"
                    : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700"
                } space-y-4`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white bg-zinc-800 px-2.5 py-1 rounded">
                      {sig.sourceName || "Public Source"}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800">
                      {sig.credibilityTier === "TIER_1_PRIMARY"
                        ? "Tier 1: Primary Evidence"
                        : sig.credibilityTier === "TIER_2_CREDIBLE_PUBLIC"
                          ? "Tier 2: Credible Public Signal"
                          : "Tier 3: Secondary Market Signal"}
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      {sig.signalType.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {sig.publishedAt
                        ? new Date(sig.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Date unrecorded"}
                    </span>
                  </div>
                </div>

                {/* Plain Text Excerpt */}
                <blockquote className="text-sm text-zinc-200 bg-zinc-950/60 p-3.5 rounded-lg border-l-2 border-indigo-500 leading-relaxed font-sans">
                  "{sig.sanitizedExcerpt}"
                </blockquote>

                {/* Attribution Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">
                      Source Attribution / Author
                    </span>
                    <span className="text-zinc-300 font-medium">
                      {sig.authorOrg || sig.actorRole || "Identified Practitioner"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Claim Relationship</span>
                    <span
                      className={`font-medium ${isContradiction ? "text-amber-400" : "text-emerald-400"}`}
                    >
                      {isContradiction ? "⚠️ Contradicts" : "✓ Supports"}{" "}
                      {link.claimType.replace(/_/g, " ")} ({link.supportStrength} Strength)
                    </span>
                  </div>
                </div>

                {link.explanation && (
                  <p className="text-xs text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                    <strong className="text-zinc-300">Methodology Note:</strong> {link.explanation}
                  </p>
                )}

                {/* Safe External Link */}
                {sig.canonicalUrl && (
                  <div className="pt-1 flex items-center justify-between border-t border-zinc-800/60 text-xs">
                    <span className="text-[11px] text-zinc-500">
                      Verified via {sig.verificationMethod || "Automated Source Validation"}
                    </span>
                    <a
                      href={sig.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      <span>View original source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}

          <LockedEvidencePreview
            totalSignalsCount={totalVerifiedCount}
            previewLimit={3}
            isFeatureGated={false}
          />
        </div>
      ) : (
        /* Empty / Hypothesis State */
        <div className="p-8 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800 text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-white">
              Hypothesis — Evidence not yet verified
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This startup opportunity blueprint is in the hypothesis stage. While the problem
              statement, jobs to be done, and unit economics are synthesized, no primary source
              citations have met the strict verification gate yet.
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 font-mono">
              0 verified signals counted • Evidence pending verification
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
