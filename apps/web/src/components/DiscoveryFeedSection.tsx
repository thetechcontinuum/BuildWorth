"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  ExternalLink,
  Calendar,
  Globe,
  Tag,
  AlertCircle,
  Lightbulb,
  FileText,
  Clock,
} from "lucide-react";
import { DiscoveryFeedItemDTO, DiscoveryFeedResponseDTO } from "@buildworth/shared";

export function DiscoveryFeedSection() {
  const [data, setData] = useState<DiscoveryFeedResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFeed() {
      try {
        const res = await fetch("/api/discovery/feed?limit=5", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) setData(json);
        }
      } catch {
        // fail silently, keep fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFeed();
    return () => {
      isMounted = false;
    };
  }, []);

  const items = data?.items || [];
  const hasItemsToday = data?.hasItemsToday ?? false;

  return (
    <section className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">New Ideas to Explore</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Early problem signals and friction patterns detected from live sources. Early hypotheses, not yet fully verified under Policy v2.0.0.
          </p>
        </div>

        {!hasItemsToday && items.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 self-start sm:self-auto font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Showing latest authentic items</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse space-y-4"
            >
              <div className="h-4 bg-zinc-800 rounded w-1/3" />
              <div className="h-6 bg-zinc-800 rounded w-4/5" />
              <div className="h-16 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No New Early Ideas Collected Yet Today</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Ingestion runs are actively scanning authorized independent feeds. When fresh qualifying market friction is detected, genuine early ideas appear here automatically without fabricated placeholders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <DiscoveryCard key={item.id || item.slug} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function DiscoveryCard({ item }: { item: DiscoveryFeedItemDTO }) {
  const pubDateFormatted = item.publicationDate
    ? new Date(item.publicationDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

  const discoveredDateFormatted = item.discoveredAt
    ? new Date(item.discoveredAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Header badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <Tag className="w-3 h-3" />
            {item.verificationLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
            <Globe className="w-3 h-3 text-zinc-500" />
            {item.market}
          </span>
        </div>

        {/* Title and Short Summary */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-white leading-snug hover:text-indigo-400 transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{item.summary}</p>
        </div>

        {/* Section 1: Observed Evidence (Facts) */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Observed Market Evidence</span>
          </div>
          <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
            {item.observedFacts.map((fact, idx) => (
              <li key={idx} className="line-clamp-2 leading-relaxed">
                <span className="text-zinc-300">{fact}</span>
              </li>
            ))}
          </ul>
          {item.canonicalUrl && (
            <div className="pt-1.5 border-t border-zinc-900 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 truncate max-w-[180px]">{item.sourceTitle}</span>
              <a
                href={item.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Canonical Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Section 2: AI Business Hypothesis */}
        <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Business Hypothesis</span>
          </div>
          <div className="text-xs text-zinc-300 space-y-1">
            <div>
              <span className="text-zinc-500">Target Buyer:</span>{" "}
              <strong className="text-zinc-200">{item.businessHypothesis.targetAudience}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Proposed Angle:</span>{" "}
              <span className="text-zinc-300">{item.businessHypothesis.proposedSolution}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer dates */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-zinc-600" />
          <span>Source Date: <strong className="text-zinc-400 font-mono">{pubDateFormatted}</strong></span>
        </div>
        {discoveredDateFormatted && (
          <div className="text-[10px] text-zinc-600">
            Discovered: {discoveredDateFormatted}
          </div>
        )}
      </div>
    </div>
  );
}
