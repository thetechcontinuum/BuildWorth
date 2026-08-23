"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Radar, ShieldCheck, User, LogOut, Sparkles, X, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function HeaderNav() {
  const { user, login, logout, isAuthModalOpen, openAuthModal, closeAuthModal } = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [sentMagicLink, setSentMagicLink] = useState(false);

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    setSentMagicLink(true);
    setTimeout(() => {
      login(loginEmail, "PRO");
      setSentMagicLink(false);
      setLoginEmail("");
    }, 1200);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Radar className="w-5 h-5" />
              </div>
              <span>
                Build<span className="text-indigo-400">Worth</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
              <Link href="/opportunities" className="hover:text-zinc-100 transition-colors">
                Opportunities
              </Link>
              <Link href="/compare" className="hover:text-zinc-100 transition-colors">
                Compare
              </Link>
              <Link href="/methodology" className="hover:text-zinc-100 transition-colors">
                Methodology
              </Link>
              <Link href="/pricing" className="hover:text-zinc-100 transition-colors">
                Pricing
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Evidence Calibrated
            </span>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="font-medium hidden sm:inline">{user.email}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white font-bold text-[10px]">
                    {user.tier}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sign In / Magic Link Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={closeAuthModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!sentMagicLink ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" /> Subscriber Portal
                  </div>
                  <h3 className="text-xl font-bold text-white">Sign In to BuildWorth</h3>
                  <p className="text-xs text-zinc-400">
                    Enter the email you used for your subscription to access all 40-attribute venture blueprints.
                  </p>
                </div>

                <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Subscriber Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="founder@company.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Send Instant Login Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block text-center">
                    Instant Demo Login (Test Subscription)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => login("subscriber@buildworth.io", "PRO")}
                      className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Login as Pro Member
                    </button>
                    <button
                      onClick={() => login("studio@continuum.io", "TEAM")}
                      className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
                    >
                      Login as Team Studio
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Logging You In...</h3>
                  <p className="text-xs text-zinc-400">
                    Magic link verified. Activating your Pro subscriber session.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
