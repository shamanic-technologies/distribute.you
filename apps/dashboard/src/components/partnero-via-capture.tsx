"use client";

import { useEffect } from "react";

/**
 * Captures the Partnero partner key forwarded from the landing (`?via=KEY`)
 * and persists it to a first-party cookie on the dashboard domain, so it
 * survives the Clerk sign-up / OAuth redirect dance and is available to
 * `PostHogAuthTracker` when the signup completes (server-to-server attribution).
 *
 * Reads `window.location.search` (not `useSearchParams`) to avoid forcing a
 * Suspense boundary on the root layout. Best-effort: attribution must never
 * break page load.
 */
export function PartneroViaCapture() {
  useEffect(() => {
    try {
      const via = new URLSearchParams(window.location.search).get("via");
      if (!via) return;
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `partnero_via=${encodeURIComponent(via)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } catch {
      // best-effort — never block page load
    }
  }, []);

  return null;
}
