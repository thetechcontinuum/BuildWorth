"use client";

import React, { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface RoleManagerProps {
  userId: string;
  userEmail: string;
  currentRole: "USER" | "ADMIN" | "REVIEWER";
  currentAdminEmail: string;
}

export function RoleManager({
  userId,
  userEmail,
  currentRole,
  currentAdminEmail,
}: RoleManagerProps) {
  const [selectedRole, setSelectedRole] = useState<"USER" | "ADMIN" | "REVIEWER">(currentRole);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedTargetEmail, setConfirmedTargetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSelf = userEmail.toLowerCase() === currentAdminEmail.toLowerCase();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as "USER" | "ADMIN" | "REVIEWER";
    setSelectedRole(newRole);
    setError(null);
    setSuccess(null);

    if (newRole === "ADMIN") {
      // Require explicit confirmation for ADMIN promotion
      setShowConfirmModal(true);
      setConfirmedTargetEmail("");
    } else {
      executeChange(newRole, false);
    }
  };

  const executeChange = async (newRole: string, confirmAdminPromotion: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          role: newRole,
          confirmAdminPromotion,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update role");
        setSelectedRole(currentRole);
      } else {
        setSuccess(
          data.sessionsRevokedCount > 0
            ? `${data.message} (${data.sessionsRevokedCount} active sessions terminated)`
            : data.message,
        );
        setShowConfirmModal(false);
        // Refresh after short delay so new role is reflected in server component
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch {
      setError("Network error communicating with administration server.");
      setSelectedRole(currentRole);
    } finally {
      setLoading(false);
    }
  };

  const confirmAdmin = () => {
    if (confirmedTargetEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setError(`Confirmation mismatch: Please type "${userEmail}" exactly to confirm.`);
      return;
    }
    executeChange("ADMIN", true);
  };

  if (isSelf) {
    return (
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <Shield className="w-4 h-4 text-zinc-500" />
          <span>Role Management Locked</span>
        </div>
        <p className="text-zinc-500 text-[11px]">
          You are signed in as this administrator ({currentAdminEmail}). You cannot modify your own role through the administration interface.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <select
            value={selectedRole}
            disabled={loading}
            onChange={handleRoleChange}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="USER">USER (Standard Member)</option>
            <option value="REVIEWER">REVIEWER (Opportunity Reviewer)</option>
            <option value="ADMIN">ADMIN (Operations Administrator)</option>
          </select>
        </div>
        {loading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />}
      </div>

      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-admin-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 id="confirm-admin-title" className="text-sm font-bold text-white tracking-tight">
                Confirm Administrator Promotion
              </h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              You are about to promote <strong className="text-white font-mono">{userEmail}</strong> from{" "}
              <span className="font-mono text-zinc-400">{currentRole}</span> to{" "}
              <strong className="text-rose-400 font-mono">ADMIN</strong>.
            </p>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              Administrators receive full operations access including viewing audit logs, triggering ingestion pipelines, managing kill switches, and modifying user roles.
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Type the target email to confirm:
              </label>
              <input
                type="text"
                value={confirmedTargetEmail}
                onChange={(e) => setConfirmedTargetEmail(e.target.value)}
                placeholder={userEmail}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedRole(currentRole);
                }}
                className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || confirmedTargetEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
                onClick={confirmAdmin}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {loading ? "Promoting..." : "Confirm & Grant Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
