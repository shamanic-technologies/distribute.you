import { useRef } from "react";

/**
 * Pure latch step for {@link useCoordinatedReveal} — exported for unit testing.
 *
 * Barrier + monotonic latch:
 * - While not yet revealed, returns true ONLY when every flag is true (the
 *   barrier — a group of sections reveals together, never one-by-one).
 * - Once revealed, stays revealed forever regardless of the flags (the latch —
 *   a background refetch / Clerk token rotation / transient query error can flip
 *   a readiness flag back to false, but the group must NOT revert to a skeleton).
 *
 * An empty group reveals immediately (`[].every(...) === true`): a section with
 * no queries to wait on has nothing to gate.
 */
export function nextRevealState(prevRevealed: boolean, readyFlags: boolean[]): boolean {
  return prevRevealed || readyFlags.every(Boolean);
}

/**
 * Coordinated reveal: show a group of sections together (barrier), then keep
 * them on screen across background refetches (monotonic latch).
 *
 * Pass one readiness flag per query in the visual group — `data !== undefined`,
 * or `!isPending` (NB: a *disabled* React Query stays `isPending: true` forever,
 * so gate its flag behind its own `enabled` condition: `!enabled || !isPending`).
 *
 * Returns `false` until every flag has been true at least once, then `true` for
 * the rest of this mount. The ref resets naturally on unmount (navigating away),
 * so a freshly-mounted page barriers again from its own cache state.
 *
 * This is the reveal half of the dashboard SWR story; it pairs with React
 * Query's global `placeholderData: keepPreviousData` (which keeps each query's
 * data on screen during refetch) to guarantee a group never flickers back to a
 * skeleton once shown. See CLAUDE.md → "Coordinated reveal".
 */
export function useCoordinatedReveal(readyFlags: boolean[]): boolean {
  const revealed = useRef(false);
  revealed.current = nextRevealState(revealed.current, readyFlags);
  return revealed.current;
}
