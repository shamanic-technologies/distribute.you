"use client";

import { useEffect } from "react";
import { landingUrlCookieString } from "@/lib/landing-url-cookie";

/**
 * Parks the website carried from the landing (`?url=`) in a first-party cookie
 * so onboarding still has it after the Clerk sign-up / OAuth redirect, which
 * does not preserve the query. Exact sibling of `PartneroViaCapture` — see
 * `lib/landing-url-cookie.ts` for why the param alone is not enough.
 *
 * Reads `window.location.search` directly, rather than through the Next hook
 * for query params, so the root layout is not forced into a Suspense boundary.
 */
export function LandingUrlCapture() {
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("url");
      const cookie = landingUrlCookieString(raw);
      if (!cookie) return;
      document.cookie = cookie;
    } catch {
      // best-effort — a prefill must never block page load
    }
  }, []);

  return null;
}
