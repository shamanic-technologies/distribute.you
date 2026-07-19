"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

function clerkErrorMessage(err: unknown): string {
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
  return (
    e?.errors?.[0]?.longMessage ||
    e?.errors?.[0]?.message ||
    "Something went wrong. Please try again."
  );
}

export default function ForgotPasswordPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // "request" = enter email, "reset" = enter code + new password
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/orgs");
    }
  }, [isSignedIn, router]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      posthog.capture("password_reset_requested");
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStage("reset");
    } catch (err) {
      posthog.capture("password_reset_failed", { stage: "request" });
      console.error("Password reset request error:", err);
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        posthog.capture("password_reset_completed");
        router.push("/orgs");
      } else {
        setError("Reset incomplete. Please check the code and try again.");
      }
    } catch (err) {
      posthog.capture("password_reset_failed", { stage: "reset" });
      console.error("Password reset error:", err);
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isSignedIn) {
    return null;
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: "0.9375rem",
    padding: "0.75rem 1rem",
    width: "100%",
    borderRadius: "0.75rem",
    background: "oklch(99% 0.002 264)",
    border: "1px solid oklch(87% 0.006 264)",
    color: "oklch(18% 0.008 264)",
    outline: "none",
  };

  const primaryBtnStyle: React.CSSProperties = {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: "0.9375rem",
    fontWeight: 600,
    padding: "0.75rem 1rem",
    width: "100%",
    borderRadius: "0.75rem",
    background: "oklch(55% 0.24 264)",
    color: "oklch(99% 0 0)",
    border: "none",
  };

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
              src="/logo-distribute.svg"
              alt="distribute.you"
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

        <div className="relative z-10">
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

      {/* Right: Reset form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "oklch(98% 0.003 264)" }}
      >
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-10">
            <Link
              href="https://distribute.you"
              className="inline-flex items-center gap-2"
            >
              <Image
                src="/logo-distribute.svg"
                alt="distribute.you"
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
            </Link>
          </div>

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
              Reset your password
            </h1>
            <p
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "1rem",
                color: "oklch(48% 0.006 264)",
              }}
            >
              {stage === "request"
                ? "We'll email you a code to reset it."
                : `Enter the code sent to ${email} and a new password.`}
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
            {stage === "request" ? (
              <form onSubmit={handleRequestCode} className="flex flex-col gap-3">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={inputStyle}
                  required
                />
                {error && (
                  <p
                    style={{
                      fontFamily: '"Inter", system-ui, sans-serif',
                      fontSize: "0.8125rem",
                      color: "oklch(55% 0.2 25)",
                    }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={submitting ? "cursor-wait" : "hover:brightness-105"}
                  style={primaryBtnStyle}
                >
                  {submitting ? "Sending code..." : "Send reset code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em" }}
                  required
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  style={inputStyle}
                  required
                />
                {error && (
                  <p
                    style={{
                      fontFamily: '"Inter", system-ui, sans-serif',
                      fontSize: "0.8125rem",
                      color: "oklch(55% 0.2 25)",
                    }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={submitting ? "cursor-wait" : "hover:brightness-105"}
                  style={primaryBtnStyle}
                >
                  {submitting ? "Resetting..." : "Reset password"}
                </button>
              </form>
            )}

            <div
              className="mt-6 text-center"
              style={{
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "0.875rem",
                color: "oklch(52% 0.006 264)",
              }}
            >
              <Link
                href="/sign-in"
                className="font-medium transition-opacity hover:opacity-75"
                style={{ color: "oklch(42% 0.2 264)" }}
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
