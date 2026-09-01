"use client";

import React, { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import Link from "next/link";

interface WatchOpportunityButtonProps {
  opportunityId?: string;
  opportunitySlug: string;
  className?: string;
  size?: "sm" | "md";
}

export function WatchOpportunityButton({
  opportunityId,
  opportunitySlug,
  className = "",
  size = "sm",
}: WatchOpportunityButtonProps) {
  const [isWatched, setIsWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Check initial watch state from /api/watchlist
    async function checkWatchStatus() {
      try {
        const res = await fetch("/api/watchlist");
        if (res.status === 401) {
          setUserTier("ANONYMOUS");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setUserTier(data.userTier || "FREE");
          const existing = (data.watches || []).find(
            (w: any) =>
              w.opportunityId === opportunityId || w.opportunity?.slug === opportunitySlug,
          );
          if (existing) {
            setIsWatched(true);
            setWatchId(existing.id);
          }
        }
      } catch {
        // Ignored
      }
    }
    checkWatchStatus();
  }, [opportunityId, opportunitySlug]);

  const handleToggleWatch = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (userTier === "ANONYMOUS" || !userTier) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);

    if (isWatched && watchId) {
      // Unwatch
      try {
        const res = await fetch(`/api/watchlist/${watchId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          setIsWatched(false);
          setWatchId(null);
        }
      } catch (err) {
        console.error("Unwatch error", err);
      } finally {
        setLoading(false);
      }
    } else {
      // Watch
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityId: opportunityId || opportunitySlug,
            radarEnabled: true,
          }),
        });

        if (res.status === 403) {
          const data = await res.json();
          if (data.upgradeRequired) {
            setShowLimitModal(true);
          }
        } else if (res.ok) {
          const data = await res.json();
          setIsWatched(true);
          setWatchId(data.watch?.id || null);
        }
      } catch (err) {
        console.error("Watch error", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const btnClasses = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs font-semibold";

  return (
    <>
      <button
        onClick={handleToggleWatch}
        disabled={loading}
        data-testid="watch-opportunity-btn"
        className={`inline-flex items-center gap-1.5 rounded-lg border transition-all ${
          isWatched
            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30"
            : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        } ${btnClasses} ${className}`}
        title={isWatched ? "Watching on Radar (Click to unwatch)" : "Watch on Radar"}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isWatched ? (
          <>
            <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Watching</span>
          </>
        ) : (
          <>
            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
            <span>Watch Radar</span>
          </>
        )}
      </button>

      {/* Free Plan Limit Blocked Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Watchlist Limit Reached</h3>
            <p className="text-sm text-zinc-300">
              You can watch up to <strong>3 opportunities</strong> on the Free plan. Upgrade to{" "}
              <strong>Pro</strong> to monitor up to 50 opportunities and unlock instant radar change
              alerts.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLimitModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg border border-zinc-800"
              >
                Cancel
              </button>
              <Link
                href="/pricing"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous Auth Required Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Sign In to Watch</h3>
            <p className="text-sm text-zinc-300">
              Sign in with your email to add opportunities to your radar watchlist and receive
              automated change evaluations.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAuthModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg border border-zinc-800"
              >
                Cancel
              </button>
              <Link
                href="/onboarding"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
