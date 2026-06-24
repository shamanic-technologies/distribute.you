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
 * POLICY (2026-06-23 — "persist everything that exists, no skeleton on reload"):
 * the allowlist holds EVERY live non-sensitive query root, big lists included, so
 * NO page cold-skeletons on reload — it restores the last-known content for all of
 * them. This deliberately reverses the original small-roots-only allowlist (the
 * #1273 memory-overflow fix). It stays safe because the two mechanisms that caused
 * #1273 are now bounded independently of payload size:
 *   - `gcTime == maxAge == 30min` (NOT the old 24h) caps in-memory retention, so a
 *     big list cannot pile up in the heap for a day → no OOM.
 *   - `removeOldestQuery` (query-provider.tsx) evicts on the ~5MB localStorage cap
 *     and NEVER throws — an oversized single list (e.g. a 12k-row outlets payload
 *     that alone exceeds 5MB) simply self-evicts, so that one page may still
 *     skeleton on reload, but nothing crashes.
 *   - `buster: cacheBuildId()` discards the whole cache on every deploy.
 * RESIDUAL WATCH-ITEM: `dehydrate()` re-serializes the persisted set on EVERY cache
 * mutation (TanStack #9775). With 5s-polled big lists this adds main-thread cost on
 * heavy pages while they are actively viewed. Mitigation if it bites: an idle/blur
 * gate on the persister, or a per-query size cap — not a return to the allowlist.
 * The allowlist is now an INVENTORY of live roots (default-OFF still holds for a
 * future UNKNOWN root, so a new query is opt-in, never silently auto-persisted).
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
 * Storage key is org-scoped so org A's persisted cache never restores under
 * org B after a reload — closing the cross-org vector of DIS-143 (React Query
 * keys are not yet org-scoped). Before Clerk resolves the org we use "anon", an
 * empty bucket that holds nothing.
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
