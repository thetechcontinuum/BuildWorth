"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialStep = parseInt(searchParams.get("step") || "1", 10) || 1;
  const [step, setStep] = useState(initialStep);
  const [skills, setSkills] = useState<string[]>(["TypeScript", "React", "Next.js", "PostgreSQL"]);
  const [budget, setBudget] = useState("USD_5K_TO_20K");
  const [capacity, setCapacity] = useState("HOURS_21_TO_35");
  const [industry, setIndustry] = useState("DevOps & Compliance");

  const totalSteps = 5;
  const progressPercent = Math.round((Math.min(step, 5) / totalSteps) * 100);

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      {/* Progress Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>STEP {step <= 5 ? step : 5} OF {totalSteps}: {step === 1 ? "GOALS" : step === 2 ? "CAPABILITIES" : step === 3 ? "RESOURCES" : step === 4 ? "MARKET ACCESS" : step === 5 ? "CONSTRAINTS" : "ANONYMOUS PREVIEW"}</span>
          <span>{progressPercent}% Complete</span>
        </div>
        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div className="h-full bg-indigo-600 transition-all duration-300 rounded-full" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Wizard Form Card */}
      <div className="p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-6 shadow-xl">
        {step === 6 && (
          <div data-testid="anonymous-preview-summary" className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
              <span className="font-semibold">PREVIEW MODE — Temporary &amp; Not Saved to Cloud</span>
              <span className="text-[11px] text-zinc-400 font-mono">Zero database rows created</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Your Anonymous Founder Profile Preview</h1>
              <p className="text-sm text-zinc-400">
                Personalized matches are calculated locally in your browser memory. Create a verified account to persist your profile revision and receive continuous match tracking.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Skills Captured:</span>
                <span className="text-zinc-200 font-medium">{skills.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Budget Range:</span>
                <span className="text-zinc-200 font-medium">$5,000 – $20,000 USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Weekly Commitment:</span>
                <span className="text-zinc-200 font-medium">21 – 35 hrs/wk</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Industry Preference:</span>
                <span className="text-zinc-200 font-medium">{industry}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href="/auth/verify"
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold text-center shadow-lg shadow-indigo-600/20"
              >
                Sign In to Save Profile &rarr;
              </a>
              <Link
                href="/opportunities"
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold text-center"
              >
                Browse Feed in Preview Mode
              </Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <div data-testid="onboarding-step-goals" className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">What markets and business models do you target?</h1>
              <p className="text-sm text-zinc-400">Personalize opportunity clustering to your preferred customer domain.</p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Target Industry / Domain</span>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="DevOps & Compliance">DevOps &amp; Compliance</option>
                  <option value="Data Engineering & FinOps">Data Engineering &amp; FinOps</option>
                  <option value="B2B SaaS RevOps">B2B SaaS RevOps</option>
                  <option value="AI Engineering & Ops">AI Engineering &amp; Ops</option>
                </select>
              </label>

              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-300">Privacy Notice:</span> We collect only business criteria required for venture matching. We never collect or infer sensitive personal data.
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">What are your core technical and product capabilities?</h1>
              <p className="text-sm text-zinc-400">Select skills where you have deep operational proficiency.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {["TypeScript", "React", "Next.js", "PostgreSQL", "Python", "Go", "Kubernetes", "AWS / Terraform"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSkills(skills.includes(s) ? skills.filter(k => k !== s) : [...skills, s])}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${skills.includes(s) ? "bg-indigo-600/10 border-indigo-500 text-indigo-300" : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">What capital and time runway do you have available?</h1>
              <p className="text-sm text-zinc-400">Matches opportunities within your realistic build capacity.</p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Available Budget for Milestone 1</span>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200"
                >
                  <option value="UNDER_1K">&lt; $1,000 USD (Hyper-lean)</option>
                  <option value="USD_1K_TO_5K">$1,000 – $5,000 USD</option>
                  <option value="USD_5K_TO_20K">$5,000 – $20,000 USD</option>
                  <option value="OVER_20K">$20,000+ USD</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Weekly Time Commitment</span>
                <select
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200"
                >
                  <option value="UNDER_10_HOURS">Side project (&lt; 10 hrs/wk)</option>
                  <option value="HOURS_10_TO_20">Part-time (10 – 20 hrs/wk)</option>
                  <option value="HOURS_21_TO_35">Substantial (21 – 35 hrs/wk)</option>
                  <option value="OVER_40_HOURS">Full-time (40+ hrs/wk)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">Do you have proprietary distribution advantages?</h1>
              <p className="text-sm text-zinc-400">Highlights unfair advantages in reaching your first 20 customers.</p>
            </div>

            <div className="space-y-3">
              {["Active Developer Community or Audience", "Existing Relationships with Target Economic Buyers", "Industry Partner or Procurement Channel"].map((asset, idx) => (
                <label key={idx} className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                  <input type="checkbox" defaultChecked={idx === 0} className="rounded text-indigo-600 focus:ring-0 bg-zinc-900 border-zinc-700" />
                  <span className="text-xs text-zinc-300 font-medium">{asset}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">What are your critical operational constraints?</h1>
              <p className="text-sm text-zinc-400">Prevents recommendations with incompatible regulatory or funding requirements.</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <span>Funding Strategy:</span>
                <span className="font-semibold text-indigo-400">Bootstrapped / Cash-Flow First</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Regulatory Risk Tolerance:</span>
                <span className="font-semibold text-zinc-200">Moderate (SOC2 acceptable)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sales Motion Preference:</span>
                <span className="font-semibold text-zinc-200">Product-Led / Founder-Led</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : step === 5 ? (
            <button
              onClick={() => setStep(6)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20"
            >
              Generate Anonymous Preview &rarr;
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-zinc-400 py-12 text-center text-sm">Loading onboarding...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
