import { useRef } from "react";

/**
 * Rank a display-status against a "most-advanced-first" priority array.
 * Lower index = more advanced (e.g. `replied` outranks `served`). A status not
 * in the array is treated as least-advanced (`+Infinity`) so a KNOWN status
 * always outranks an unknown one, and an unknown never displaces a known one.
 */
function rankOf(status: string, priority: readonly string[]): number {
  const i = priority.indexOf(status);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/**
 * Pure monotonic step for {@link useMonotonicStatuses} — exported for unit
 * testing (mirrors `nextRevealState` in use-coordinated-reveal.ts).
 *
 * Returns the MORE-ADVANCED of `prev` and `next` per the page's own status
 * priority. When `next` is LESS advanced than a status already seen, it is a
 * regression — by domain definition email/outreach engagement is append-only
 * (`contacted → sent → delivered → opened → clicked → replied` never reverses),
 * so a lower status on a later poll is a stale/partial overlay read, not a real
 * event. We KEEP the higher status (kills the tab-flap) and `console.error` the
 * suppressed downgrade so the upstream inconsistency stays visible (fail-loud,
 * not a silent fallback).
 */
export function nextMonotonicStatus(
  prev: string | undefined,
  next: string,
  priority: readonly string[],
  label?: string,
): string {
  if (prev === undefined) return next;
  if (rankOf(next, priority) <= rankOf(prev, priority)) return next; // advance or equal
  console.error(
    `[dashboard] monotonic-status${label ? ` (${label})` : ""}: suppressed downgrade ${prev} → ${next}. ` +
      `Upstream delivery overlay returned a less-advanced status than already seen this session.`,
  );
  return prev;
}

/**
 * Per-mount monotonic latch for entities bucketed into status tabs.
 *
 * Pages that group leads/journalists/outlets into mutually-exclusive status
 * tabs derive each entity's tab from a delivery/engagement overlay that is
 * re-fetched on every poll. When that overlay transiently drops (returns the
 * status under a different shape, or empty), an entity falls from e.g.
 * "Delivered" back to "Processing" → it leaves the tab the user is viewing →
 * the table appears to empty, then repopulates next poll. This is the
 * derived-state analog of React Query's `keepPreviousData` and the reveal
 * latch in {@link useCoordinatedReveal}: don't revert resolved state on a
 * transient.
 *
 * Pass one entry per rendered entity (`{ id, status }`) plus the page's own
 * "most-advanced-first" priority array. Returns a Map id → latched status to
 * bucket on. The ref resets on unmount, so a freshly-mounted page re-latches
 * from its own cache state.
 */
export function useMonotonicStatuses(
  entries: ReadonlyArray<{ id: string; status: string }>,
  priority: readonly string[],
  label?: string,
): Map<string, string> {
  const latched = useRef<Map<string, string>>(new Map());
  const result = new Map<string, string>();
  for (const { id, status } of entries) {
    const resolved = nextMonotonicStatus(latched.current.get(id), status, priority, label);
    latched.current.set(id, resolved);
    result.set(id, resolved);
  }
  return result;
}
