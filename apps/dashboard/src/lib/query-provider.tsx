"use client";

import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useOrganization } from "@clerk/nextjs";
import { useMemo, useState, type ReactNode } from "react";
import {
  PERSIST_MAX_AGE_MS,
  cacheBuildId,
  persisterStorageKey,
  shouldPersistQuery,
} from "@/lib/persist-cache";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // 24h, == the persister `maxAge`. gcTime MUST be >= maxAge or in-memory
        // GC evicts a query before its persisted copy can be restored (TanStack
        // rule). This also keeps any within-session return warm for the whole day.
        gcTime: PERSIST_MAX_AGE_MS,
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
 * One QueryClient + one persister per mount, both scoped to a single org id.
 * A fresh mount => fresh (EMPTY) in-memory cache AND a persister bound to that
 * org's localStorage key => atomic per-org isolation (DIS-143). The outer
 * QueryProvider remounts this under `key={orgId}` on switch, so neither the
 * in-memory cache nor the disk cache of the previous org can bleed across.
 */
function OrgScopedQueryClientProvider({
  orgId,
  children,
}: {
  orgId: string | null;
  children: ReactNode;
}) {
  const [queryClient] = useState(makeQueryClient);

  // Persist the cache to localStorage so leaving a page and returning — even
  // after gcTime eviction OR a full reload / new tab — restores the last-known
  // content INSTANTLY, then revalidates silently in the background. This is the
  // 4th anti-flash layer (CLAUDE.md → "Coordinated reveal"); the first three only
  // protect a warm in-memory cache. One persister per org id. The component is
  // keyed by orgId upstream, so this memo computes once per org and the disk key
  // can never point at another org's cache.
  const persistOptions = useMemo(() => {
    const persister = createSyncStoragePersister({
      // SSR has no localStorage → undefined storage makes the persister a no-op.
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: persisterStorageKey(orgId),
      // On QuotaExceededError (localStorage's ~5MB cap, e.g. a multi-MB leads
      // list) drop the oldest cached query and retry until it fits. The page the
      // user is on is most-recently-used → persisted last → survives; only stale
      // large entries are evicted. Never throws, degrades at any size.
      retry: removeOldestQuery,
    });
    return {
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      // A new deploy busts the persisted cache (the data shape may have changed).
      buster: cacheBuildId(),
      // Only successful, non-sensitive queries touch disk.
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    };
  }, [orgId]);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // ClerkProvider lives in `(authed)/layout.tsx`, an ancestor of every consumer
  // of this provider (dashboard + onboarding), so `useOrganization` is safe.
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;

  // Atomically reset the ENTIRE React Query cache — in-memory AND the active
  // persister — on org switch by remounting under a new `key` (TanStack canonical
  // multi-tenant pattern). New mount => new QueryClient (empty in-memory) + a
  // persister bound to the new org's localStorage key + a fresh re-hydrate from
  // THAT org's disk cache. Stronger than `queryClient.clear()`, which races by
  // refetching still-mounted observers under the new org's JWT (the DIS-143
  // cross-org 404) and would NOT reset the persister target. Paired with the
  // proxy's server-side fail-closed org guard (`checkProxyOrg`) for defense in depth.
  //
  // NOTE: this remounts the whole authed subtree on switch, so org-change navigation
  // lives in `OrgCacheInvalidator`, mounted ABOVE this provider (it must survive the
  // remount to fire its `router.push`).
  const orgKey = orgId ?? "no-org";

  return (
    <OrgScopedQueryClientProvider key={orgKey} orgId={orgId}>
      {children}
    </OrgScopedQueryClientProvider>
  );
}

export { QueryClient };
