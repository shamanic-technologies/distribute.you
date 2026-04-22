"use client";

import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearBreadcrumbCaches } from "@/components/breadcrumb-nav";

/**
 * Watches for Clerk org changes and:
 * 1. Clears the React Query cache so no stale data from the previous org is shown
 * 2. Clears the breadcrumb module-level caches
 * 3. Navigates to the new org's root page
 */
export function OrgCacheInvalidator() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const prevOrgId = useRef<string | null>(null);

  useEffect(() => {
    const currentOrgId = organization?.id ?? null;

    // Skip the initial mount — only act on actual changes
    if (prevOrgId.current !== null && currentOrgId !== null && prevOrgId.current !== currentOrgId) {
      queryClient.clear();
      clearBreadcrumbCaches();
      router.push(`/orgs/${currentOrgId}`);
    }

    prevOrgId.current = currentOrgId;
  }, [organization?.id, queryClient, router]);

  return null;
}
