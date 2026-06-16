"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

export default function SignUpPage() {
  const { signUp, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/orgs");
    }
  }, [isSignedIn, router]);

  const handleGoogleSignUp = async () => {
    if (!isLoaded || isSignedIn) return;
    setLoading(true);
    try {
      sessionStorage.setItem("distribute_auth_intent", "signup");
      posthog.capture("signup_google_oauth_started", { provider: "google" });
      // A website carried from the landing pricing CTA (?url=) prefills the
      // onboarding brand. /onboarding is exempt from the first-run gate, so
      // landing there directly (vs the default /orgs → bare /onboarding bounce
      // that drops the query) preserves the param through the OAuth round-trip.
      const prefillUrl = (searchParams.get("url") || "").trim();
      const redirectUrlComplete = prefillUrl
        ? `/onboarding?url=${encodeURIComponent(prefillUrl)}`
        : "/orgs";
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete,
      });
    } catch (error) {
      posthog.capture("signup_google_oauth_failed", { provider: "google" });
      console.error("Sign up error:", error);
      setLoading(false);
    }
  };

  if (isSignedIn) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: "1rem" }}
    >
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

        {/* Logo */}
        <div className="relative z-10">
          <Link
            href="https://distribute.you"
            className="inline-flex items-center gap-3"
          >
            <Image
              src="/logo-distribute.svg"
              alt="distribute"
              width={32}
              height={32}
            />
            <span
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "1.125rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "oklch(97% 0.003 264)",
              }}
            >
              distribute
            </span>
            <span
              style={{
                fontFamily: '"JetBrains Mono", "Courier New", monospace',
                fontSize: "0.625rem",
                fontWeight: 500,
                padding: "0.2em 0.5em",
                borderRadius: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                background: "oklch(55% 0.24 264 / 0.2)",
                color: "oklch(72% 0.18 264)",
              }}
            >
              beta
            </span>
          </Link>
        </div>

        {/* Tagline block */}
        <div className="relative z-10">
          <p
            style={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontSize: "0.625rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "oklch(55% 0.24 264)",
              marginBottom: "1.25rem",
            }}
          >
            The Stripe of Distribution
          </p>
          <h2
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: "clamp(2.25rem, 4vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "oklch(97% 0.003 264)",
              marginBottom: "1.25rem",
            }}
          >
            Your distribution,
            <br />
            automated.
          </h2>
          <p
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: "1.125rem",
              fontWeight: 400,
              lineHeight: 1.6,
              color: "oklch(58% 0.008 264)",
              maxWidth: "28rem",
            }}
          >
            Give us your URL. We handle outreach, emails, and every touchpoint
            in between.
          </p>
        </div>

        {/* Footer bullets */}
        <div
          className="relative z-10 flex items-center gap-6"
          style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: "0.875rem",
            color: "oklch(42% 0.006 264)",
          }}
        >
          {["Zero config", "Transparent variable costs", "Data-driven"].map(
            (item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: "6px",
                    height: "6px",
                    background: "oklch(55% 0.24 264)",
                  }}
                />
                {item}
              </div>
            )
          )}
        </div>
      </div>

      {/* Right: Sign-up form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "oklch(98% 0.003 264)" }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link
              href="https://distribute.you"
              className="inline-flex items-center gap-2"
            >
              <Image
                src="/logo-distribute.svg"
                alt="distribute"
                width={28}
                height={28}
              />
              <span
                style={{
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "oklch(12% 0.008 264)",
                }}
              >
                distribute
              </span>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", "Courier New", monospace',
                  fontSize: "0.625rem",
                  fontWeight: 500,
                  padding: "0.2em 0.5em",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  background: "oklch(55% 0.24 264 / 0.1)",
                  color: "oklch(38% 0.18 264)",
                }}
              >
                beta
              </span>
            </Link>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "1.875rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "oklch(12% 0.008 264)",
                marginBottom: "0.5rem",
              }}
            >
              Create your account
            </h1>
            <p
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "1rem",
                color: "oklch(48% 0.006 264)",
              }}
            >
              50 free emails. No card required.
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "oklch(100% 0 0)",
              border: "1px solid oklch(91% 0.005 264)",
              boxShadow: "0 1px 4px oklch(12% 0.008 264 / 0.06)",
            }}
          >
            <button
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-[0.97]"
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "0.9375rem",
                fontWeight: 500,
                padding: "0.75rem 1rem",
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
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
              {loading ? "Creating account..." : "Continue with Google"}
            </button>

            <div
              className="mt-6 text-center"
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "0.875rem",
                color: "oklch(52% 0.006 264)",
              }}
            >
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium transition-opacity hover:opacity-75"
                style={{ color: "oklch(42% 0.2 264)" }}
              >
                Sign in
              </Link>
            </div>
          </div>

          <p
            className="mt-6 text-center"
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: "0.75rem",
              color: "oklch(62% 0.006 264)",
            }}
          >
            By signing up, you agree to our{" "}
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
