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
import { useEffect, useState, type ReactNode } from "react";
import {
  PERSIST_GC_TIME_MS,
  PERSIST_MAX_AGE_MS,
  coldRestorablePairs,
  persistCacheVersion,
  persisterStorageKey,
  isPersistableQueryKey,
} from "@/lib/persist-cache";
import {
  bucketEntries,
  reclaimLegacyStore,
  sweepStaleEntries,
} from "@/lib/idb-bucket";
import { installIdleFocusManager } from "@/lib/idle-focus-manager";

/**
 * The cache bucket for THIS route (the persister prefix + the remount key). On a
 * god-mode `/orgs/[id]/…` page it is the URL org id, so org A's persisted customer
 * data never restores under org B (DIS-143). On a cross-org fleet page (metrics,
 * audit, feature-stats, features, workflows — platform-global data owned by no
 * single org) it is the fixed `"platform"` bucket, so those pages are SWR-instant
 * regardless of the staff user's Clerk active org. Derived from the URL (not the
 * shared/global Clerk active org), so it never flips cross-tab.
 */
function bucketForPath(pathname: string | null): string {
  return pathname?.match(/\/orgs\/([^/?#]+)/)?.[1] ?? "platform";
}

/**
 * Ask the browser to make the origin's storage PERSISTENT (best-effort → durable).
 * Without this grant, IndexedDB is "best-effort" and the browser evicts the WHOLE
 * store under disk pressure or after prolonged non-use — silently wiping the
 * local-first query cache after a few idle days, so a returning visitor hits the
 * cold path and sees an infinite skeleton. The persister's own `maxAge` is
 * meaningless while the store itself is evictable; this grant is what actually makes
 * "instant while the snapshot is still worth painting" true. Idempotent + guarded (feature-detected, no-op if
 * already persisted or unsupported); never throws into the render path.
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
 * so big lists persist without evicting the small overview queries, and writes
 * happen off the main thread (no serialize jank).
 */
function makeIdbStorage(prefix: string) {
  return {
    getItem: (key: string) => idbGet(key),
    setItem: (key: string, value: string) => idbSet(key, value),
    removeItem: (key: string) => idbDel(key),
    // SCOPED TO THIS BUCKET, which is the whole point. The persister's own
    // `restoreQueries` / `persisterGc` call `entries()` and only then filter on
    // `key.startsWith(prefix)`, so an unscoped implementation hands them every byte
    // this console has ever cached — every org, since the cache shipped — to throw
    // almost all of it away. A bounded `getAll` over the bucket's contiguous key
    // range returns exactly the same list they would have kept.
    entries: () => bucketEntries(prefix),
  };
}

/**
 * Re-seed COLD (memory-empty) queries from THIS bucket's on-disk snapshot on every
 * navigation — NOT only on provider mount. The per-query persister self-restores a
 * query from disk only when it FETCHES (i.e. `enabled`), so a page entered while the
 * org-consistency gate is momentarily CLOSED (Clerk active-org still settling → an
 * org-scoped `useAuthQuery` disabled → never fetches), or a sub-page whose memory was
 * GC'd, paints a SKELETON even though its stale snapshot is on disk. Backend-healthy
 * hides it (the network answers eventually); backend-DOWN turns it into a STUCK
 * skeleton. Painting the disk snapshot is the whole point of a local-first cache:
 * backend down MUST degrade to stale, never to a skeleton.
 *
 * READ-ONLY (pure `setQueryData`, zero network → no cross-org request → DIS-143 gate
 * untouched), BUCKET-PREFIXED, BUSTER-checked, and COLD-GUARDED (never overwrites
 * fresher in-memory data — see coldRestorablePairs). Best-effort: never throws.
 */
async function reseedColdQueriesFromDisk(
  client: QueryClient,
  bucket: string,
): Promise<void> {
  try {
    const all = await bucketEntries(persisterStorageKey(bucket));
    const pairs = coldRestorablePairs(
      all,
      persisterStorageKey(bucket),
      persistCacheVersion(),
      (queryKey) => client.getQueryData(queryKey) !== undefined,
    );
    for (const { queryKey, data, updatedAt } of pairs) {
      client.setQueryData(
        queryKey,
        data,
        updatedAt != null ? { updatedAt } : undefined,
      );
    }
  } catch {
    // IndexedDB can throw in private-mode / locked-down contexts — non-fatal, the
    // enabled-query self-restore still covers the common path.
  }
}

/**
 * One QueryClient per bucket mount. The PER-QUERY persister (not the whole-client
 * one) is wired as a default query option: it wraps each `queryFn` and, on mount,
 * returns the query's last-known value straight from IndexedDB BEFORE hitting the
 * network — so opening a page paints its content instantly, then revalidates
 * silently (SWR).
 *
 * - `maxAge: PERSIST_MAX_AGE_MS` — 30 days. Finite, because nothing else deleted
 *   anything and the store grew without limit; see persist-cache.ts.
 * - `gcTime: PERSIST_GC_TIME_MS` — bounds MEMORY only; disk retention is independent.
 * - `prefix: persisterStorageKey(bucket)` — org-scopes org pages (DIS-143), or the
 *   fixed `"platform"` bucket for cross-org fleet pages.
 * - `buster: persistCacheVersion()` — MANUAL version; bumped by hand only on an
 *   incompatible response-shape change (NOT the per-deploy SHA). See persist-cache.ts.
 * - `filters.predicate` — DENYLIST: every non-sensitive root persists (key material
 *   never touches disk).
 */
function makeQueryClient(bucket: string) {
  const persistEnabled = typeof window !== "undefined";
  const persister = experimental_createQueryPersister({
    storage: persistEnabled ? makeIdbStorage(persisterStorageKey(bucket)) : undefined,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: persistCacheVersion(),
    prefix: persisterStorageKey(bucket),
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
 * One QueryClient per bucket. A fresh mount => fresh (EMPTY) in-memory cache + a
 * persister whose storage keys are prefixed with THIS bucket => atomic isolation
 * between orgs (and between org pages and fleet pages). The outer QueryProvider
 * remounts this under `key={bucket}` on bucket change, so neither the in-memory
 * cache nor the disk key space of the previous bucket can bleed across.
 */
function BucketScopedQueryClientProvider({
  bucket,
  children,
}: {
  bucket: string;
  children: ReactNode;
}) {
  // Created once per mount; the component is keyed by bucket upstream, so this runs
  // fresh per bucket and the persister prefix can never point at another bucket's keys.
  const [{ client }] = useState(() => makeQueryClient(bucket));
  const pathname = usePathname();

  // There is deliberately NO `persister.restoreQueries(client)` here.
  //
  // It used to run on mount, beside the nav reseed below — and because `pathname` is in
  // that effect's deps, BOTH fired on the very first render, so every mount read this
  // bucket off disk twice and decoded it twice. The reseed is the better of the two: it
  // is COLD-GUARDED (`restoreQueries` calls `setQueryData` unconditionally and will
  // overwrite a fresher in-memory value with an older snapshot), and it re-runs on each
  // navigation, which is what the disabled-query case actually needs. Adding the mount
  // restore back reinstates the duplicate read and the stomp.

  // NAV RESEED. The per-query self-restore only
  // fires for an ENABLED (fetching) query, so a page reached while an org gate is closed
  // — or a sub-page whose memory was GC'd — cold-skeletons even though its disk snapshot
  // exists, and a DOWN backend makes that skeleton stick. Re-seed cold queries from disk
  // on every route change (fleet AND org pages) so the local-first cache always paints
  // its stale content instead of a skeleton. COLD-GUARDED (never stomps fresher memory)
  // and bucket-prefixed, so re-running it on each navigation is safe and cheap.
  useEffect(() => {
    void reseedColdQueriesFromDisk(client, bucket);
  }, [pathname, bucket, client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // ClerkProvider lives in `(authed)/layout.tsx`, an ancestor of every consumer of
  // this provider, so `useOrganization` is safe. It is read only to keep the idle
  // manager wired; the cache bucket is derived from the URL, not the active org.
  useOrganization();
  const pathname = usePathname();

  // Pause all interval polling when the tab is hidden OR the user is idle.
  // Installed once on the global focusManager (singleton) — survives bucket-switch
  // remounts of the inner provider. Stops the continuous DOM churn that feeds
  // PostHog's rrweb recorder and OOMs long-lived tabs. See idle-focus-manager.ts.
  useEffect(() => installIdleFocusManager(), []);

  // Make the cache survive idle days: request persistent storage once at boot so the
  // browser stops evicting the IndexedDB store the local-first cache lives in. The
  // single biggest lever against "instant right after a deploy, then infinite skeleton
  // a few days later". Fire-and-forget, guarded, never blocks render.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Keep the store BOUNDED. Nothing used to delete anything: `maxAge` was `Infinity`
  // and the persister's own garbage collection was never called, so the cache held
  // every response this console had received since it shipped, for every org ever
  // opened. Two passes, both fire-and-forget after paint:
  //
  //  - `reclaimLegacyStore` drops what accumulated under that regime, once ever. The
  //    sweep alone cannot: most of those bytes are recent enough not to be stale.
  //  - `sweepStaleEntries` is the ongoing bound — a cursor walk in constant memory,
  //    across every bucket, deleting what `PERSIST_MAX_AGE_MS` and the cache version
  //    say is no longer worth painting.
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
        console.error("[admin] persisted-cache housekeeping failed", err);
      }
    })();
  }, []);

  // Bucket is derived from the URL path (stable per route, never blinks like Clerk's
  // active org), so it needs no monotonic latch. Switching between a fleet page
  // ("platform") and an org page (the org id) remounts the inner provider under a new
  // key => a fresh QueryClient + a fresh per-bucket disk key space; the per-query
  // persister re-paints each page from IndexedDB on mount, so the remount is invisible.
  const bucket = bucketForPath(pathname);

  return (
    <BucketScopedQueryClientProvider key={bucket} bucket={bucket}>
      {children}
    </BucketScopedQueryClientProvider>
  );
}

export { QueryClient };
