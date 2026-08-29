"use client";

import React, { useState } from "react";
import { Download, FileText, Table, Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { LockedContentDescriptor } from "@buildworth/shared";
import Link from "next/link";

interface OpportunityExportControlsProps {
  slug: string;
  isLocked: boolean;
  exportLockDescriptor?: LockedContentDescriptor;
  initialShowUpgradeModal?: boolean;
}

export function OpportunityExportControls({
  slug,
  isLocked,
  exportLockDescriptor,
  initialShowUpgradeModal = false,
}: OpportunityExportControlsProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<"PDF" | "CSV" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(() => {
    if (initialShowUpgradeModal) return true;
    if (typeof window !== "undefined") {
      const url = new URLSearchParams(window.location.search);
      return url.get("modal") === "export_blocked" || url.get("view") === "export_modal";
    }
    return false;
  });

  const handleExport = async (format: "PDF" | "CSV") => {
    if (isLocked) {
      setShowUpgradeModal(true);
      return;
    }

    setDownloadingFormat(format);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/opportunities/${slug}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, opportunitySlug: slug }),
      });

      if (res.status === 401 || res.status === 403) {
        const err = await res.json();
        if (err.error?.includes("PRO_REQUIRED") || err.upgradeRequired) {
          setShowUpgradeModal(true);
        } else {
          setErrorMsg(err.error || "Export quota exceeded.");
        }
        setDownloadingFormat(null);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed." }));
        setErrorMsg(err.error || "Failed to generate export.");
        setDownloadingFormat(null);
        return;
      }

      // Download file blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-blueprint.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMsg(`Successfully generated ${format} dossier.`);
    } catch {
      setErrorMsg("Network error occurred during export generation.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleExport("PDF")}
          disabled={downloadingFormat !== null}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            isLocked
              ? "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border-zinc-700"
              : "bg-indigo-600/90 hover:bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
          }`}
          aria-label="Export Decision Report PDF"
        >
          {downloadingFormat === "PDF" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isLocked ? (
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          PDF Dossier
        </button>

        <button
          onClick={() => handleExport("CSV")}
          disabled={downloadingFormat !== null}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            isLocked
              ? "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border-zinc-700"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
          }`}
          aria-label="Export Structured Data CSV"
        >
          {downloadingFormat === "CSV" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isLocked ? (
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <Table className="w-3.5 h-3.5" />
          )}
          CSV Export
        </button>
      </div>

      <div aria-live="polite" className="text-xs">
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-rose-400 bg-rose-950/40 border border-rose-800/50 p-2 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 p-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Blocked Export Upgrade Modal */}
      {showUpgradeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md bg-zinc-900 border border-indigo-500/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400">
              <Download className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 id="upgrade-modal-title" className="text-xl font-bold text-white tracking-tight">
                Unlock Pro Exports
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {exportLockDescriptor?.previewTeaser ||
                  "Decision-grade PDF dossiers and structured CSV datasets are reserved for Pro members. Export unlimited immutable blueprints and financial models."}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
              >
                Upgrade to Pro ($19/mo)
              </Link>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
