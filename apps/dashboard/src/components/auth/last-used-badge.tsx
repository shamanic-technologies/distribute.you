"use client";

import { useEffect, useState } from "react";

/** localStorage key remembering the method used at the last successful auth. */
export const LAST_AUTH_METHOD_KEY = "distribute_last_auth_method";

export type AuthMethod = "google" | "email";

/** Persist the method used for the most recent successful sign-in / sign-up. */
export function rememberAuthMethod(method: AuthMethod): void {
  try {
    localStorage.setItem(LAST_AUTH_METHOD_KEY, method);
  } catch {
    // Private-mode / storage-disabled browsers: the hint is best-effort.
  }
}

/**
 * Small "Last used" pill anchored to the auth method the returning visitor used
 * last, so someone who forgot whether they signed up with email or Google gets a
 * nudge toward the right button. Reads localStorage on mount (never during SSR)
 * so there is no hydration mismatch, and renders nothing on a fresh browser.
 *
 * Anchors top-right of the nearest `position: relative` ancestor.
 */
export function LastUsedBadge({ method }: { method: AuthMethod }) {
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_AUTH_METHOD_KEY);
      if (stored === "google" || stored === "email") {
        setLastUsed(stored);
      }
    } catch {
      // ignore — no hint when storage is unavailable
    }
  }, []);

  if (lastUsed !== method) return null;

  return (
    <span
      aria-label="Last used sign-in method"
      style={{
        position: "absolute",
        top: "-0.5rem",
        right: "0.5rem",
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
        fontSize: "0.5625rem",
        fontWeight: 500,
        padding: "0.15em 0.5em",
        borderRadius: "999px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
        background: "oklch(55% 0.24 264)",
        color: "oklch(99% 0 0)",
        boxShadow: "0 1px 3px oklch(12% 0.008 264 / 0.18)",
      }}
    >
      Last used
    </span>
  );
}
