/**
 * Pure helpers for the persisted React Query cache. No React / Clerk imports, so
 * they unit-test in a plain node env (mirrors `nextRevealState` in
 * `use-coordinated-reveal.ts`).
 *
 * This is the 4th anti-flash layer (see CLAUDE.md → "Coordinated reveal"):
 *  1. `placeholderData: keepPreviousData` — keeps a query's DATA across refetch.
 *  2. `useCoordinatedReveal`            — keeps a group's REVEAL across refetch.
 *  3. `useMonotonicStatuses`            — keeps a row's BUCKET across refetch.
 *  4. persisted cache (this file)       — keeps the WHOLE cache across gcTime
 *     eviction AND full reloads, so leaving a page and coming back restores the
 *     last-known content instantly instead of cold-loading a skeleton.
 *
 * The first three operate on a warm in-memory cache; none survive gcTime
 * eviction (idle > gcTime) or a reload (new QueryClient). Persistence is the
 * only layer that does.
 */

/**
 * Persisted-cache freshness window. `gcTime` MUST be set to this value or higher
 * (TanStack rule) — otherwise in-memory garbage collection drops a query before
 * its persisted copy can be restored, defeating persistence. We use the same 24h
 * for both `gcTime` and the persister `maxAge`.
 */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Query-key roots whose data is secret (key material) and must NEVER be written
 * to disk — localStorage is readable by any script on the origin. They refetch
 * instantly on demand, so excluding them costs nothing.
 */
export const SENSITIVE_QUERY_ROOTS = new Set(["apiKeys", "byokKeys", "keySources"]);

export interface PersistableQuery {
  state: { status: string };
  queryKey: readonly unknown[];
}

/**
 * Decide whether a query is eligible to be written to the persisted cache.
 * Replaces TanStack's default `shouldDehydrateQuery`, so the success check is
 * explicit: only successful, non-sensitive queries persist. Errors / pending
 * states would restore as a broken UI; secrets must not touch disk.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  if (query.state.status !== "success") return false;
  const root = String(query.queryKey[0] ?? "");
  return !SENSITIVE_QUERY_ROOTS.has(root);
}

/**
 * Storage key is org-scoped so org A's persisted cache never restores under
 * org B after a reload — closing the cross-org vector of DIS-143 (React Query
 * keys are not yet org-scoped). Before Clerk resolves the org we use "anon", an
 * empty bucket that holds nothing.
 */
export function persisterStorageKey(orgId: string | null | undefined): string {
  return `distribute-dashboard-cache:${orgId ?? "anon"}`;
}

/**
 * Cache buster. Any new deploy changes the build id → the persister `buster`
 * mismatches and discards a cache shaped for the previous code, so a schema /
 * shape change never restores stale data into new components.
 */
export function cacheBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_BUILD_ID ??
    "dev"
  );
}
