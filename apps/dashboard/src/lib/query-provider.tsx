"use client";

import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  type Query,
} from "@tanstack/react-query";
import { experimental_createQueryPersister } from "@tanstack/react-query-persist-client";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { useOrganization } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PERSIST_GC_TIME_MS,
  PERSIST_MAX_AGE_MS,
  coldRestoreFromValue,
  coldStorageKeys,
  entryIsTooLargeToPersist,
  persistCacheVersion,
  persisterStorageKey,
  isPersistableQueryKey,
} from "@/lib/persist-cache";
import {
  bucketEntries,
  bucketKeys,
  reclaimLegacyStore,
  sweepStaleEntries,
  valuesForKeys,
} from "@/lib/idb-bucket";
import { installIdleFocusManager } from "@/lib/idle-focus-manager";

/**
 * Ask the browser to make the origin's storage PERSISTENT (best-effort → durable).
 * Without this grant, IndexedDB is "best-effort" and the browser evicts the WHOLE
 * store under disk pressure or after prolonged non-use — silently wiping the
 * local-first query cache after a few idle days, so a returning visitor hits the
 * cold path (empty cache + the org-consistency gate disabling reads) and sees an
 * infinite skeleton. The persister's own `maxAge` is meaningless while the store
 * itself is evictable; this grant is what actually makes "instant while the snapshot
 * is still worth painting" true. Idempotent + guarded (feature-detected, no-op if already persisted
 * or unsupported); never throws into the render path.
 */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // Storage API can throw in private-mode / locked-down contexts — non-fatal,
    // the cache just stays evictable (the pre-existing behavior).
  }
}

/**
 * IndexedDB-backed storage adapter for the per-query persister. The persister only
 * needs the AsyncStorage `getItem / setItem / removeItem` triple; idb-keyval gives
 * us exactly that against IndexedDB — which has NO ~5MB per-origin Web-Storage cap,
 * so big lists (leads/emails) persist without evicting the small overview queries,
 * and writes happen off the main thread (no serialize jank).
 */
function makeIdbStorage(prefix: string) {
  return {
    getItem: (key: string) => idbGet(key),
    // SIZE-CAPPED. The store is one flat key space that the nav reseed reads as a
    // unit, so a single oversized snapshot taxes every page in the org — and the
    // brand leads list is unpaginated by design (~100MB of slim rows on a heavy
    // brand). Refusing it is not a broken page: the query keeps `keepPreviousData`
    // in memory and the per-query persister still restores it lazily on its own
    // fetch. An entry that was small yesterday and is oversized today is DELETED
    // rather than left behind, or the stale copy would outlive every write.
    setItem: (key: string, value: string) =>
      entryIsTooLargeToPersist(value) ? idbDel(key) : idbSet(key, value),
    removeItem: (key: string) => idbDel(key),
    // SCOPED TO THIS ORG, which is the whole point. The persister's own
    // `restoreQueries` / `persisterGc` call `entries()` and only then filter on
    // `key.startsWith(prefix)`, so an unscoped implementation hands them every byte
    // this browser has ever cached — every org this account has opened, since the
    // cache shipped — to throw almost all of it away. A bounded `getAll` over the
    // org's contiguous key range returns exactly the same list they would have kept.
    entries: () => bucketEntries(prefix),
  };
}

/**
 * Re-seed COLD (memory-empty) queries from THIS org's on-disk snapshot on every
 * org-scoped navigation — NOT only on provider mount. The per-query persister
 * self-restores a query from disk only when it FETCHES (i.e. `enabled`), so a page entered while the
 * org-consistency gate is momentarily CLOSED (Clerk active-org still settling → every
 * `useAuthQuery` disabled → never fetches), or a sub-page whose memory was GC'd, paints a
 * SKELETON even though its stale snapshot is on disk. Backend-healthy hides it (the
 * network answers eventually); backend-DOWN turns it into a STUCK skeleton — the "5-min
 * skeleton on a page I open 10×/day" report. Painting the disk snapshot is the whole
 * point of a local-first cache: backend down MUST degrade to stale, never to a skeleton.
 *
 * READ-ONLY (pure `setQueryData`, zero network → no cross-org request → DIS-143 gate
 * untouched), ORG-PREFIXED, BUSTER-checked, and COLD-GUARDED (never overwrites fresher
 * in-memory data — see coldRestorablePairs). Best-effort: never throws into render.
 */
async function reseedColdQueriesFromDisk(
  client: QueryClient,
  orgId: string,
): Promise<void> {
  const prefix = persisterStorageKey(orgId);
  try {
    // KEYS FIRST, VALUES ONLY FOR WHAT IS COLD. This used to be one `getAll` over
    // the whole bucket followed by a `JSON.parse` of every value, on EVERY
    // navigation — including the entries whose query was already warm in memory and
    // whose value was therefore parsed only to be discarded. With a big list in the
    // bucket that is tens of megabytes of IndexedDB transfer plus main-thread parse
    // per page change, which is what the dashboard's slowness actually was. A query
    // key is recoverable from its STORAGE key, so the cold-guard now runs on a
    // string comparison and only the survivors are read.
    const keys = await bucketKeys(prefix);
    const cold = coldStorageKeys(
      keys,
      prefix,
      (queryKey) => client.getQueryData(queryKey) !== undefined,
    );
    if (cold.length === 0) return;
    const entries = await valuesForKeys(cold);
    const buster = persistCacheVersion();
    for (const [key, value] of entries) {
      const restore = coldRestoreFromValue(key, value, prefix, buster);
      if (!restore) continue;
      // Re-check coldness: the value read is a second round-trip, so a query that
      // was cold when we listed the keys may have resolved in between. Seeding it
      // now would stomp fresher data with an older snapshot.
      if (client.getQueryData(restore.queryKey) !== undefined) continue;
      client.setQueryData(
        restore.queryKey,
        restore.data,
        restore.updatedAt != null ? { updatedAt: restore.updatedAt } : undefined,
      );
    }
  } catch {
    // IndexedDB can throw in private-mode / locked-down contexts — non-fatal, the
    // enabled-query self-restore still covers the common path.
  }
}

/**
 * One QueryClient per org mount. The PER-QUERY persister (not the whole-client one)
 * is wired as a default query option: it wraps each `queryFn` and, on mount, returns
 * the query's last-known value straight from IndexedDB BEFORE hitting the network —
 * so opening a page paints its content instantly, then revalidates silently (SWR).
 *
 * - `maxAge: PERSIST_MAX_AGE_MS` — 30 days. Finite, because nothing else deleted
 *   anything and the store grew without limit; see persist-cache.ts.
 * - `gcTime: PERSIST_GC_TIME_MS` — bounds MEMORY only; disk retention is independent
 *   (a heap-GC'd query stays on disk), so "keep forever" costs no unbounded heap.
 * - `prefix: persisterStorageKey(orgId)` — org-scopes every per-query key (DIS-143).
 *   `storage: undefined` while the org is unresolved → no anon-bucket cross-org bleed.
 * - `buster: persistCacheVersion()` — MANUAL version; bumped by hand only on an
 *   incompatible response-shape change (NOT the per-deploy SHA, which wiped the cache
 *   ~every visit). See persist-cache.ts.
 * - `filters.predicate` — only successful, non-sensitive, allowlisted queries persist
 *   (key material never touches disk).
 */
function makeQueryClient(orgId: string | null) {
  const persistEnabled = typeof window !== "undefined" && !!orgId;
  const persister = experimental_createQueryPersister({
    storage: persistEnabled ? makeIdbStorage(persisterStorageKey(orgId)) : undefined,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: persistCacheVersion(),
    prefix: persisterStorageKey(orgId),
    // STATUS-AGNOSTIC predicate (matches on the query key only). The persister
    // evaluates this ONCE at the top of its wrapped queryFn and uses the verdict for
    // BOTH restore (query still `pending`) AND persist — a `status === "success"`
    // check here would be `false` at restore time → the persister silently never
    // restores and never writes (a total no-op). See isPersistableQueryKey.
    filters: {
      predicate: (query: Query) => isPersistableQueryKey(query.queryKey),
    },
  });

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Memory bound only; disk persists independently (per-query persister).
        gcTime: PERSIST_GC_TIME_MS,
        // Local-first: restore each query from IndexedDB before the network.
        persister: persister.persisterFn,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });

  return { client, persister };
}

/**
 * One QueryClient per org id. A fresh mount => fresh (EMPTY) in-memory cache + a
 * persister whose storage keys are prefixed with THIS org's id => atomic per-org
 * isolation (DIS-143). The outer QueryProvider remounts this under `key={orgKey}`
 * on switch, so neither the in-memory cache nor the disk key space of the previous
 * org can bleed across.
 */
function OrgScopedQueryClientProvider({
  orgId,
  children,
}: {
  orgId: string | null;
  children: ReactNode;
}) {
  // Created once per mount; the component is keyed by orgId upstream, so this runs
  // fresh per org and the persister prefix can never point at another org's keys.
  //
  // The disk read is KICKED HERE, in the initializer, not in the effect below. An
  // effect runs after the children have already mounted and rendered, so the first
  // page of a session paints its skeleton and only then starts asking IndexedDB what
  // it should have shown. Starting the read during the first render buys back that
  // whole commit — the read is fire-and-forget either way, and `setQueryData` on a
  // client nobody is rendering yet is a no-op that lands before the first paint when
  // it wins the race and behaves exactly as before when it does not.
  const [{ client }] = useState(() => {
    const made = makeQueryClient(orgId);
    if (orgId && typeof window !== "undefined") {
      void reseedColdQueriesFromDisk(made.client, orgId);
    }
    return made;
  });
  const pathname = usePathname();
  // Only re-seed on org-scoped routes (nothing to gate / restore off `/orgs/…`).
  const isOrgScopedRoute = !!pathname && /\/orgs\/[^/]+/.test(pathname);

  // There is deliberately NO `persister.restoreQueries(client)` here.
  //
  // It used to run on mount, beside the nav reseed below — and because `pathname` is
  // in that effect's deps, BOTH fired on the very first render, so every mount read
  // this org off disk twice and decoded it twice. The reseed is the better of the two:
  // it is COLD-GUARDED (`restoreQueries` calls `setQueryData` unconditionally and will
  // overwrite a fresher in-memory value with an older snapshot), and it re-runs on each
  // navigation, which is what the disabled-query case actually needs. Adding the mount
  // restore back reinstates the duplicate read and the stomp.

  // NAV RESEED. The per-query self-restore only
  // fires for an ENABLED (fetching) query, so a page reached while the org gate is
  // closed — or a sub-page whose memory was GC'd — cold-skeletons even though its disk
  // snapshot exists, and a DOWN backend makes that skeleton stick. Re-seed cold queries
  // from disk on every org-scoped route change so the local-first cache always paints
  // its stale content instead of a skeleton. COLD-GUARDED (never stomps fresher memory)
  // and org-prefixed, so re-running it on each navigation is safe and cheap.
  // The initializer above already kicked the mount read, and `pathname` is in these
  // deps, so without this latch every mount would read the bucket TWICE — the exact
  // duplicate the removed `restoreQueries` used to cause.
  const mountReadKicked = useRef(true);
  useEffect(() => {
    if (mountReadKicked.current) {
      mountReadKicked.current = false;
      return;
    }
    if (orgId && isOrgScopedRoute) void reseedColdQueriesFromDisk(client, orgId);
  }, [pathname, isOrgScopedRoute, orgId, client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function QueryProvider({
  children,
  scope,
}: {
  children: ReactNode;
  /**
   * `"onboarding"` opts this provider OUT of org-keyed remounting — see the
   * `isOnboarding` block below. Declared by the layout that mounts it rather than
   * sniffed from the pathname, so it cannot flip mid-flight while the router is
   * navigating away at the end of the flow.
   */
  scope?: "onboarding";
}) {
  // ClerkProvider lives in `(authed)/layout.tsx`, an ancestor of every consumer
  // of this provider (dashboard + onboarding), so `useOrganization` is safe.
  const { organization } = useOrganization();
  const pathname = usePathname();
  const isOnboarding = scope === "onboarding";

  // PER-TAB org key. The cache MUST be scoped to the org THIS TAB is viewing —
  // the URL `/orgs/[id]`, NOT Clerk's active org. Clerk's active org is a SHARED,
  // browser-global value (the session cookie is a singleton) that flips when ANOTHER
  // tab switches org (Clerk re-reads the cookie on focus). Keying the remount on
  // `useOrganization()` therefore remounted this whole subtree every time a sibling
  // tab switched — the "org oscillates between tabs" storm. The URL is the per-tab
  // source of truth and never flips cross-tab, so key on it. Fall back to the active
  // org only OFF the /orgs/ tree (e.g. onboarding, no URL org). (#1948)
  const urlOrgId = pathname?.match(/\/orgs\/([^/?#]+)/)?.[1] ?? null;
  const orgId = urlOrgId ?? organization?.id ?? null;

  // Pause all interval polling when the tab is hidden OR the user is idle.
  // Installed once on the global focusManager (singleton) — survives org-switch
  // remounts of the inner provider. Stops the continuous DOM churn that feeds
  // PostHog's rrweb recorder and OOMs long-lived tabs. See idle-focus-manager.ts.
  useEffect(() => installIdleFocusManager(), []);

  // Make the cache survive idle days: request persistent storage once at boot so
  // the browser stops evicting the IndexedDB store the local-first cache lives in.
  // The single biggest lever against "instant right after a deploy, then infinite
  // skeleton a few days later" — an evicted store drops the returning visitor onto
  // the cold path. Fire-and-forget, guarded, never blocks render.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Keep the store BOUNDED. Nothing used to delete anything: `maxAge` was `Infinity`
  // and the persister's own garbage collection was never called, so the cache held
  // every response this browser had received since it shipped, for every org this
  // account has opened. Two passes, both fire-and-forget after paint:
  //
  //  - `reclaimLegacyStore` drops what accumulated under that regime, once ever. The
  //    sweep alone cannot: most of those bytes are recent enough not to be stale.
  //  - `sweepStaleEntries` is the ongoing bound — a cursor walk in constant memory,
  //    across every org bucket, deleting what `PERSIST_MAX_AGE_MS` and the cache
  //    version say is no longer worth painting.
  //
  // Order matters only in that reclaiming first leaves the sweep nothing to do on the
  // one boot they share.
  useEffect(() => {
    if (typeof window === "undefined") return;
    void (async () => {
      try {
        await reclaimLegacyStore();
        await sweepStaleEntries(
          persistCacheVersion(),
          Date.now(),
          PERSIST_MAX_AGE_MS,
        );
      } catch (err) {
        // Disk housekeeping — a failure costs storage, never correctness, so it must
        // not reach the render path. Logged rather than swallowed.
        console.error("[dashboard] persisted-cache housekeeping failed", err);
      }
    })();
  }, []);

  // Atomically reset the ENTIRE in-memory React Query cache on org switch by
  // remounting under a new `key` (TanStack canonical multi-tenant pattern). New
  // mount => new QueryClient (empty in-memory) + a persister whose keys are prefixed
  // with the new org id => a fresh per-org disk key space. Stronger than
  // `queryClient.clear()`, which races by refetching still-mounted observers under
  // the new org's JWT (the DIS-143 cross-org 404). Paired with the proxy's
  // server-side fail-closed org guard (`checkProxyOrg`) for defense in depth.
  //
  // NOTE: this remounts the whole authed subtree on switch, which is ALSO what
  // resets the tenant-switcher's org/brand labels — there is no separate cache to
  // clear (the labels are ordinary persisted queries under this org's prefix).
  // Monotonic org latch for the remount `key`. Clerk's `useOrganization()` blinks
  // `organization: null` transiently during background JWT rotation (~1/min) and on
  // tab focus/reconnect (CLAUDE.md "Readiness gates MUST be monotonic — never blank a
  // mounted subtree on a transient auth-loading flip"). A raw `orgId ?? "no-org"` key
  // flips realId→"no-org"→realId on every blink, remounting OrgScopedQueryClientProvider
  // = a brand-new EMPTY QueryClient. The per-query persister rehydrates each page from
  // IndexedDB on mount, so this is far less visible than before, but a real switch to a
  // DIFFERENT org still changes the id → remount + fresh per-org prefix, preserving
  // DIS-143 isolation. So advance the key ONLY when a resolved org id is present; a
  // null blink keeps the last id.
  const lastOrgId = useRef<string | null>(null);
  if (orgId) lastOrgId.current = orgId;
  const stableOrgId = lastOrgId.current;

  // ONBOARDING opts out of org keying entirely, because the flow CREATES the org
  // it will end up in. `/onboarding?new=1` calls Clerk `createOrganization` +
  // `setActive` in the middle of the loading screen, so `useOrganization()` flips
  // to a brand-new id — which, under an org-derived key, remounts this provider and
  // therefore the whole onboarding component. Its `useState` resets, the persisted
  // snapshot resolves a mid-flight "loading" step back to "url", and the user is
  // thrown back to the step before while the detached create keeps running in the
  // background (brand created, never shown). A constant key keeps the flow mounted
  // across the org switch; the terminal `router.push("/orgs/<new>/…")` leaves this
  // subtree for the dashboard's own provider, which keys on the new org and gets a
  // fresh per-org cache — so DIS-143 isolation is unchanged.
  //
  // `orgId` is null here on purpose: the persister is org-prefixed, and writing
  // queries fetched after the switch under the PREVIOUS org's prefix is exactly the
  // cross-org disk bleed the prefix exists to prevent. Null disables persistence
  // (`persistEnabled`), so onboarding runs on an in-memory cache. Nothing is lost —
  // the route is transient, and the first-frame tenant identity comes from the
  // server-read cookie, not from disk.
  const scopedOrgId = isOnboarding ? null : stableOrgId;
  const orgKey = isOnboarding ? "onboarding" : stableOrgId ?? "no-org";

  return (
    <OrgScopedQueryClientProvider key={orgKey} orgId={scopedOrgId}>
      {children}
    </OrgScopedQueryClientProvider>
  );
}

export { QueryClient };
