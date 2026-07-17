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
 *      retention is DECOUPLED from `gcTime`. That lets us keep `maxAge: Infinity`
 *      (disk = keep forever → never expire → no cross-session cold skeleton) WITHOUT
 *      pinning everything in the JS heap forever. `gcTime` stays a modest bound on
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
 * Persisted-cache freshness window (the per-query persister `maxAge`). `Infinity`
 * = NEVER expire on disk → opening any page on a later session/day paints its
 * last-known content instantly, then revalidates in the background (SWR). Safe to
 * be infinite ONLY because the persister is PER-QUERY: disk retention is decoupled
 * from `gcTime`, so "keep forever on disk" does NOT pin everything in the JS heap.
 * Shape drift across deploys is handled by `buster` + safeParse, not by expiry.
 */
export const PERSIST_MAX_AGE_MS = Infinity;

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
  return !SENSITIVE_QUERY_ROOTS.has(root);
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
 * mount seed (`persister.restoreQueries`) is one-shot per provider mount. So a page
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
