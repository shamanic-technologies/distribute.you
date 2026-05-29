"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

/**
 * Whether a PostHog feature flag is enabled for the current viewer.
 *
 * Default-hidden: returns `false` until PostHog has loaded flags, so a gated
 * surface NEVER flashes for a non-staff viewer during the async flag fetch.
 * Re-renders whenever PostHog (re)loads flags — including after
 * `posthog.identify(...)` in `PostHogAuthTracker`, which is what makes
 * email-targeted (staff-only) flags resolve once the user is known.
 */
export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(posthog.isFeatureEnabled(key) === true);
    update();
    // `onFeatureFlags` returns an unsubscribe fn in current posthog-js; if an
    // older build returns void, returning it from the effect is a harmless no-op.
    return posthog.onFeatureFlags(update);
  }, [key]);

  return enabled;
}
