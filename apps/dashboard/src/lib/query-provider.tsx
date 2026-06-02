"use client";

import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** One QueryClient per mount — a fresh instance is an EMPTY cache. */
function OrgScopedQueryClientProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { organization } = useOrganization();

  // Atomically reset the ENTIRE React Query cache on org switch by remounting the
  // provider under a new `key` (TanStack canonical multi-tenant pattern). A new
  // mount => new QueryClient => zero cross-org cache bleed by construction. This
  // is stronger than `queryClient.clear()`, which races by refetching still-mounted
  // observers under the new org's JWT (the DIS-143 cross-org 404). Paired with the
  // proxy's server-side fail-closed org guard (`checkProxyOrg`) for defense in depth.
  //
  // NOTE: this remounts the whole authed subtree on switch, so org-change navigation
  // lives in `OrgCacheInvalidator`, mounted ABOVE this provider (it must survive the
  // remount to fire its `router.push`).
  const orgKey = organization?.id ?? "no-org";

  return (
    <OrgScopedQueryClientProvider key={orgKey}>
      {children}
    </OrgScopedQueryClientProvider>
  );
}

export { QueryClient };
