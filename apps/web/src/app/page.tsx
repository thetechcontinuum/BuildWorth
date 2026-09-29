import React from "react";
import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { DiscoveryFeedSection } from "@/components/DiscoveryFeedSection";
import { HomeTopOpportunitiesClient } from "@/components/HomeTopOpportunitiesClient";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Activity className="w-3.5 h-3.5 animate-pulse" /> Radar Active: 4,120 Market Signals
          Analyzed
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Discover Startup Ideas Grounded in{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Verifiable Market Demand
          </span>
          .
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          No generic AI hallucinations. Every opportunity is discovered from recurring pain points,
          expensive workarounds, and documented willingness-to-pay.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all"
          >
            Explore Opportunities <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/methodology"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium transition-all"
          >
            Read Methodology
          </Link>
        </div>
      </section>

      {/* Featured Grid: Dynamically loaded verified opportunities */}
      <HomeTopOpportunitiesClient />

      {/* Discovery Feed Section: New ideas to explore */}
      <DiscoveryFeedSection />
    </div>
  );
}
