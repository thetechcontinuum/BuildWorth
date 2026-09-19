import React from "react";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { SourceManagementClient } from "@/components/sources/SourceManagementClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Source Management & Health — BuildWorth Admin",
  description: "Monitor and manage live data adapters, generic RSS feeds, and compliance restrictions.",
};

export default async function SourcesPage() {
  await requireServerAdmin();

  const sources = await prisma.source.findMany({
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Check configuration availability without exposing values
  const hasHnConfig = true; // Public API
  const hasRedditConfig = !!process.env.REDDIT_CLIENT_ID;
  const hasGithubConfig = !!process.env.GITHUB_PAT || !!process.env.GITHUB_TOKEN;
  const hasProductHuntConfig = !!process.env.PRODUCTHUNT_API_TOKEN;

  const sourcesWithMeta = sources.map((s) => {
    let configPresent = true;
    if (s.key === "reddit") configPresent = hasRedditConfig;
    if (s.key === "github") configPresent = hasGithubConfig;
    if (s.key === "producthunt") configPresent = hasProductHuntConfig;
    if (s.key === "e27") configPresent = false; // Blocked access

    return {
      id: s.id,
      key: s.key,
      name: s.name,
      description: s.description,
      baseUrl: s.baseUrl,
      adapterType: s.adapterType,
      accessMethod: s.accessMethod,
      sourceFamily: s.sourceFamily || "COMMUNITY",
      isEnabled: s.isEnabled,
      policyStatus: s.policyStatus,
      rateLimitPerMinute: s.rateLimitPerMinute,
      permittedExcerptLength: s.permittedExcerptLength,
      attributionRequired: s.attributionRequired,
      termsNotes: s.termsNotes,
      lastSuccessfulCollection: s.lastSuccessfulCollection ? s.lastSuccessfulCollection.toISOString() : null,
      lastRun: s.runs[0]
        ? {
            status: s.runs[0].status,
            signalsIngested: s.runs[0].signalsIngested,
            startedAt: s.runs[0].startedAt.toISOString(),
            errorMessage: s.runs[0].errorMessage,
          }
        : null,
      configPresent,
    };
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Source Registry & Adapters</h1>
        <p className="text-sm text-zinc-400">
          Monitor source adapters, pause/resume collection, test feeds with SSRF defense, and manage RSS feeds.
        </p>
      </div>

      <SourceManagementClient initialSources={sourcesWithMeta} />
    </div>
  );
}
