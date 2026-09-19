"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmVerification() {
    if (!token || token.length < 32) {
      setError("Invalid or malformed verification link.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "TOKEN_EXPIRED"
            ? "This magic link has expired. Please request a new one."
            : "This link has already been used or is invalid.",
        );
        setLoading(false);
        return;
      }

      router.push("/profile");
    } catch {
      setError("An unexpected error occurred during verification. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
      <div className="w-12 h-12 bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-5 text-xl font-bold">
        BW
      </div>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">Confirm Your Sign-In</h1>

      <p className="text-slate-400 text-sm mb-6">
        To protect your security against automated email scanners, please confirm you want to sign
        in to BuildWorth.
      </p>

      {error ? (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-sm mb-6 text-left">
          <div className="font-semibold text-red-200 mb-1">Verification Notice</div>
          <div>{error}</div>
          <div className="mt-3">
            <a
              href="/onboarding"
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Request a new sign-in link &rarr;
            </a>
          </div>
        </div>
      ) : null}

      <button
        onClick={handleConfirmVerification}
        disabled={loading || !token}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
      >
        {loading ? <span>Securing Session...</span> : <span>Continue to BuildWorth &rarr;</span>}
      </button>

      <p className="text-xs text-slate-500 mt-6">
        Zero third-party tracking • Single-use cryptographic verification
      </p>
    </div>
  );
}

export default function VerifyLandingPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Suspense
        fallback={<div className="text-slate-400 text-sm">Loading security verification...</div>}
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
