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
 * POLICY (admin = staff god-mode console): admin is a LOCAL-FIRST, stale-while-
 * revalidate (SWR) surface — the on-disk cache is the source the UI paints FIRST,
 * the network is secondary (TkDodo: "stale data is better than no data, because no
 * data means a loading spinner = perceived slow"). Ported from the dashboard's
 * per-query IndexedDB persister (2026-06-25). Unlike the customer dashboard — which
 * keeps a curated ALLOWLIST because it is a public multi-tenant surface — admin is
 * STAFF-ONLY on a SEPARATE origin and every page's data is visible to staff, so the
 * predicate here is a DENYLIST: persist EVERY successful root EXCEPT key material.
 * That way any NEW admin page cold-skeletons on its first-ever load only, then
 * paints instantly from disk on every later visit, with zero allowlist maintenance.
 *
 * PERSISTER = the PER-QUERY persister (`experimental_createQueryPersister`,
 * query-provider.tsx), NOT the old whole-client `persistQueryClient`. Two reasons it
 * is strictly better for this polling-heavy app (TanStack docs "createPersister"):
 *   1. Each query is written to storage SEPARATELY (keyed by its query hash), only
 *      when IT changes — so a 30s poll of one query does NOT re-serialize the whole
 *      cache. This kills the main-thread jank of the whole-client persister, which
 *      re-`dehydrate()`d the ENTIRE set on every mutation (#9775).
 *   2. A query persisted to disk survives even after it is GC'd from MEMORY — disk
 *      retention is DECOUPLED from `gcTime`. That lets disk retention run for weeks
 *      (no cross-session cold skeleton) WITHOUT pinning anything in the JS heap for
 *      anywhere near that long. `gcTime` stays a modest bound on
 *      MEMORY only; the disk holds it regardless.
 *
 * STORAGE = IndexedDB (idb-keyval), NOT localStorage. localStorage's hard ~5MB
 * per-origin cap was the regression: a big list blew the cap → `removeOldestQuery`
 * evicted the small overview queries → those pages cold-skeletoned on the slow Neon
 * chain (the very thing persist meant to prevent). IndexedDB has no such cap.
 *
 * NB admin ≠ dashboard: `admin.distribute.you` is a SEPARATE origin with its OWN
 * storage — this cache never touches the customer dashboard cache.
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
 * memory ONLY; it is INDEPENDENT of disk retention now that the persister is
 * per-query (a heap-GC'd query stays on disk up to `maxAge`, so the page still
 * restores instantly). 30 min covers "leave a page and come back" while short
 * enough that inactive big lists leave the heap.
 */
export const PERSIST_GC_TIME_MS = 30 * 60 * 1000;

/**
 * Query-key roots whose data is secret (key material) and must NEVER be written to
 * disk — IndexedDB is readable by any script on the origin. This is the ONLY
 * exclusion under the denylist policy above: every other successful root persists.
 */
export const SENSITIVE_QUERY_ROOTS = new Set(["apiKeys", "byokKeys", "keySources"]);

/**
 * Roots that must be ASKED AGAIN every time, for a reason that has nothing to do
 * with secrecy: their answer is only true for as long as the producer's own code
 * is unchanged.
 *
 * `mailingListUpdatePreview` is the case this exists for. It returns the HTML
 * transactional-email-service would send for a given body — which is the whole
 * point, since the alternative is rendering it here, and a second renderer
 * drifted from the producer once already. Persisting it at all
 * reintroduces exactly that drift through the back door: the producer improves
 * the email, the same draft body restores yesterday's HTML from disk, and the
 * author approves a render nobody will receive. It is one cheap call on a button
 * press, so there is nothing to save by caching it across sessions.
 *
 * `configFile` is the same shape of problem for a different reason. Its payload
 * carries the blob sha a save is validated against, and that sha is only true until
 * someone commits the file, which anyone with the repo can do at any moment. Painting
 * a restored copy would open an editor on yesterday's text holding yesterday's sha,
 * so every save from that session would be refused as a conflict. Reading it fresh is
 * one request on a click.
 */
export const EPHEMERAL_QUERY_ROOTS = new Set(["mailingListUpdatePreview", "configFile"]);

export interface PersistableQuery {
  state: { status: string };
  queryKey: readonly unknown[];
}

/**
 * Decide whether a query KEY is eligible for the persisted cache. DENYLIST: any
 * non-empty root that is NOT key material persists. Deliberately STATUS-AGNOSTIC:
 * this is the predicate the per-query persister (`experimental_createQueryPersister`)
 * evaluates ONCE at the top of its wrapped queryFn, and that one verdict gates BOTH
 * the restore (which runs while the query is still `pending`, data `undefined`) AND
 * the post-fetch persist. A status check here (`=== "success"`) makes the predicate
 * `false` at restore time → the persister NEVER restores AND NEVER writes → a silent
 * total no-op (every load cold-fetches). So status MUST NOT be part of this
 * predicate; the persister itself only reaches its persist line after a successful
 * `queryFn` (an error throws first), so errors are never persisted regardless.
 */
export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean {
  const root = String(queryKey[0] ?? "");
  if (!root) return false;
  return !SENSITIVE_QUERY_ROOTS.has(root) && !EPHEMERAL_QUERY_ROOTS.has(root);
}

/**
 * Status-AWARE variant (success + {@link isPersistableQueryKey}). For dehydrate-style
 * callers that evaluate an ALREADY-RESOLVED query; do NOT use it as the per-query
 * persister `filters.predicate` — see the no-op trap documented on
 * {@link isPersistableQueryKey}.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  if (query.state.status !== "success") return false;
  return isPersistableQueryKey(query.queryKey);
}

/**
 * Storage PREFIX for the per-query persister. Each query is stored under
 * `${prefix}-${queryHash}`. The `bucket` is the URL org id on an `/orgs/[id]/…`
 * god-mode page (so org A's persisted customer data never restores under org B —
 * DIS-143), or the fixed `"platform"` bucket on a cross-org fleet page (metrics,
 * audit, feature-stats — platform-global data not owned by any single org, so a
 * stable bucket makes those pages SWR regardless of the staff user's active org).
 */
export function persisterStorageKey(bucket: string | null | undefined): string {
  return `distribute-admin-cache:${bucket ?? "platform"}`;
}

/**
 * MANUAL cache version — the persister `buster`. Bump this string BY HAND, and
 * ONLY when a persisted query's response shape changes incompatibly (a renamed /
 * removed field a restored-from-disk component would crash on). On a bump the
 * persister `buster` mismatches and discards the whole disk cache, so stale-shaped
 * data never restores into new components.
 *
 * WHY NOT the git commit SHA (the previous `cacheBuildId` design): the SHA changes
 * on EVERY deploy, so the persister busted the entire cache on essentially every
 * visit → the persist work never survived to a return visit and every page
 * cold-skeletoned. The shape almost never changes; the SHA always does. This is
 * TanStack's own recommended pattern for actively deployed apps. Cross-deploy shape
 * safety still holds without the per-deploy bust: `safeParse` / `z.coerce` on the
 * list readers and keep-last-good `structuralSharing` tolerate a drifted shape.
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
 * backend-DOWN turns the transient into a STUCK skeleton. Re-seeding cold queries from
 * disk on every navigation closes that window.
 *
 * Three guards keep it safe:
 *  - PREFIX: only this bucket's keys (`${prefix}-…`) — never bleed another org (DIS-143).
 *  - BUSTER: skip a snapshot whose `buster` ≠ the current version (incompatible shape;
 *    the persister GCs it on its own restore) — never paint stale-shaped data.
 *  - COLD-GUARD: `hasData(queryKey)` — skip a query that ALREADY holds in-memory data, so
 *    a reseed never STOMPS a fresher live value with an older disk snapshot.
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
