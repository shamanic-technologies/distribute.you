"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import confetti from "canvas-confetti";

const PROMO_KEY = "distribute_promo_code";

export default function ClaimPage() {
  const { signUp, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const [loading, setLoading] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const handleClaim = async () => {
    if (!isLoaded || isSignedIn) return;
    setLoading(true);
    try {
      sessionStorage.setItem("distribute_auth_intent", "signup");
      sessionStorage.setItem(PROMO_KEY, code);
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (error) {
      console.error("[dashboard] Claim sign-up error:", error);
      setLoading(false);
    }
  };

  if (isSignedIn) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="w-full max-w-sm text-center">
        <Link href="https://distribute.you" className="inline-flex items-center gap-2 mb-8">
          <Image src="/logo-head.jpg" alt="distribute" width={36} height={36} className="rounded-lg" />
          <span className="font-display font-bold text-xl text-gray-900">distribute</span>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl">🎉</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
            You&apos;ve won $10 in free credits
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Use them to automate your distribution — outreach, emails, and every touchpoint in between.
          </p>

          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-4 py-3.5 font-semibold hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin text-white/70" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#fff" fillOpacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#fff" fillOpacity="0.7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#fff" fillOpacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#fff" fillOpacity="0.8" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? "Creating account..." : "Claim my credit"}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Sign up with Google to claim your free credits
          </p>
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-indigo-500 hover:text-indigo-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
