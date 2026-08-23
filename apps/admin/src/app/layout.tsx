import "./globals.css";
import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Database,
  ListChecks,
  DollarSign,
  Activity,
  Lock,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "BuildWorth Admin & Review Portal",
  description: "Operations console for BuildWorth opportunity radar.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex bg-[#09090b] text-zinc-100 antialiased">
        <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-2 font-bold text-base">
              <div className="p-1 rounded bg-indigo-600 text-white font-mono text-xs">OPS</div>
              <span>Radar Console</span>
            </div>
            <nav className="space-y-1 text-sm font-medium text-zinc-400">
              <Link
                href="/"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <Activity className="w-4 h-4 text-indigo-400" /> Overview
              </Link>
              <Link
                href="/review-queue"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <ListChecks className="w-4 h-4" /> Review Queue
              </Link>
              <Link
                href="/problem-clusters"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <FolderGit2 className="w-4 h-4" /> Problem Spaces
              </Link>
              <Link
                href="/sources"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <Database className="w-4 h-4" /> Sources & Health
              </Link>
              <Link
                href="/ai-spend"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <DollarSign className="w-4 h-4" /> AI Spend & Caps
              </Link>
              <Link
                href="/kill-switches"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <ShieldAlert className="w-4 h-4" /> Kill-Switches
              </Link>
              <Link
                href="/evaluation"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" /> Evaluation Metrics
              </Link>
            </nav>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium pb-1">
              <Lock className="w-3.5 h-3.5" /> Auto-Publish: LOCKED
            </div>
            Manual sign-off mandatory.
          </div>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
