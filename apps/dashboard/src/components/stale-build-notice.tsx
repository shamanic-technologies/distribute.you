"use client";

import { useEffect, useState } from "react";
import { isStaleBuildEvent } from "@/lib/stale-build";

/**
 * Says out loud that this tab is running a bundle the server has replaced.
 *
 * The dashboard redeploys within about five minutes of a merge, so a tab left
 * open across one keeps JS that references Server Action ids, route payloads and
 * chunks that no longer exist. Every one of those fails as an UNHANDLED promise
 * rejection, which no React error boundary sees, so the page silently stops
 * working: a control is clicked, nothing happens, and the only thing that says
 * why is the console.
 *
 * A NOTICE rather than an automatic reload, deliberately. A reload triggered by
 * an error can loop (the reloaded page hits the same error and reloads again)
 * and it throws away whatever the person had typed - the onboarding wizard, an
 * investor update draft, a chat thread. Telling them and letting them press the
 * button costs one click and cannot destroy anything.
 *
 * Mounted once in the authed layout, so it covers the dashboard AND onboarding.
 * `location.reload()` is a HARD reload, which is the point: a client navigation
 * would reuse the same dead bundle.
 */
export function StaleBuildNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const onEvent = (event: Event) => {
      if (!isStaleBuildEvent(event)) return;
      // Fail loud: the console still gets the original error from the browser.
      // This only adds the reading of it.
      console.error("[dashboard] this tab is running an outdated build", event);
      setStale(true);
    };
    window.addEventListener("unhandledrejection", onEvent);
    window.addEventListener("error", onEvent);
    return () => {
      window.removeEventListener("unhandledrejection", onEvent);
      window.removeEventListener("error", onEvent);
    };
  }, []);

  if (!stale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Above the support FAB on mobile (it owns the bottom-right corner at
      // `right-4 bottom-4`, so a bar sitting at `bottom-6` runs straight under
      // it on a phone). On desktop the centred bar never reaches that far.
      className="fixed bottom-24 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 sm:bottom-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg"
    >
      <span className="min-w-0 flex-1 text-sm text-blue-900">
        A newer version of the dashboard shipped. Reload to continue.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        Reload
      </button>
    </div>
  );
}
