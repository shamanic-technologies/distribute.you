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

export function QueryProvider({ children }: { children: ReactNode }) {
  // ClerkProvider lives in `(authed)/layout.tsx`, an ancestor of every consumer
  // of this provider (dashboard + onboarding), so `useOrganization` is safe.
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // 24h, == the persister `maxAge`. gcTime MUST be >= maxAge or
            // in-memory GC evicts a query before its persisted copy can be
            // restored (TanStack rule). This bump alone also keeps any
            // within-session return warm for the whole day.
            gcTime: PERSIST_MAX_AGE_MS,
            placeholderData: keepPreviousData,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      })
  );

  // Persist the cache to localStorage so leaving a page and returning — even
  // after gcTime eviction OR a full reload / new tab — restores the last-known
  // content INSTANTLY, then revalidates silently in the background. This is the
  // 4th anti-flash layer (CLAUDE.md → "Coordinated reveal"); the first three
  // only protect a warm in-memory cache. One persister per org id.
  const persistOptions = useMemo(() => {
    const persister = createSyncStoragePersister({
      // SSR has no localStorage → undefined storage makes the persister a no-op.
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: persisterStorageKey(orgId),
      // On QuotaExceededError (localStorage's ~5MB cap, e.g. a multi-MB leads
      // list) drop the oldest cached query and retry until it fits. The page
      // the user is on is most-recently-used → persisted last → survives; only
      // stale large entries are evicted. Never throws, degrades at any size.
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

export { QueryClient };
