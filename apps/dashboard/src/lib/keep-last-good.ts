/**
 * keep-last-good — 5th member of the "don't revert resolved state on a transient" family
 * (after `keepPreviousData`, `useCoordinatedReveal`, `useMonotonicStatuses`, the persisted cache).
 *
 * THE GAP IT FILLS. The other four guard against an ERROR / undefined / key-change / eviction.
 * NONE guard against a *successful* refetch that returns VALID-but-degenerate data — a field that
 * was non-null legitimately flips to null/empty on a 200 (a cold Neon path / half-warm downstream
 * returns zeroed unit costs or fewer rows). `keepPreviousData` can't help: the null IS the new
 * valid query data, so React Query installs it and any UI derived off it (a budget card, a
 * disabled-gate, a badge) collapses mid-session.
 *
 * THE FIX (industry-aligned). TkDodo / TanStack / SWR all agree there is NO built-in for the
 * successful-but-worse case — you intercept at the cache-write boundary. TanStack's hook is
 * `structuralSharing(prev, next)` (SWR's is `compare`, Apollo's is a `merge` field policy). These
 * helpers build that merge: keep the previous non-null value when the next payload nulls it, and
 * `console.error` the suppressed downgrade (fail-loud — a persistent real downgrade still logs).
 *
 * OPT-IN ONLY — never a global default. A null can legitimately mean "deleted / gone"; a blanket
 * last-good would mask real deletions. Apply per query where a null means "transient / not-ready"
 * (cold compute, in-flight aggregation), NOT "removed".
 *
 * Refs: https://tkdodo.eu/blog/placeholder-and-initial-data-in-react-query ·
 *  https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations ·
 *  https://github.com/TanStack/query/discussions/5753 · https://swr.vercel.app/docs/api (compare)
 */

const isNullish = (v: unknown): boolean => v === null || v === undefined;

/**
 * Per-field coalesce: for each listed field, keep `prev`'s value when `next`'s is null/undefined.
 * Returns a new object (`next` spread with the kept fields). Fail-loud on each suppressed downgrade.
 */
export function keepLastGoodFields<T extends object>(
  prev: T | undefined,
  next: T,
  fields: ReadonlyArray<keyof T>,
  label = "keepLastGoodFields",
): T {
  if (!prev) return next;
  const merged: T = { ...next };
  for (const f of fields) {
    if (isNullish(next[f]) && !isNullish(prev[f])) {
      merged[f] = prev[f];
      console.error(
        `[keep-last-good] ${label}: field "${String(f)}" went ${String(next[f])} on refetch — keeping last-good value`,
        { field: f, prev: prev[f], next: next[f] },
      );
    }
  }
  return merged;
}

