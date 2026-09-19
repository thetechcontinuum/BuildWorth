"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles, Archive, Edit3, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface Props {
  opportunity: any;
}

export function DraftDetailEditor({ opportunity }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(opportunity.title);
  const [problemStatement, setProblemStatement] = useState(opportunity.problemStatement);
  const [proposedProduct, setProposedProduct] = useState(opportunity.proposedProduct);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSaveRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setFeedback({ success: false, message: "Please provide an editorial reason (at least 5 characters)" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/drafts/${opportunity.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          action: "CREATE_REVISION",
          title,
          problemStatement,
          proposedProduct,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ success: false, message: data.error || "Failed to update draft" });
      } else {
        setFeedback({ success: true, message: "New audited revision created successfully!" });
        setIsEditing(false);
        setReason("");
        router.refresh();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    const archiveReason = prompt("Reason for archiving this draft opportunity (required):");
    if (!archiveReason || archiveReason.trim().length < 5) {
      alert("Archiving cancelled: reason must be at least 5 characters.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/drafts/${opportunity.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          action: "ARCHIVE",
          reason: archiveReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ success: false, message: data.error || "Failed to archive opportunity" });
      } else {
        setFeedback({ success: true, message: "Opportunity marked as ARCHIVED. Citations and signals retained." });
        router.refresh();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              opportunity.status === "ARCHIVED"
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {opportunity.status}
          </span>
          <span className="text-xs text-zinc-400">
            Revisions: <strong className="text-white">{opportunity.revisions?.length || 1}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {opportunity.status !== "ARCHIVED" && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> {isEditing ? "Cancel Edit" : "Edit & Create Revision"}
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" /> Archive Opportunity
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Editor Form if isEditing */}
      {isEditing && (
        <form onSubmit={handleSaveRevision} className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-700 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
            <Edit3 className="w-4 h-4" /> Editorial Revision Form
          </div>
          <p className="text-xs text-zinc-400">
            Modifications will create an atomic revision record and persist an audit log entry.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Opportunity Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Problem Statement</label>
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Proposed Product Solution</label>
              <textarea
                value={proposedProduct}
                onChange={(e) => setProposedProduct(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-amber-300 block mb-1">
                Reason for Change (Required for Audit Log) *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Refined customer problem definition after market comparison"
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/40 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Creating Revision..." : "Save Revision"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
