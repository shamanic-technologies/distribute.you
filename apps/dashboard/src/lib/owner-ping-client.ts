import { STAFF_BROWSER_KEY, type OwnerPing } from "./owner-ping";

/**
 * Tell the owner a signup step just happened (`lib/owner-ping.ts`). Fire and forget:
 * a ping must never slow or break the walk, so a failure is logged, never thrown.
 * Skipped in a browser where a staff account signed in.
 */
export function pingOwner(ping: Omit<OwnerPing, "who" | "country">): void {
  try {
    if (localStorage.getItem(STAFF_BROWSER_KEY) === "1") return;
  } catch {
    // No storage (private mode): not a staff browser we know of.
  }
  void fetch("/api/public/owner-ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ping),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok && res.status !== 429) console.error(`[owner-ping] ${ping.event} ping failed: ${res.status}`);
    })
    .catch((e) => console.error(`[owner-ping] ${ping.event} ping failed:`, e));
}
