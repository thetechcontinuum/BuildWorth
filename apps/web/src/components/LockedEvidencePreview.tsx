import React from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

interface LockedEvidencePreviewProps {
  totalSignalsCount: number;
  previewLimit: number;
  isFeatureGated?: boolean;
}

/**
 * Preview component for free tiers with explicit note that real server entitlements govern access.
 */
export function LockedEvidencePreview({
  totalSignalsCount,
  previewLimit,
  isFeatureGated = false,
}: LockedEvidencePreviewProps) {
  if (!isFeatureGated || totalSignalsCount <= previewLimit) {
    return null;
  }

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-indigo-950/30 border border-indigo-500/30 text-center space-y-3">
      <div className="inline-flex items-center justify-center p-3 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
        <Lock className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-white">
          Viewing {previewLimit} of {totalSignalsCount} Verified Market Signals
        </h4>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Pro members unlock direct claim-to-signal citation graphs, historical trend telemetry, and
          raw source exports.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" /> Unlock All {totalSignalsCount} Verified Signals
        </Link>
      </div>
    </div>
  );
}
