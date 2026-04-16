"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const { signUp, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  const handleGoogleSignUp = async () => {
    if (!isLoaded || isSignedIn) return;
    setLoading(true);
    try {
      sessionStorage.setItem("distribute_auth_intent", "signup");
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (error) {
      console.error("Sign up error:", error);
      setLoading(false);
    }
  };

  if (isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 text-white flex-col justify-between p-12">
        <div>
          <Link href="https://distribute.you" className="flex items-center gap-3">
            <Image src="/logo-head.jpg" alt="distribute" width={36} height={36} className="rounded-lg" />
            <span className="font-display font-bold text-xl">distribute</span>
            <span className="text-[10px] text-white/80 font-medium bg-white/10 px-1.5 py-0.5 rounded uppercase">beta</span>
          </Link>
        </div>
        <div>
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">The Stripe for Distribution</p>
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            Your distribution,<br />automated.
          </h2>
          <p className="text-gray-400 text-lg max-w-md">
            Give us your URL. We handle outreach, emails, and every touchpoint in between.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Zero config
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            No markup pricing
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Data-driven
          </div>
        </div>
      </div>

      {/* Right: Sign-up form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-white to-gray-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <Link href="https://distribute.you" className="flex items-center gap-2">
              <Image src="/logo-head.jpg" alt="distribute" width={32} height={32} className="rounded-lg" />
              <span className="font-display font-bold text-lg text-brand-600">distribute</span>
              <span className="text-[10px] text-brand-500 font-medium bg-brand-50 px-1.5 py-0.5 rounded uppercase">beta</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-2">Start automating your distribution for free</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <button
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Creating account..." : "Continue with Google"}
            </button>

            <div className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-brand-500 hover:text-brand-600 font-medium">
                Sign in
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            By signing up, you agree to our{" "}
            <a href="https://distribute.you/terms" className="underline hover:text-gray-600">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
