import posthog from "posthog-js";
import { STAFF_BROWSER_KEY, type OwnerPing } from "./owner-ping";

/**
 * Tell the owner a signup step just happened (`lib/owner-ping.ts`). Fire and forget:
 * a ping must never slow or break the walk, so a failure is logged, never thrown.
 * Skipped in a browser where a staff account signed in.
 */
export function pingOwner(ping: Omit<OwnerPing, "who" | "country" | "signedOut">): void {
  try {
    if (localStorage.getItem(STAFF_BROWSER_KEY) === "1") return;
  } catch {
    // No storage (private mode): not a staff browser we know of.
  }
  // A browser that once signed in keeps that user as its PostHog id after sign-out:
  // the route names a returning person from it instead of "Visitor".
  let posthogDistinctId: string | null = null;
  try {
    posthogDistinctId = posthog.get_distinct_id?.() ?? null;
  } catch {
    // PostHog blocked or not loaded: the route names nobody it cannot verify.
  }
  void fetch("/api/public/owner-ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ping, posthogDistinctId }),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok && res.status !== 429) console.error(`[owner-ping] ${ping.event} ping failed: ${res.status}`);
    })
    .catch((e) => console.error(`[owner-ping] ${ping.event} ping failed:`, e));
}
