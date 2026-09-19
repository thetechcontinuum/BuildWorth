import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { ScoreBadge } from "@buildworth/ui";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Opportunity Review Queue — BuildWorth Admin",
  description: "Human-in-the-loop manual review queue for synthesized startup opportunities.",
};

export default async function ReviewQueuePage() {
  await requireServerAdmin();

  const pendingReviews = await prisma.opportunity.findMany({
    where: { status: { in: ["DRAFT", "IN_REVIEW"] }, isDemoFixture: false },
    include: {
      scorecards: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manual Review Queue</h1>
          <p className="text-sm text-zinc-400">
            Strict human verification before public publishing.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {pendingReviews.length} Opportunities Awaiting Review
        </span>
      </div>

      <div className="space-y-4">
        {pendingReviews.map((item) => {
          const score = item.scorecards[0]?.opportunityScore ?? 0;
          return (
            <div
              key={item.id}
              className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                      {item.industry}
                    </span>
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Adversarial Critic Passed
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white">{item.title}</h2>
                  <p className="text-sm text-zinc-400">{item.oneSentenceSummary}</p>
                </div>
                <div className="flex items-center gap-4">
                  <ScoreBadge score={score} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                <div>
                  <span className="text-zinc-500">Economic Buyer: </span>
                  <span className="text-zinc-200 font-medium">{item.economicBuyer}</span>
                </div>
                <Link
                  href={`/drafts/${item.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                  Review Draft <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
