"use client";

import React from "react";
import { AlertTriangle, ShieldCheck, LogOut } from "lucide-react";

export interface EnvironmentBannerProps {
  adminEmail?: string;
}

export function EnvironmentBanner({ adminEmail }: EnvironmentBannerProps) {
  const isProduction =
    process.env.NEXT_PUBLIC_BUILDWORTH_ENV === "production" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  };

  return (
    <div className={`w-full px-6 py-2 border-b flex items-center justify-between text-xs font-medium ${
      isProduction
        ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
        : "bg-amber-950/40 border-amber-500/30 text-amber-300"
    }`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          isProduction
            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
        }`}>
          <AlertTriangle className="w-3 h-3" />
          {isProduction ? "PRODUCTION ENVIRONMENT" : "STAGING / DEV ENVIRONMENT"}
        </span>
        <span className="hidden sm:inline text-zinc-400">
          {isProduction
            ? "Production safety guards active. Ingestion mutations disabled."
            : "Isolated development environment. Manual test ingestion permitted."}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {adminEmail && (
          <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{adminEmail}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          title="Sign out of Administrator Console"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  );
}
