"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useOrganizationList, useOrganization, useUser } from "@clerk/nextjs";
import { isAdminEmail } from "@/lib/admin-allowlist";

function orgIdFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/\/orgs\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Keeps Clerk's active org aligned with the org-scoped dashboard URL.
 * This ensures the JWT includes the right org_id before /api/v1 reads fire.
 */
export function OrgActivator() {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const activatingOrgRef = useRef<string | null>(null);

  const urlOrgId = orgIdFromPath(pathname);
  const currentOrgId = organization?.id ?? null;
  const isStaff = isAdminEmail(user?.primaryEmailAddress?.emailAddress);

  useEffect(() => {
    if (!isLoaded || !userLoaded) return;

    const memberships = userMemberships.data;
    const firstMembershipOrgId = memberships?.[0]?.organization.id ?? null;
    const targetOrgId = urlOrgId ?? (!currentOrgId ? firstMembershipOrgId : null);
    if (!targetOrgId || currentOrgId === targetOrgId) return;
    if (activatingOrgRef.current === targetOrgId) return;

    const isMember = memberships?.some((m) => m.organization.id === targetOrgId) ?? false;
    if (!isMember && !isStaff) return;

    activatingOrgRef.current = targetOrgId;
    void (async () => {
      if (!isMember) {
        const res = await fetch(`/api/admin/orgs/${targetOrgId}/join`, {
          method: "POST",
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`Failed to join org ${targetOrgId}: ${res.status} ${detail}`);
        }
      }
      await setActive({ organization: targetOrgId });
    })()
      .catch((err) => {
        console.error("[dashboard] org activation failed:", err);
      })
      .finally(() => {
        if (activatingOrgRef.current === targetOrgId) {
          activatingOrgRef.current = null;
        }
      });
  }, [
    currentOrgId,
    isLoaded,
    isStaff,
    setActive,
    urlOrgId,
    userLoaded,
    userMemberships.data,
  ]);

  // This component doesn't render anything
  return null;
}
