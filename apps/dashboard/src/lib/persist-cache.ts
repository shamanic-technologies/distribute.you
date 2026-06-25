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
 * POLICY (2026-06-25 — "local-first SWR cache: open a page → its content NOW"):
 * the dashboard is a LOCAL-FIRST, stale-while-revalidate (SWR) surface — the on-disk
 * cache is the source the UI paints FIRST, the network is secondary (TkDodo: "stale
 * data is better than no data, because no data means a loading spinner = perceived
 * slow"). The allowlist holds EVERY live non-sensitive query root, big lists
 * included, so NO page cold-skeletons after the first ever load.
 *
 * PERSISTER = the PER-QUERY persister (`experimental_createQueryPersister`,
 * query-provider.tsx), NOT the old whole-client `persistQueryClient`. Two reasons it
 * is strictly better for this polling-heavy app (TanStack docs "createPersister"):
 *   1. Each query is written to storage SEPARATELY (keyed by its query hash), only
 *      when IT changes — so a 5s poll of one query does NOT re-serialize the whole
 *      cache. This kills the main-thread "lourd/lent" jank of the whole-client
 *      persister, which re-`dehydrate()`d the ENTIRE set on every mutation (#9775).
 *   2. A query persisted to disk survives even after it is GC'd from MEMORY — disk
 *      retention is DECOUPLED from `gcTime`. That lets us keep `maxAge: Infinity`
 *      (disk = keep forever → never expire → no cross-session cold skeleton) WITHOUT
 *      pinning everything in the JS heap forever. `gcTime` stays a modest bound on
 *      MEMORY only (the #1273 heap-overflow lever); the disk holds it regardless.
 *
 * STORAGE = IndexedDB (idb-keyval), NOT localStorage. localStorage's hard ~5MB
 * per-origin cap was the regression: a big list (leads/emails on a heavy brand)
 * blew the cap → `removeOldestQuery` evicted the small overview queries → the
 * overview cold-skeletoned on the slow Neon chain (the very thing persist-all was
 * meant to prevent). IndexedDB has no such cap, so nothing is evicted and big-list
 * pages persist fully too.
 *
 * NB admin ≠ dashboard: `admin.distribute.you` is a SEPARATE origin with its OWN
 * storage — its heavy outlets/journalists cache never touches this dashboard cache.
 *
 * SAFETY (cross-deploy shape drift, with `maxAge: Infinity` and no per-deploy bust):
 * `buster` (manual version, bumped by hand on an incompatible shape change) is the
 * only forced invalidation; `safeParse` / `z.coerce` on list readers, keep-last-good
 * `structuralSharing`, and the org-scoped `prefix` each tolerate a drifted shape.
 * The allowlist is an INVENTORY of live roots (default-OFF still holds for a future
 * UNKNOWN root, so a new query is opt-in, never silently auto-persisted).
 */

/**
 * Persisted-cache freshness window (the per-query persister `maxAge`). `Infinity`
 * = NEVER expire on disk → opening any page on a later session/day paints its
 * last-known content instantly, then revalidates in the background (SWR). Safe to
 * be infinite ONLY because the persister is PER-QUERY: disk retention is decoupled
 * from `gcTime`, so "keep forever on disk" does NOT pin everything in the JS heap
 * (that decoupling is impossible with the whole-client persister, where disk
 * mirrors memory and `maxAge: Infinity` would force `gcTime: Infinity` → the #1273
 * heap overflow). Shape drift across deploys is handled by `buster` + safeParse, not
 * by expiry. Was 30 min (and before that 24h, #1273).
 */
export const PERSIST_MAX_AGE_MS = Infinity;

/**
 * In-memory `gcTime` — how long an INACTIVE query stays in the JS heap. Bounds
 * memory ONLY (the #1273 lever); it is INDEPENDENT of disk retention now that the
 * persister is per-query (a heap-GC'd query stays on disk up to `maxAge`, so the
 * page still restores instantly). 30 min: covers "leave a page and come back"
 * in-session warm, short enough that inactive big lists leave the heap.
 */
export const PERSIST_GC_TIME_MS = 30 * 60 * 1000;

/**
 * Query-key roots whose data is secret (key material) and must NEVER be written
 * to disk — localStorage is readable by any script on the origin. Redundant with
 * the allowlist (they aren't in it) but kept as explicit defense-in-depth.
 */
export const SENSITIVE_QUERY_ROOTS = new Set(["apiKeys", "byokKeys", "keySources"]);

/**
 * INVENTORY of every LIVE non-sensitive query root in the dashboard — all persist
 * to disk so no page cold-skeletons on reload (see the POLICY block above). Keep
 * this in lockstep with the queries the app actually uses: add a root when a new
 * query ships, drop a root when its surface is removed (the dead campaign- and
 * quote- roots from the #1768 campaign-UI removal were dropped here). Secrets stay out via
 * SENSITIVE_QUERY_ROOTS; a future UNKNOWN root is default-OFF until listed here.
 */
export const PERSISTABLE_QUERY_ROOTS = new Set([
  // Navigation / config / registries
  "features",
  "feature",
  "statsRegistry",
  "entityRegistry",
  "platformPrices",
  "billingAccount",
  // Brand metadata + config + small summaries
  "brand",
  "brands",
  "brandProfile",
  "brandExtractedFields",
  "brandSalesEconomics",
  "brandDailyBudget",
  "brandPause",
  "brandCostBreakdown",
  "brandCostBreakdownToday",
  // Brand entity sub-lists (big — persisted so their pages skip the reload skeleton)
  "brandLeads",
  "brandEmails",
  "brandOutlets",
  "brandArticles",
  "brandJournalists",
  "enrichedJournalists",
  "brandRuns",
  "brandMediaKits",
  "mediaKit",
  // Feature-level stats / revenue / activity
  "featureStats",
  "featureRevenue",
  "featurePipelineActivity",
  "featureAudienceStats",
  "featureWorkflows",
  "featureQuotePitches",
  // Opportunities / pitches
  "rankedOpportunities",
  "quotePitches",
  // Audiences
  "audiences",
  // Workflow defs / projections / summaries
  "workflow",
  "workflows",
  "workflow-summary",
  "workflow-key-status",
  "workflowProjection",
  "globalRankedWorkflows",
  // Outlet cost stats
  "outletStatsCosts",
  // Campaign (the launch-modal self-fetch is the only surviving campaign UI)
  "campaign",
  "campaigns",
  "campaignLeads",
  "campaignActivity",
  // Visibility runs
  "visibilityRuns",
  "visibilityRun",
  // Per-domain metric objects
  "domainTrafficHistory",
  "domainDrStatus",
  "domainAiVisibility",
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
 * Org-scoped storage PREFIX for the per-query persister. Each query is stored under
 * `${prefix}-${queryHash}`, so scoping the prefix by org id keeps org A's persisted
 * queries in a different IndexedDB key space than org B — closing the cross-org
 * vector of DIS-143 (React Query keys are not yet org-scoped). While the org is
 * unresolved the persister storage is `undefined` (a no-op, see query-provider.tsx),
 * so the "anon" value here is only a defensive default and persists nothing.
 */
export function persisterStorageKey(orgId: string | null | undefined): string {
  return `distribute-dashboard-cache:${orgId ?? "anon"}`;
}

/**
 * MANUAL cache version — the persister `buster`. Bump this string BY HAND, and
 * ONLY when a persisted query's response shape changes incompatibly (a renamed /
 * removed field a restored-from-disk component would crash on). On a bump the
 * persister `buster` mismatches and discards the whole disk cache, so stale-shaped
 * data never restores into new components.
 *
 * WHY NOT the git commit SHA (the previous design): the SHA changes on EVERY
 * deploy, so a high-velocity app (≈12 deploys/day here) busted the entire
 * persisted cache on essentially every visit → the persist-everything work
 * (#2074) never survived to a return visit and every page cold-skeletoned on the
 * slow Neon chain. The shape almost never changes; the SHA always does — so the
 * SHA was the wrong key. This is TanStack's own recommended pattern for actively
 * deployed apps. Cross-deploy shape safety still holds without the per-deploy
 * bust: `safeParse` / `z.coerce` on the list readers, keep-last-good
 * `structuralSharing`, and the 30-min `maxAge` bound each tolerate a drifted shape.
 *
 * Bump checklist (increment the integer): renamed/removed a field on a response
 * type consumed straight from cache without a safeParse guard. Additive fields
 * (new optional field) do NOT need a bump.
 */
const PERSIST_CACHE_VERSION = "1";

export function persistCacheVersion(): string {
  return PERSIST_CACHE_VERSION;
}
