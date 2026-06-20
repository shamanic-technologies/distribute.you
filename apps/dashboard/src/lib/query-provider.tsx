"use client";

import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useOrganization } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PERSIST_MAX_AGE_MS,
  cacheBuildId,
  persisterStorageKey,
  shouldPersistQuery,
} from "@/lib/persist-cache";
import { installIdleFocusManager } from "@/lib/idle-focus-manager";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // == the persister `maxAge` (30 min). gcTime MUST be >= maxAge or in-memory
        // GC evicts a query before its persisted copy can restore (TanStack rule).
        // 30 min (not 24h) BOUNDS MEMORY: gcTime governs how long an inactive query
        // — including big leads/emails lists — stays in the JS heap. 24h kept them
        // all day → the #1273 memory overflow. 30 min covers "leave + return" while
        // letting heavy inactive lists leave the heap.
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
      // ALSO no-op while orgId is null (Clerk session not yet resolved): otherwise
      // EVERY org reads/writes the SAME shared `cache:anon` bucket during its load
      // window, so org A's persisted cache restores under org B — a cross-org bleed
      // (DIS-143) and an OWASP "shared cache key without tenant prefix" violation.
      // Persist ONLY under a resolved, org-scoped key; the brief null window stays
      // unpersisted (it refetches anyway).
      storage:
        typeof window !== "undefined" && orgId ? window.localStorage : undefined,
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
  // Monotonic org latch for the remount `key`. Clerk's `useOrganization()` blinks
  // `organization: null` transiently during background JWT rotation (~1/min) and on
  // tab focus/reconnect (CLAUDE.md "Readiness gates MUST be monotonic — never blank a
  // mounted subtree on a transient auth-loading flip"). A raw `orgId ?? "no-org"` key
  // flips realId→"no-org"→realId on every blink, remounting OrgScopedQueryClientProvider
  // = a brand-new EMPTY QueryClient. Persisted queries rehydrate from disk silently, but
  // non-persisted big lists (brandLeads, emails, …) cold-reload → their page re-shows a
  // full skeleton on every blink. So advance the key ONLY when a resolved org id is
  // present; a null blink keeps the last id. A real switch to a DIFFERENT org still
  // changes the id → remount + fresh per-org persister, preserving DIS-143 isolation.
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
