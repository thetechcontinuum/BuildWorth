"use client";

import React, { useState } from "react";
import { UserPlus, X, Mail, User, Shield, AlertCircle, CheckCircle2 } from "lucide-react";

export function AddUserModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN" | "REVIEWER">("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    invitationSent?: boolean;
    testToken?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to invite user");
      } else {
        setResult({
          message: data.message,
          invitationSent: data.invitationSent,
          testToken: data.testToken,
        });
        // Clear inputs on success
        setEmail("");
        setName("");
        setRole("USER");
      }
    } catch {
      setError("Network error communicating with administration server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setResult(null);
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
      >
        <UserPlus className="w-4 h-4" /> Add User
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 id="add-user-modal-title" className="text-sm font-bold text-white tracking-tight">
                  Invite New User
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (result) window.location.reload();
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    result.invitationSent
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{result.message}</p>
                    {!result.invitationSent && (
                      <p className="text-[11px] text-amber-400/90 mt-1">
                        Notice: Email transport is not configured. The account was created in unverified state, but the email could not be delivered.
                      </p>
                    )}
                  </div>
                </div>

                {result.testToken && (
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      Localhost Test Token (Single-Use)
                    </span>
                    <div className="font-mono text-indigo-300 select-all break-all bg-zinc-950 p-2 rounded border border-zinc-800">
                      {result.testToken}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!result && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Full Name (Optional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Assigned Role *
                  </label>
                  <div className="relative">
                    <Shield className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="USER">USER (Standard Member)</option>
                      <option value="REVIEWER">REVIEWER (Opportunity Reviewer)</option>
                      <option value="ADMIN">ADMIN (Full Operations Administrator)</option>
                    </select>
                  </div>
                  {role === "ADMIN" && (
                    <p className="text-[11px] text-amber-400 mt-1.5">
                      Warning: Administrators possess unrestricted platform mutations and security visibility.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {loading ? "Inviting..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            )}

            {result && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    window.location.reload();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
