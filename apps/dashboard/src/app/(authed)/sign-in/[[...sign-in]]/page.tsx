"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/orgs");
    }
  }, [isSignedIn, router]);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || isSignedIn) return;
    setLoading(true);
    try {
      posthog.capture("signin_google_oauth_started", { provider: "google" });
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/orgs",
      });
    } catch (error) {
      posthog.capture("signin_google_oauth_failed", { provider: "google" });
      console.error("Sign in error:", error);
      setLoading(false);
    }
  };

  if (isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "oklch(6.5% 0.012 264)" }}
      >
        {/* Radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(55% 0.24 264 / 0.18) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <Link
            href="https://distribute.you"
            className="inline-flex items-center gap-3"
          >
            <Image
              src="/logo-head.jpg"
              alt="distribute"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span
              className="font-semibold text-xl tracking-tight"
              style={{ color: "oklch(97% 0.003 264)" }}
            >
              distribute
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-[0.15em]"
              style={{
                background: "oklch(55% 0.24 264 / 0.2)",
                color: "oklch(72% 0.18 264)",
                fontFamily: '"JetBrains Mono", "Courier New", monospace',
              }}
            >
              beta
            </span>
          </Link>
        </div>

        <div className="relative z-10">
          <p
            className="text-[10px] uppercase tracking-[0.2em] mb-4"
            style={{
              color: "oklch(55% 0.24 264)",
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
            }}
          >
            The Stripe of Distribution
          </p>
          <h2
            className="text-4xl font-bold leading-tight mb-4"
            style={{ color: "oklch(97% 0.003 264)" }}
          >
            Your distribution,
            <br />
            automated.
          </h2>
          <p
            className="text-lg max-w-md leading-relaxed"
            style={{ color: "oklch(58% 0.008 264)" }}
          >
            Give us your URL. We handle outreach, emails, and every touchpoint
            in between.
          </p>
        </div>

        <div
          className="relative z-10 flex items-center gap-6 text-sm"
          style={{ color: "oklch(42% 0.006 264)" }}
        >
          {["Zero config", "Transparent variable costs", "Data-driven"].map(
            (item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "oklch(55% 0.24 264)" }}
                />
                {item}
              </div>
            )
          )}
        </div>
      </div>

      {/* Right: Sign-in form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "oklch(98% 0.003 264)" }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link
              href="https://distribute.you"
              className="inline-flex items-center gap-2"
            >
              <Image
                src="/logo-head.jpg"
                alt="distribute"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span
                className="font-semibold text-lg"
                style={{ color: "oklch(12% 0.008 264)" }}
              >
                distribute
              </span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-[0.15em]"
                style={{
                  background: "oklch(55% 0.24 264 / 0.1)",
                  color: "oklch(38% 0.18 264)",
                  fontFamily: '"JetBrains Mono", "Courier New", monospace',
                }}
              >
                beta
              </span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: "oklch(12% 0.008 264)" }}
            >
              Welcome back
            </h1>
            <p style={{ color: "oklch(48% 0.006 264)" }}>
              Sign in to your distribute dashboard
            </p>
          </div>

          <div
            className="rounded-2xl p-6"
            style={{
              background: "oklch(100% 0 0)",
              border: "1px solid oklch(91% 0.005 264)",
              boxShadow: "0 1px 4px oklch(12% 0.008 264 / 0.06)",
            }}
          >
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-[0.97]"
              style={{
                background: "oklch(98% 0.003 264)",
                border: "1px solid oklch(87% 0.006 264)",
                color: "oklch(22% 0.008 264)",
              }}
            >
              {loading ? (
                <svg
                  className="w-5 h-5 animate-spin flex-shrink-0"
                  style={{ color: "oklch(60% 0.006 264)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {loading ? "Connecting..." : "Continue with Google"}
            </button>

            <div
              className="mt-6 text-center text-sm"
              style={{ color: "oklch(52% 0.006 264)" }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium transition-opacity hover:opacity-75"
                style={{ color: "oklch(42% 0.2 264)" }}
              >
                Sign up
              </Link>
            </div>
          </div>

          <p
            className="mt-6 text-center text-xs"
            style={{ color: "oklch(62% 0.006 264)" }}
          >
            By signing in, you agree to our{" "}
            <a
              href="https://distribute.you/terms"
              className="underline hover:opacity-75 transition-opacity"
            >
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
