"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { explicitHierarchyHref, hasExplicitHierarchyIntent } from "@/lib/last-brand";

/**
 * /orgs → redirects to /orgs/{activeOrgId}
 * The active org is always set by the dashboard layout guard.
 */
export default function OrgsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoaded } = useOrganization();
  const explicitHierarchy = hasExplicitHierarchyIntent(searchParams);

  useEffect(() => {
    if (isLoaded && organization) {
      router.replace(
        explicitHierarchy
          ? explicitHierarchyHref(`/orgs/${organization.id}`)
          : `/orgs/${organization.id}`,
      );
    }
  }, [explicitHierarchy, isLoaded, organization, router]);

  return <div className="h-screen bg-gray-50" />;
}
