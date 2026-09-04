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
 *      retention is DECOUPLED from `gcTime`. That lets disk retention run for weeks
 *      (no cross-session cold skeleton) WITHOUT pinning anything in the JS heap for
 *      anywhere near that long. `gcTime` stays a modest bound on
 *      MEMORY only (the #1273 heap-overflow lever); the disk holds it regardless.
 *
 * STORAGE = IndexedDB (idb-keyval), NOT localStorage. localStorage's hard ~5MB
 * per-origin cap was the regression: a big list (leads/emails on a heavy brand)
 * blew the cap → `removeOldestQuery` evicted the small overview queries → the
 * overview cold-skeletoned on the slow Neon path (the very thing persist-all was
 * meant to prevent). IndexedDB has no such cap, so nothing is evicted and big-list
 * pages persist fully too.
 *
 * NB admin ≠ dashboard: `admin.distribute.you` is a SEPARATE origin with its OWN
 * storage — its heavy outlets/journalists cache never touches this dashboard cache.
 *
 * SAFETY (cross-deploy shape drift, with no per-deploy bust):
 * `buster` (manual version, bumped by hand on an incompatible shape change) is the
 * only forced invalidation; `safeParse` / `z.coerce` on list readers, keep-last-good
 * `structuralSharing`, and the org-scoped `prefix` each tolerate a drifted shape.
 * The allowlist is an INVENTORY of live roots (default-OFF still holds for a future
 * UNKNOWN root, so a new query is opt-in, never silently auto-persisted).
 */

/**
 * Persisted-cache freshness window (the per-query persister `maxAge`). 30 DAYS,
 * and the fact that it is FINITE is the point.
 *
 * It used to be `Infinity`, on the reasoning that the per-query persister decouples
 * disk retention from `gcTime`, so keeping everything forever pins nothing in the JS
 * heap. That reasoning holds for one entry and fails for the STORE: nothing in the
 * design ever deleted anything, so every response this console has received since the
 * cache shipped was still on disk — across every god-mode org ever visited — and the
 * boot-time restore read all of it into memory at once (see `sweepStaleEntries`).
 *
 * 30 days is picked against how staff actually return to a page: a page opened in a
 * normal week never comes near it, and the bucket of an org visited once in March
 * disappears. The cost of the bound is that a page untouched for a month
 * cold-skeletons ONCE, then is instant again — which is a fair price for a snapshot
 * whose age already made it a poor thing to paint.
 */
export const PERSIST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
  // The platform leg catalogue — no org, no auth, one answer for every tenant.
  "publicChannelLegs",
  // Tenant identity — the sidebar switcher's org label + Clerk avatar. Clerk is the
  // only source of an org's name and it hydrates asynchronously, so without a disk
  // snapshot the switcher reads "Dashboard" for the first second of every load.
  "orgIdentity",
  // Navigation / config / registries.
  "features",
  "feature",
  "statsRegistry",
  "entityRegistry",
  // Billing — the account, its credit grants and its payment history.
  "billingAccount",
  "creditGrants",
  "billingPayments",
  // The org's own referral code, behind the sidebar's invite link. Tiny, and it
  // never changes, so an unlisted root would cold-fetch on every single load.
  "inviteStatus",
  // Free credits committed but not yet granted, on the Billing page.
  "freeCreditPromises",
  // Brand metadata + config + small summaries.
  "brand",
  "brands",
  "brandSalesEconomics",
  "brandFunnelBudgets",
  // The fleet price list behind a funnel-leg card. Public and org-less, so it is the
  // same answer for every tenant — and it changes on the fleet's cadence, not this
  // brand's, which is exactly what a cached-to-disk read is for.
  "channelFunnelEconomics",
  // What the brand may actually spend today (campaign status joined to its ceilings,
  // served by campaign-service). An unlisted root is default-OFF, so the header's
  // money cold-skeletons on every visit without this line.
  "brandSpendableBudget",
  "brandDailyBudget",
  "brandConversionToken",
  // Offers — the level between the brand and its campaigns. The list feeds the brand
  // Overview's Offers table AND the tenant switcher's third tier, and the by-id read
  // is the offer sidebar's own label.
  "brandOffers",
  "brandOffer",
  // Offer Settings reads both of these on every visit, over the slow brand-service
  // path. Each key carries the offer, so two propositions never share an entry.
  "offerUserFields",
  "offerSalesFunnels",
  // The funnel grain, between the offer and its campaigns: the offer's Sales-funnels
  // table and the per-funnel Overview it drills into. Each key carries the offer and
  // the funnel key, so two funnels never share an entry.
  "offerFunnels",
  "offerFunnelRevenue",
  "offerFunnelPipelineActivity",
  // The brand's WHOLE lead population. Big — over the size cap on a heavy brand (44.5 MB
  // over 12,945 rows on one, 99 MB on the largest), so it is allowlisted and still
  // refused at write time; the query keeps `keepPreviousData` in memory and the
  // per-query persister restores it lazily on its own fetch. The Leads page no longer
  // reads it: it asks for one page at a time (`leadsPage` below). What still does is the
  // funnel-leg board, which partitions the population rather than paging it.
  "brandLeads",
  // ONE page of a scope's leads, and every bucket's count. These are what the Leads page
  // reads now, and the point of them is that each entry is SMALL enough to be written:
  // a 50-row page is a few hundred KB against the 2 MB cap, so the table paints from
  // disk on arrival instead of cold-loading a whole population every visit. Each key
  // carries the scope, the tab, the search and the page number, so two windows onto one
  // brand never share an entry.
  "leadsPage",
  "leadBucketCounts",
  // Per-lead generated email content — the leads detail-panel fetch, click-gated, so
  // re-opening a lead paints its last-known email from disk.
  "leadEmail",
  // What a human stated about a lead's reply, behind the same detail panel. Written by
  // the mutation's own `setQueryData`, so an unlisted root would cold-fetch it back on
  // every panel open.
  "leadReplyKind",
  // Every reply kind stated on one campaign, read once and joined by email so the
  // leads BOARD places its cards without a request per card.
  "campaignReplyKinds",
  // Feature-level stats / revenue / activity.
  "featureStats",
  "featureRevenue",
  // The offer and brand grains of the same money — a page scoped to one of them asks
  // features-service across every channel it covers, so these are DIFFERENT answers
  // from the per-feature entry above and get their own roots.
  "offerRevenue",
  "brandRevenue",
  "featureRevenueByCampaign",
  "brandOfferMoney",
  "featurePipelineActivity",
  "featureAudienceStats",
  // Audiences.
  "audiences",
  // The per-workflow projection behind the best-model card and the budget steps.
  "workflowProjection",
  // Campaigns.
  "campaign",
  "campaigns",
  "campaignLeads",
]);

export interface PersistableQuery {
  state: { status: string };
  queryKey: readonly unknown[];
}

/**
 * Decide whether a query KEY is eligible for the persisted cache — NON-sensitive +
 * ALLOWLISTED. Deliberately STATUS-AGNOSTIC: this is the predicate the per-query
 * persister (`experimental_createQueryPersister`) evaluates ONCE at the top of its
 * wrapped queryFn, and that one verdict gates BOTH the restore (which runs while the
 * query is still `pending`, data `undefined`) AND the post-fetch persist. A status
 * check here (`=== "success"`) makes the predicate `false` at restore time → the
 * persister NEVER restores AND NEVER writes → a silent total no-op (every load cold-
 * fetches). So status MUST NOT be part of this predicate; the persister itself only
 * reaches its persist line after a successful `queryFn` (an error throws first), so
 * errors are never persisted regardless. Default OFF: an unlisted root never persists.
 */
export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean {
  const root = String(queryKey[0] ?? "");
  if (SENSITIVE_QUERY_ROOTS.has(root)) return false;
  return PERSISTABLE_QUERY_ROOTS.has(root);
}

/**
 * Status-AWARE variant (success + {@link isPersistableQueryKey}). For dehydrate-style
 * callers that evaluate an ALREADY-RESOLVED query (the old whole-client
 * `shouldDehydrateQuery`); do NOT use it as the per-query persister `filters.predicate`
 * — see the no-op trap documented on {@link isPersistableQueryKey}.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  if (query.state.status !== "success") return false;
  return isPersistableQueryKey(query.queryKey);
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
 * slow Neon path. The shape almost never changes; the SHA always does — so the
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

/** Shape of a value written by the per-query persister (`serialize({state, queryKey, queryHash, buster})`). */
export interface StoredQuerySnapshot {
  queryKey: readonly unknown[];
  buster?: string;
  state?: { data?: unknown; dataUpdatedAt?: number };
}

export interface ColdRestore {
  queryKey: readonly unknown[];
  data: unknown;
  updatedAt: number | undefined;
}

/**
 * From raw IndexedDB `[key, value]` entries, pick the query snapshots that should be
 * seeded into a COLD (memory-empty) query — the payload of the nav-time reseed in
 * query-provider.tsx (`reseedColdQueriesFromDisk`).
 *
 * WHY this exists on top of the persister's own restore paths: the per-query persister
 * self-restores a query from disk ONLY when that query FETCHES (i.e. `enabled`), and the
 * persister's own restore paths never run for a query that does not fetch. So a page
 * entered while the org-consistency gate is momentarily CLOSED (Clerk active-org still
 * settling → every `useAuthQuery` disabled → never fetches → never self-restores), or an
 * in-app nav to a sub-page whose memory was GC'd, paints a SKELETON even though its stale
 * snapshot sits on disk. Backend-healthy hides it (the network eventually answers);
 * backend-DOWN turns the transient into a STUCK skeleton — the reported bug. Re-seeding
 * cold queries from disk on every org-scoped navigation closes that window.
 *
 * Three guards keep it safe:
 *  - PREFIX: only this org's keys (`${prefix}-…`) — never bleed another org (DIS-143).
 *  - BUSTER: skip a snapshot whose `buster` ≠ the current version (incompatible shape;
 *    the persister GCs it on its own restore) — never paint stale-shaped data.
 *  - COLD-GUARD: `hasData(queryKey)` — skip a query that ALREADY holds in-memory data, so
 *    a reseed can never STOMP a fresher live value with an older disk snapshot.
 *
 * Pure (no React / IndexedDB) so it unit-tests in plain node, like the rest of this file.
 */
export function coldRestorablePairs(
  entries: readonly (readonly [string, string])[],
  prefix: string,
  buster: string,
  hasData: (queryKey: readonly unknown[]) => boolean,
): ColdRestore[] {
  const out: ColdRestore[] = [];
  const keyPrefix = `${prefix}-`;
  for (const [key, value] of entries) {
    if (typeof key !== "string" || !key.startsWith(keyPrefix)) continue;
    let snap: StoredQuerySnapshot;
    try {
      snap = JSON.parse(value) as StoredQuerySnapshot;
    } catch {
      continue; // corrupt entry — the persister removes it on its own restore/GC pass
    }
    if (!snap || !Array.isArray(snap.queryKey)) continue;
    if ((snap.buster ?? "") !== buster) continue; // busted → don't paint incompatible data
    const data = snap.state?.data;
    if (data === undefined) continue; // nothing was ever painted → nothing to seed
    if (hasData(snap.queryKey)) continue; // COLD-GUARD: never overwrite fresher memory
    out.push({ queryKey: snap.queryKey, data, updatedAt: snap.state?.dataUpdatedAt });
  }
  return out;
}

/**
 * The half-open key range that holds exactly ONE bucket's entries.
 *
 * Every persisted entry is stored under `${prefix}-${queryHash}`, and IndexedDB
 * orders keys lexicographically, so a bucket's entries are CONTIGUOUS and can be
 * read with a bounded `getAll` instead of a full-store scan. `￿` is the
 * largest code unit, so the upper bound sorts after every real query hash while
 * still sorting before the next bucket's prefix.
 *
 * This is what stops one page's boot from materializing every org's cache: the
 * persister's own `restoreQueries` / `persisterGc` call `storage.entries()` and
 * only THEN filter on `key.startsWith(prefix)`, so a whole-store `entries()`
 * loads every byte the console has ever cached before discarding almost all of
 * it. Scoping the read at the storage adapter fixes both of them at once.
 */
export function bucketKeyBounds(prefix: string): [lower: string, upper: string] {
  return [`${prefix}-`, `${prefix}-￿`];
}

/**
 * Should this stored entry be deleted?
 *
 * Mirrors the persister's own `isExpiredOrBusted`, deliberately: the sweep and the
 * persister must agree on what "stale" means, or the sweep deletes something the
 * persister would happily have restored (a needless cold load) or keeps something
 * the persister will discard on read (dead weight forever). Two reasons to delete,
 * plus one for a value that cannot be read at all:
 *
 *  - EXPIRED — older than `maxAgeMs`. `Infinity` means nothing ever expires by age.
 *  - BUSTED  — written under a different cache version, so its shape may not match
 *              what the components reading it now expect.
 *  - UNREADABLE — not JSON, or carries no timestamp. Nothing can be done with it.
 *
 * Pure (takes `now`), so the day-boundary cases are unit-testable.
 */
export function snapshotIsStale(
  value: string,
  buster: string,
  now: number,
  maxAgeMs: number,
): boolean {
  let snap: StoredQuerySnapshot;
  try {
    snap = JSON.parse(value) as StoredQuerySnapshot;
  } catch {
    return true; // unreadable — the persister removes these on its own read too
  }
  if (!snap || typeof snap !== "object") return true;
  if ((snap.buster ?? "") !== buster) return true;
  const updatedAt = snap.state?.dataUpdatedAt;
  if (typeof updatedAt !== "number") return true;
  return now - updatedAt > maxAgeMs;
}

/**
 * Key marking that the one-time reclaim of the pre-bounded store has run.
 *
 * The store that existed before this shipped has no expiry and no bucket scoping,
 * so nothing in the new code would ever reach most of it: `sweepStaleEntries` will
 * bound it going forward, but entries written last week are not stale yet and the
 * bulk of the bytes are exactly those. A single `clear()` reclaims it in one go, at
 * the cost of one cold load per page, once ever.
 *
 * Suffix bumps only if the store ever has to be reclaimed again.
 */
export const RECLAIM_MARKER_KEY = "distribute-cache-reclaimed:1";

/**
 * Largest snapshot the disk cache will accept, in UTF-16 code units (what
 * `String.prototype.length` counts, which is what a JS string costs to hold and to
 * structured-clone in and out of IndexedDB).
 *
 * There was no cap, and the store is one flat key space the nav reseed reads as a
 * unit, so ONE oversized entry taxed every page in the org. The brand leads list is
 * the offender: it is unpaginated by design (the revenue engine and this page both
 * want the whole population — see CLAUDE.md), and on a heavy brand the slim
 * `view=basic` projection is still ~100MB. Writing that on every change and reading
 * it back on every navigation is the whole of the reported "dashboard is slow".
 *
 * 2MB is picked as "large enough that every ordinary page still paints from disk,
 * small enough that no single entry can dominate a bucket read". A refused entry is
 * NOT a broken page: the query keeps `keepPreviousData` in memory and the per-query
 * persister still restores it lazily when it fetches. The only cost is that a truly
 * enormous list can cold-load once per session instead of painting from disk — which
 * is the right trade, because reading it from disk was never fast either.
 */
export const MAX_PERSISTED_ENTRY_BYTES = 2 * 1024 * 1024;

/** Is this serialized snapshot too large to be worth putting on disk? */
export function entryIsTooLargeToPersist(value: string): boolean {
  return value.length > MAX_PERSISTED_ENTRY_BYTES;
}

/**
 * Recover a query key from its STORAGE key, without reading the value.
 *
 * This is the whole point of the keys-first reseed. Every entry is stored under
 * `${prefix}-${queryHash}` and the hash is a stable `JSON.stringify` of the query
 * key, so the key alone answers "which query is this?" — the value is only needed
 * for the queries that turn out to be cold. Before this, the reseed pulled EVERY
 * value in the bucket over the IndexedDB boundary and `JSON.parse`d each one, then
 * discarded the ones whose query was already warm. On a bucket holding a big list
 * that is tens of megabytes of transfer and main-thread parse, per navigation.
 *
 * Returns null for anything that is not this bucket's key or does not carry a JSON
 * array — a foreign key, the reclaim marker, a hand-written entry.
 */
export function queryKeyFromStorageKey(
  key: string,
  prefix: string,
): readonly unknown[] | null {
  const keyPrefix = `${prefix}-`;
  if (typeof key !== "string" || !key.startsWith(keyPrefix)) return null;
  const hash = key.slice(keyPrefix.length);
  try {
    const parsed = JSON.parse(hash) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The storage keys whose query is COLD (holds no in-memory data) and therefore worth
 * fetching. Same cold-guard as `coldRestorablePairs` — never stomp fresher memory —
 * applied one step earlier, so a warm query costs a string comparison instead of a
 * value read plus a parse.
 */
export function coldStorageKeys(
  keys: readonly string[],
  prefix: string,
  hasData: (queryKey: readonly unknown[]) => boolean,
): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const queryKey = queryKeyFromStorageKey(key, prefix);
    if (!queryKey) continue;
    if (!isPersistableQueryKey(queryKey)) continue; // dead / sensitive root left on disk
    if (hasData(queryKey)) continue; // COLD-GUARD
    out.push(key);
  }
  return out;
}

/**
 * Parse ONE fetched value into a seedable snapshot, or null.
 *
 * The per-entry half of `coldRestorablePairs`, so the reseed can parse exactly the
 * values it asked for. Same buster and empty-data guards; the cold guard already ran
 * on the key.
 */
export function coldRestoreFromValue(
  key: string,
  value: string,
  prefix: string,
  buster: string,
): ColdRestore | null {
  const queryKey = queryKeyFromStorageKey(key, prefix);
  if (!queryKey) return null;
  let snap: StoredQuerySnapshot;
  try {
    snap = JSON.parse(value) as StoredQuerySnapshot;
  } catch {
    return null; // corrupt — the persister removes it on its own restore/GC pass
  }
  if (!snap || !Array.isArray(snap.queryKey)) return null;
  if ((snap.buster ?? "") !== buster) return null; // busted → don't paint incompatible data
  const data = snap.state?.data;
  if (data === undefined) return null; // nothing was ever painted → nothing to seed
  return { queryKey: snap.queryKey, data, updatedAt: snap.state?.dataUpdatedAt };
}
