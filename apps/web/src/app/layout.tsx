import "./globals.css";
import React from "react";
import Link from "next/link";
import { Radar, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "BuildWorth — Startup Opportunity Radar",
  description: "Evidence-backed startup and B2B SaaS opportunity intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100 antialiased selection:bg-indigo-500 selection:text-white">
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Evidence Calibrated
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-900 bg-zinc-950/50 py-8 text-center text-xs text-zinc-500 space-y-2">
          <div className="flex justify-center gap-6 text-zinc-400">
            <Link href="/about" className="hover:text-zinc-200">
              About
            </Link>
            <Link href="/methodology" className="hover:text-zinc-200">
              Methodology
            </Link>
            <Link href="/pricing" className="hover:text-zinc-200">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-zinc-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-200">
              Terms
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} BuildWorth. Evidence-first startup market intelligence.
          </p>
        </footer>
      </body>
    </html>
  );
}
