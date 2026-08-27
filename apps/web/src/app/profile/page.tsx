"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, Trash2, Edit3, ArrowLeft, CheckCircle2 } from "lucide-react";

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialModal = searchParams.get("modal") === "delete";
  const [showDeleteModal, setShowDeleteModal] = useState(initialModal);
  const [isDeleted, setIsDeleted] = useState(false);

  if (isDeleted) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white">Profile Successfully Deleted</h1>
        <p className="text-sm text-zinc-400">
          All your personal matching criteria and historical evaluations have been permanently
          removed.
        </p>
        <div className="pt-4">
          <Link
            href="/opportunities"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
          >
            Return to Public Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="founder-profile-management" className="max-w-4xl mx-auto py-8 space-y-8">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Feed
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Founder Profile & Personalization
          </h1>
          <p className="text-sm text-zinc-400">
            Active Revision: #1 (Created 2026-08-25) • Schema v1.0.0
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Profile
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-semibold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Profile
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase">
            <span>Core Capabilities</span>
            <span className="text-indigo-400 font-semibold">4 Skills</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "TypeScript (Expert)",
              "React (Advanced)",
              "PostgreSQL (Working)",
              "DevOps (Working)",
            ].map((s) => (
              <span
                key={s}
                className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase">
            <span>Resource Allocation</span>
            <span className="text-emerald-400 font-semibold">Milestone 1</span>
          </div>
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Available Budget:</span>
              <span className="font-mono text-zinc-200 font-medium">$5,000 – $20,000 USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Weekly Commitment:</span>
              <span className="font-mono text-zinc-200 font-medium">21 – 35 hrs/wk</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Structure:</span>
              <span className="text-zinc-200 font-medium">Solo Founder</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="profile-deletion-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Confirm Profile Deletion</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              This action permanently deletes your founder matching profile, skill competencies, and
              personalized recommendations. Public opportunity data and evidence will remain
              unaffected.
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setIsDeleted(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileManagementPage() {
  return (
    <Suspense
      fallback={<div className="text-zinc-400 py-12 text-center text-sm">Loading profile...</div>}
    >
      <ProfileContent />
    </Suspense>
  );
}
