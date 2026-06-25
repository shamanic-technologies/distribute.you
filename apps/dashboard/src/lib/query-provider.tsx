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
  persistCacheVersion,
  persisterStorageKey,
  shouldPersistQuery,
  type PersistableQuery,
} from "@/lib/persist-cache";
import { installIdleFocusManager } from "@/lib/idle-focus-manager";

/**
 * IndexedDB-backed storage adapter for the per-query persister. The persister only
 * needs the AsyncStorage `getItem / setItem / removeItem` triple; idb-keyval gives
 * us exactly that against IndexedDB — which has NO ~5MB per-origin Web-Storage cap,
 * so big lists (leads/emails) persist without evicting the small overview queries,
 * and writes happen off the main thread (no serialize jank).
 */
const idbStorage = {
  getItem: (key: string) => idbGet(key),
  setItem: (key: string, value: string) => idbSet(key, value),
  removeItem: (key: string) => idbDel(key),
};

/**
 * One QueryClient per org mount. The PER-QUERY persister (not the whole-client one)
 * is wired as a default query option: it wraps each `queryFn` and, on mount, returns
 * the query's last-known value straight from IndexedDB BEFORE hitting the network —
 * so opening a page paints its content instantly, then revalidates silently (SWR).
 *
 * - `maxAge: Infinity` — disk entries never expire → instant across sessions/days.
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
    storage: persistEnabled ? idbStorage : undefined,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: persistCacheVersion(),
    prefix: persisterStorageKey(orgId),
    filters: {
      predicate: (query: Query) =>
        shouldPersistQuery(query as unknown as PersistableQuery),
    },
  });

  return new QueryClient({
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
  const [queryClient] = useState(() => makeQueryClient(orgId));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // ClerkProvider lives in `(authed)/layout.tsx`, an ancestor of every consumer
  // of this provider (dashboard + onboarding), so `useOrganization` is safe.
  const { organization } = useOrganization();
  const pathname = usePathname();

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

  // Atomically reset the ENTIRE in-memory React Query cache on org switch by
  // remounting under a new `key` (TanStack canonical multi-tenant pattern). New
  // mount => new QueryClient (empty in-memory) + a persister whose keys are prefixed
  // with the new org id => a fresh per-org disk key space. Stronger than
  // `queryClient.clear()`, which races by refetching still-mounted observers under
  // the new org's JWT (the DIS-143 cross-org 404). Paired with the proxy's
  // server-side fail-closed org guard (`checkProxyOrg`) for defense in depth.
  //
  // NOTE: this remounts the whole authed subtree on switch, so org-change navigation
  // lives in `OrgCacheInvalidator`, mounted ABOVE this provider (it must survive the
  // remount to fire its `router.push`).
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
  const orgKey = stableOrgId ?? "no-org";

  return (
    <OrgScopedQueryClientProvider key={orgKey} orgId={stableOrgId}>
      {children}
    </OrgScopedQueryClientProvider>
  );
}

export { QueryClient };
