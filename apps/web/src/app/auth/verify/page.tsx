"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.autoAuthenticated) {
        window.location.href = "/opportunities";
        return;
      }
      if (res.ok && data?.success) {
        setSentMagicLink(true);
      } else {
        setError(data?.message || data?.error || "Unable to sign in. Please try again.");
      }
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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

  if (!token) {
    return (
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
        <div className="w-12 h-12 bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-5 text-xl font-bold">
          BW
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-2">Sign In to BuildWorth</h1>

        {sentMagicLink ? (
          <p className="text-slate-400 text-sm mb-4">
            We sent a secure single-use login link to {email}.
          </p>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-4 text-left mt-4">
            <p className="text-slate-400 text-sm text-center mb-4">
              Enter your email address to sign in and access your account.
            </p>
            {error ? (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                {error}
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        )}

        <p className="text-xs text-slate-500 mt-6">
          Zero third-party tracking • Single-use cryptographic verification
        </p>
      </div>
    );
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
