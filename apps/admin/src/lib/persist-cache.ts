/**
 * Pure helpers for the persisted React Query cache. No React / Clerk imports, so
 * they unit-test in a plain node env (mirrors `nextRevealState` in
 * `use-coordinated-reveal.ts`).
 *
 * This is the 4th anti-flash layer (see CLAUDE.md → "Coordinated reveal"):
 *  1. `placeholderData: keepPreviousData` — keeps a query's DATA across refetch.
 *  2. `useCoordinatedReveal`            — keeps a group's REVEAL across refetch.
 *  3. `useMonotonicStatuses`            — keeps a row's BUCKET across refetch.
 *  4. persisted cache (this file)       — restores the last-known content on
 *     return / reload instead of cold-loading a skeleton.
 *
 * ⚠️ PERFORMANCE INVARIANT (the #1273 memory-overflow incident, 2026-06-02):
 * `PersistQueryClientProvider` calls `dehydrate()` + writes storage on EVERY
 * cache mutation (TanStack issue #9775, "wontfix / known limitation"). If the
 * cache holds large or 5s-polled lists, that re-serializes megabytes on the main
 * thread every poll → multi-second freeze; and a 24h `gcTime` keeps every visited
 * big list in the JS heap for a day → memory overflow. So:
 *   - Persist ONLY small, slow-changing roots (the allowlist below). Default OFF:
 *     a new query is not persisted unless explicitly added. Missing a small root
 *     = minor (no instant-return for that page). Persisting a big/polled root =
 *     perf regression. Fail toward the safe side.
 *   - Bound `gcTime` (== `maxAge`) so inactive big lists leave the heap quickly.
 * NEVER add a list / leads / emails / journalists / outlets / articles / runs /
 * pitches / opportunities / media-kit / cost-breakdown root to the allowlist.
 */

/**
 * Persisted-cache freshness window AND the in-memory `gcTime` (they must be
 * equal — TanStack rule `gcTime >= maxAge`, else GC drops a query before its
 * persisted copy can restore). 30 min: long enough for "leave a page and come
 * back" within a work session, short enough that inactive big lists do not pile
 * up in the heap. Was 24h (#1273) — that retention was the memory overflow.
 */
export const PERSIST_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Query-key roots whose data is secret (key material) and must NEVER be written
 * to disk — localStorage is readable by any script on the origin. Redundant with
 * the allowlist (they aren't in it) but kept as explicit defense-in-depth.
 */
export const SENSITIVE_QUERY_ROOTS = new Set(["apiKeys", "byokKeys", "keySources"]);

/**
 * ALLOWLIST — only these roots persist to disk. Default OFF for everything else.
 * Each entry MUST be small (KB, not MB) AND slow-changing. These are navigation /
 * config / single-entity metadata / small counters — the data whose instant
 * restore actually matters and whose serialization cost is negligible.
 *
 * Deliberately EXCLUDED (big and/or 5s-polled — see the perf invariant above):
 * leads, emails, journalists, outlets, articles, opportunities, quote pitches,
 * media kits, visibility/campaign/brand runs, event logs, cost breakdowns,
 * sales workflow test outputs. Those refetch on demand (they poll anyway).
 */
export const PERSISTABLE_QUERY_ROOTS = new Set([
  // Navigation / config — warm, slow-changing, high instant-return value
  "features",
  "feature",
  "statsRegistry",
  "entityRegistry",
  "platformPrices",
  "billingAccount",
  // Brand + campaign METADATA (single entities + small lists), NOT their sub-lists
  "brand",
  "brands",
  "brandExtractedFields",
  "campaign",
  "campaigns",
  // Workflow definitions / summaries — metadata, NOT run logs or test outputs
  "workflow",
  "workflows",
  "workflow-summary",
  // Small stat counters (plain numbers — cheap to serialize even when polled)
  "featureStats",
  "campaignStats",
  // Cross-org feature-stats aggregates (feature-stats/* pages) — small,
  // slow-changing (30s poll, cross-org rollups: a projection number, 6 lifetime
  // averages, a ~90-day trend series per objective, a short per-workflow list).
  // Same class as featureStats/campaignStats above → persist for SWR-instant
  // paint on return (no cold skeleton), never a big/volatile list root.
  "crossOrgCostProjection",
  "crossOrgLifetime",
  "crossOrgTrend",
  "crossOrgWorkflowCost",
  // Google CRM connect-state — a tiny {email,status} list, config-like (high
  // instant-return value: paints "connected" without a cold round-trip). The
  // CRM MESSAGE + CONTACT lists are deliberately NOT persisted — they are entity
  // lists (messages carry full email bodies) and the invariant above forbids
  // persisting lists; they get in-memory SWR + revalidate-on-open instead.
  "googleAccounts",
]);

export interface PersistableQuery {
  state: { status: string };
  queryKey: readonly unknown[];
}

/**
 * Decide whether a query is eligible to be written to the persisted cache.
 * Replaces TanStack's default `shouldDehydrateQuery`. Only a successful, NON-
 * sensitive, ALLOWLISTED query persists — errors / pending would restore a broken
 * UI; secrets must not touch disk; big/volatile roots must not melt the main
 * thread (#9775). Default OFF: an unlisted root never persists.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  if (query.state.status !== "success") return false;
  const root = String(query.queryKey[0] ?? "");
  if (SENSITIVE_QUERY_ROOTS.has(root)) return false;
  return PERSISTABLE_QUERY_ROOTS.has(root);
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
