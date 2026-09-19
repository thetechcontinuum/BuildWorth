import React from "react";
import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { LockedContentDescriptor } from "@buildworth/shared";

interface LockedSectionPaywallProps {
  descriptor: LockedContentDescriptor;
  title: string;
  className?: string;
}

export function LockedSectionPaywall({ descriptor, title, className = "" }: LockedSectionPaywallProps) {
  const isUnauthenticated = descriptor.reason === "UNAUTHENTICATED";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-8 text-center backdrop-blur-md shadow-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
          <Lock className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            PRO INTELLIGENCE
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
          {descriptor.previewTeaser && (
            <p className="text-xs text-zinc-400 leading-relaxed">{descriptor.previewTeaser}</p>
          )}
        </div>

        <div className="pt-2">
          {isUnauthenticated ? (
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
            >
              Sign In to Unlock Full Blueprint <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
            >
              Upgrade to Pro for Full Access <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <p className="text-[11px] text-zinc-500 mt-2">
            Includes full financial models, customer segments, radar monitoring, and PDF/CSV exports.
          </p>
        </div>
      </div>
    </div>
  );
}
