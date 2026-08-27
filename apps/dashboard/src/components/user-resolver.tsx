"use client";

import { useEffect, useRef } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { resolveUser } from "@/lib/api";
import { useOrgQueryGate } from "@/lib/use-auth-query";

/**
 * Sends the Clerk user's email, firstName, lastName, and imageUrl
 * to POST /v1/users/resolve once per dashboard visit so the backend
 * user record always has up-to-date contact info.
 */
export function UserResolver() {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  // Same org-consistency gate every org-owned read uses. Without it this fires on
  // Clerk's ACTIVE org while the URL is still on the previous one — mid-switch,
  // that is a cross-org call the proxy correctly refuses (409 org_desync), and the
  // `.catch` below swallowed it, so it retried nothing and reported nothing. It
  // was the loudest repeated 409 in the console during a switch.
  const orgConsistent = useOrgQueryGate();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!userLoaded || !orgLoaded || hasFired.current) return;
    if (!user || !organization || !orgConsistent) return;

    hasFired.current = true;

    resolveUser({
      externalOrgId: organization.id,
      externalUserId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      imageUrl: user.imageUrl ?? undefined,
    }).catch(() => {
      // Best-effort — don't block the UI if resolve fails
    });
  }, [userLoaded, orgLoaded, user, organization, orgConsistent]);

  return null;
}
