import "./globals.css";
import React from "react";
import Link from "next/link";
import { AuthProvider } from "@/context/AuthContext";
import { HeaderNav } from "@/components/HeaderNav";

export const metadata = {
  title: "BuildWorth — Startup Opportunity Radar",
  description: "Evidence-backed startup and B2B SaaS opportunity intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100 antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>
          <HeaderNav />
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
        </AuthProvider>
      </body>
    </html>
  );
}
