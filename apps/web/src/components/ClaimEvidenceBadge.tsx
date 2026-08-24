"use client";

import React from "react";
import { ShieldCheck, HelpCircle, ExternalLink } from "lucide-react";
import { ClaimType } from "@buildworth/shared";

interface ClaimEvidenceBadgeProps {
  claimType: ClaimType;
  sourcesCount: number;
  onFilterClick?: (claimType: ClaimType) => void;
}

export function ClaimEvidenceBadge({
  claimType,
  sourcesCount,
  onFilterClick,
}: ClaimEvidenceBadgeProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (sourcesCount > 0 && onFilterClick) {
      e.preventDefault();
      onFilterClick(claimType);
      const target = document.getElementById("market-evidence-section");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  if (sourcesCount === 0) {
    return (
      <span
        title="Evidence not yet verified for this claim. Marked as hypothesis assumption."
        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full cursor-help"
      >
        <HelpCircle className="w-3 h-3 text-amber-400" />
        <span>Assumption</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      title={`Click to inspect ${sourcesCount} verified source signal${sourcesCount > 1 ? "s" : ""}`}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full hover:bg-emerald-500/20 transition-all cursor-pointer group"
    >
      <ShieldCheck className="w-3 h-3 text-emerald-400" />
      <span>
        {sourcesCount} {sourcesCount === 1 ? "source signal" : "source signals"}
      </span>
      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
