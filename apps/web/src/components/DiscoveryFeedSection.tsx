"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  Radio,
  Compass,
  RotateCw,
  FlaskConical,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  Layers,
  ShieldCheck,
  Zap,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  DiscoveryFeedItemDTO,
  MarketSignalFeedItemDTO,
  ResearchLeadFeedItemDTO,
  DiscoveryFeedResponseDTO,
  DailyThemeBriefDTO,
} from "@buildworth/shared";

export function DiscoveryFeedSection() {
  const [data, setData] = useState<DiscoveryFeedResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "leads" | "hypotheses">("signals");
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("buildworth_saved_items");
      if (stored) {
        setSavedItems(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  const handleToggleSave = async (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem("buildworth_saved_items", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: id }),
      });
    } catch {}
  };

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/feed?limit=6&signalsLimit=12", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load discovery feed (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to load discovery feed");
      }
      setData(json);
      if (Array.isArray(json.opportunityHypotheses) && json.opportunityHypotheses.length > 0) {
        setActiveTab("hypotheses");
      } else if (Array.isArray(json.researchLeads) && json.researchLeads.length > 0) {
        setActiveTab("leads");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while fetching discovery signals.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const marketSignals = data?.marketSignals || [];
  const researchLeads = data?.researchLeads || [];
  const hypotheses = data?.opportunityHypotheses || data?.items || [];
  const dailyBrief = data?.dailyBrief;
  const themes = dailyBrief?.themes || [];
  const currentTheme: DailyThemeBriefDTO | undefined = themes[selectedThemeIndex] || themes[0];
  const hasItemsToday = data?.hasItemsToday ?? false;

  return (
    <section className="space-y-8 pt-4">
      {/* 1. Personalized Daily Brief & Tracked Themes */}
      {dailyBrief && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">Personalized Daily Brief</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    {dailyBrief.date}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{dailyBrief.summary}</p>
              </div>
            </div>

            <Link
              href="/watchlist"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors self-start sm:self-auto border border-zinc-700/60"
            >
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>My Watchlist & Alerts</span>
            </Link>
          </div>

          {/* Tracked Theme Selection Tabs */}
          {themes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {themes.map((t, idx) => (
                  <button
                    key={t.theme}
                    onClick={() => setSelectedThemeIndex(idx)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                      selectedThemeIndex === idx
                        ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/10"
                        : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <span>{t.theme}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        selectedThemeIndex === idx
                          ? "bg-indigo-500/30 text-indigo-200"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {t.signalsCount + t.leadsCount + t.corroboratedCount}
                    </span>
                  </button>
                ))}
              </div>

              {/* Theme Intelligence Card */}
              {currentTheme && (
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/90 grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                  <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-white">{currentTheme.theme}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        {currentTheme.momentum}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-300">
                      <span className="text-zinc-500 font-medium">Top Observed Friction:</span>{" "}
                      <span className="text-zinc-200 font-medium">{currentTheme.topPainHeadline}</span>
                    </div>

                    <div className="text-xs text-indigo-300/90 leading-relaxed italic">
                      <span className="text-zinc-500 font-medium not-italic">Suggested Next Step:</span>{" "}
                      {currentTheme.suggestedValidationAction}
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800/60 text-center">
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Signals</div>
                      <div className="text-sm font-bold text-amber-400 font-mono">{currentTheme.signalsCount}</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Leads</div>
                      <div className="text-sm font-bold text-teal-400 font-mono">{currentTheme.leadsCount}</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Corroborated</div>
                      <div className="text-sm font-bold text-indigo-400 font-mono">{currentTheme.corroboratedCount}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Header & Feed Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Market Opportunity Feed</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Three distinct levels: raw market signals, uncorroborated research leads, and multi-source opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!hasItemsToday && (marketSignals.length > 0 || researchLeads.length > 0 || hypotheses.length > 0) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Showing latest authentic items</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Three Distinct Level Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("signals")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "signals"
              ? "border-amber-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Radio className="w-4 h-4 text-amber-400" />
          <span>Level 1: Market Signals</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 font-mono">
            {marketSignals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "leads"
              ? "border-teal-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <FlaskConical className="w-4 h-4 text-teal-400" />
          <span>Level 2: Research Leads</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 font-mono">
            {researchLeads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("hypotheses")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "hypotheses"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Compass className="w-4 h-4 text-indigo-400" />
          <span>Level 3: Corroborated Opportunities</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 font-mono">
            {hypotheses.length}
          </span>
        </button>
      </div>

      {/* 4. Tab Content */}
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
      ) : error ? (
        <div className="p-12 text-center rounded-xl bg-red-950/20 border border-red-900/40 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-900/30 text-red-400 mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Failed to Load Market Signals</h3>
          <p className="text-sm text-red-300/80 max-w-md mx-auto">{error}</p>
          <div className="pt-2">
            <button
              onClick={loadFeed}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white hover:border-zinc-600 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : activeTab === "signals" ? (
        /* Section 1: New Market Signals */
        marketSignals.length === 0 ? (
          <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No New Market Signals Collected Yet Today</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              The ingestion engine connects directly to authorized public sources (Hacker News, GitHub, KrASIA, Silicon Canals, Lobsters). When authentic signals are collected, they appear here immediately without fabricated content.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketSignals.map((sig) => (
              <MarketSignalCard
                key={sig.id}
                signal={sig}
                isSaved={savedItems.has(sig.id)}
                onToggleSave={() => handleToggleSave(sig.id)}
              />
            ))}
          </div>
        )
      ) : activeTab === "leads" ? (
        /* Section 2: Research Leads */
        researchLeads.length === 0 ? (
          <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
              <FlaskConical className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-base font-semibold text-white">No Research Leads Identified Yet Today</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Research leads surface recent signals describing concrete user friction, workarounds, or pain with an identifiable buyer and validation step, but lacking multi-source corroboration. Uncorroborated items are displayed here without inventing demand.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {researchLeads.map((lead) => (
              <ResearchLeadCard
                key={lead.id}
                item={lead}
                isSaved={savedItems.has(lead.id)}
                onToggleSave={() => handleToggleSave(lead.id)}
              />
            ))}
          </div>
        )
      ) : (
        /* Section 3: Corroborated Opportunities */
        hypotheses.length === 0 ? (
          <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-zinc-800/50 text-zinc-400 mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No Corroborated Opportunities Synthesized Yet Today</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Opportunity hypotheses require strong empirical evidence clusters from independent sources before synthesis under Policy v2.0.0. Hypotheses remain unverified until multi-source corroborating evidence is established.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hypotheses.map((item) => (
              <HypothesisCard
                key={item.id || item.slug}
                item={item}
                isSaved={savedItems.has(item.id)}
                onToggleSave={() => handleToggleSave(item.id)}
              />
            ))}
          </div>
        )
      )}

      {/* 5. Clear Free vs. Pro Value & Billing Transparency */}
      <div className="mt-12 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </span>
            <h4 className="text-sm font-bold text-white">Membership Value & Tier Clarity</h4>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            <strong>Free Membership:</strong> Daily public feed of market signals, top 3 research leads preview, 1 tracked theme, and daily web briefings.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            <strong>Pro Membership ($29/mo or $290/yr):</strong> Unlimited research leads, full validated opportunity blueprints (unit economics, 6-week MVP build scopes, customer interview scripts), unlimited theme tracking, real-time alert notifications on corroborating signals, and CSV/JSON export.
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            <span>Stripe Billing Status: Test Mode configured (never claims live payment processing unless verified).</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2 justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all text-center"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>View Pro Membership</span>
          </Link>
          <Link
            href="/watchlist"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 border border-zinc-700/60 transition-all text-center"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Configure Alerts</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function MarketSignalCard({
  signal,
  isSaved,
  onToggleSave,
}: {
  signal: MarketSignalFeedItemDTO;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const pubDateFormatted = signal.publishedAt
    ? new Date(signal.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

  return (
    <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Source and Market Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            {signal.sourceName}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
            <Globe className="w-3 h-3 text-zinc-500" />
            {signal.market}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-white leading-snug line-clamp-2">
          {signal.title}
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
          {signal.excerpt}
        </p>

        {/* Mandatory Label */}
        <div className="pt-2 flex items-center justify-between gap-2">
          <span className="inline-block text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
            {signal.label}
          </span>
        </div>
      </div>

      {/* Footer: Date, Canonical Link & Watchlist Action */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 gap-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-zinc-600" />
          <span>Source: <strong className="text-zinc-400 font-mono">{pubDateFormatted}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSave}
            title={isSaved ? "Saved in Watchlist" : "Save to Watchlist"}
            className={`p-1.5 rounded transition-colors ${
              isSaved
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
          {signal.canonicalUrl && (
            <a
              href={signal.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function HypothesisCard({
  item,
  isSaved,
  onToggleSave,
}: {
  item: DiscoveryFeedItemDTO;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const pubDateFormatted = item.publicationDate
    ? new Date(item.publicationDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

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
            {item.slug ? (
              <Link href={`/opportunities/${item.slug}`} className="hover:text-indigo-400 transition-colors">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
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
        <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-900/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Business Hypothesis</span>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                item.businessHypothesis.purchaseIntentStatus === "CONFIRMED"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700/60"
              }`}
            >
              {item.businessHypothesis.purchaseIntentStatus === "CONFIRMED"
                ? "Purchase Intent: Confirmed"
                : "Purchase Intent: Unknown"}
            </span>
          </div>

          <div className="text-xs text-zinc-300 space-y-2">
            <div>
              <span className="text-zinc-500 font-medium">Possible Buyer:</span>{" "}
              <strong className="text-zinc-200">{item.businessHypothesis.targetAudience}</strong>
            </div>
            <div>
              <span className="text-zinc-500 font-medium">Product Concept:</span>{" "}
              <span className="text-zinc-300">{item.businessHypothesis.proposedSolution}</span>
            </div>

            {item.businessHypothesis.assumptions && item.businessHypothesis.assumptions.length > 0 && (
              <div className="pt-1.5 border-t border-indigo-900/40">
                <span className="text-zinc-500 font-medium block mb-1">Key Assumptions:</span>
                <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside">
                  {item.businessHypothesis.assumptions.map((asm, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="text-zinc-300">{asm}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.businessHypothesis.validationExperiment && (
              <div className="pt-1.5 border-t border-indigo-900/40">
                <span className="text-zinc-500 font-medium block mb-0.5">Validation Experiment:</span>
                <p className="text-[11px] text-indigo-200/90 leading-relaxed italic">
                  {item.businessHypothesis.validationExperiment}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer dates & Save action */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 gap-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-zinc-600" />
          <span>Source Date: <strong className="text-zinc-400 font-mono">{pubDateFormatted}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          {item.slug && (
            <Link
              href={`/opportunities/${item.slug}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              <span>Full Brief</span>
            </Link>
          )}
          <button
            onClick={onToggleSave}
            title={isSaved ? "Saved in Watchlist" : "Save to Watchlist"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              isSaved
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            }`}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" /> : <Bookmark className="w-3.5 h-3.5" />}
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>
          {item.discoveredAt && (
            <div className="text-[10px] text-zinc-600 hidden sm:block">
              Discovered: {new Date(item.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearchLeadCard({
  item,
  isSaved,
  onToggleSave,
}: {
  item: ResearchLeadFeedItemDTO;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const pubDateFormatted = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

  const sourceEvidenceList = item.sourceEvidence || item.observedFacts || [];
  const likelyUsers = item.likelyAffectedUsers || item.plausibleBuyer || "Technical practitioners experiencing workflow friction";
  const validationExperiment = item.practicalValidationExperiment || item.concreteValidationStep;
  const gaps = item.evidenceGaps && item.evidenceGaps.length > 0 ? item.evidenceGaps : [
    "Single-source observation: lacks corroboration from independent sources or unrelated engineering teams",
    "Commercial willingness to pay is unverified: no explicit pricing signals, budgets, or purchasing commitments observed",
    "Recurrence across organizations is unproven: operational friction may be isolated to this specific setup",
  ];

  return (
    <div className="p-6 rounded-xl bg-zinc-900/60 border border-teal-900/40 hover:border-teal-700/60 transition-all flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Header badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
              UNVERIFIED
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/25">
              <FlaskConical className="w-3 h-3 text-teal-400" />
              {item.label}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
            <Globe className="w-3 h-3 text-zinc-500" />
            {item.market}
          </span>
        </div>

        {/* Title and Short Summary */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-white leading-snug hover:text-teal-400 transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{item.summary}</p>
        </div>

        {/* Section 1: Source Evidence */}
        <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Source Evidence (Observed Facts)</span>
          </div>
          <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
            {sourceEvidenceList.map((evidence, idx) => (
              <li key={idx} className="line-clamp-2 leading-relaxed">
                <span className="text-zinc-200">{evidence}</span>
              </li>
            ))}
          </ul>
          {item.canonicalUrl && (
            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 truncate max-w-[200px]">{item.sourceTitle || item.sourceName}</span>
              <a
                href={item.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium"
              >
                Canonical Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Section 2: Likely Affected Users */}
        <div className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/70 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Likely Affected Users</span>
          </div>
          <div className="text-xs text-zinc-300">
            <strong className="text-zinc-100">{likelyUsers}</strong>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Identified practitioners encountering this operational friction. Commercial buyer demand and willingness to pay are unverified.
            </p>
          </div>
        </div>

        {/* Section 3: Evidence Gaps */}
        <div className="p-3.5 rounded-lg bg-amber-950/15 border border-amber-900/30 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Evidence Gaps (What's Missing)</span>
          </div>
          <ul className="text-[11px] text-amber-200/80 space-y-1 list-disc list-inside">
            {gaps.map((gap, idx) => (
              <li key={idx} className="leading-relaxed">
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Section 4: Practical Validation Experiment */}
        {validationExperiment && (
          <div className="p-3.5 rounded-lg bg-teal-950/20 border border-teal-800/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300 uppercase tracking-wider">
              <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
              <span>Practical Validation Experiment</span>
            </div>
            <p className="text-xs text-teal-200/95 leading-relaxed italic">
              {validationExperiment}
            </p>
          </div>
        )}
      </div>

      {/* Footer dates & Save action */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 gap-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-zinc-600" />
          <span>Source Date: <strong className="text-zinc-400 font-mono">{pubDateFormatted}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSave}
            title={isSaved ? "Saved in Watchlist" : "Save to Watchlist"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              isSaved
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            }`}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-teal-400" /> : <Bookmark className="w-3.5 h-3.5" />}
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>
          {item.discoveredAt && (
            <div className="text-[10px] text-zinc-600 hidden sm:block">
              Discovered: {new Date(item.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
