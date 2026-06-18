"use client";

import { useEffect, useRef } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { resolveUser } from "@/lib/api";

/**
 * Sends the Clerk user's email, firstName, lastName, and imageUrl
 * to POST /v1/users/resolve once per dashboard visit so the backend
 * user record always has up-to-date contact info.
 */
export function UserResolver() {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!userLoaded || !orgLoaded || hasFired.current) return;
    if (!user || !organization) return;

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
  }, [userLoaded, orgLoaded, user, organization]);

  return null;
}
