"use client";

import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { clearBreadcrumbCaches } from "@/components/breadcrumb-nav";

/**
 * Watches for Clerk org changes (from ANY source — the breadcrumb switcher, a
 * Clerk <OrganizationSwitcher>, cross-tab session sync) and:
 * 1. Clears the breadcrumb module-level caches
 * 2. Navigates to the new org's root page
 *
 * The React Query cache is reset SEPARATELY and atomically by remounting
 * `QueryProvider` under `key={org.id}` (see lib/query-provider.tsx) — which is
 * why this component no longer resets the query cache here (the previous direct
 * cache-clear raced by refetching still-mounted observers under the new JWT →
 * DIS-143 cross-org 404).
 *
 * MUST be mounted ABOVE `QueryProvider` in the layout: the keyed remount unmounts
 * the whole authed subtree on switch, so a navigator inside it would never get to
 * fire its `router.push`.
 */
export function OrgCacheInvalidator() {
  const { organization } = useOrganization();
  const router = useRouter();
  const prevOrgId = useRef<string | null>(null);

  useEffect(() => {
    const currentOrgId = organization?.id ?? null;

    // Skip the initial mount — only act on actual changes
    if (prevOrgId.current !== null && currentOrgId !== null && prevOrgId.current !== currentOrgId) {
      clearBreadcrumbCaches();
      router.push(`/orgs/${currentOrgId}`);
    }

    prevOrgId.current = currentOrgId;
  }, [organization?.id, router]);

  return null;
}
