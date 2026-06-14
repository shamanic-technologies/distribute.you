"use client";

import { useEffect } from "react";
import { useOrganizationList, useOrganization } from "@clerk/nextjs";

/**
 * Auto-activates the user's first organization if none is active.
 * This ensures the JWT includes org_id for API calls.
 */
export function OrgActivator() {
  const { organization } = useOrganization();
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  useEffect(() => {
    // If already loaded and no active org, set the first one
    if (isLoaded && !organization && userMemberships.data && userMemberships.data.length > 0) {
      const firstOrg = userMemberships.data[0].organization;
      console.log("Auto-activating organization:", firstOrg.name);
      setActive({ organization: firstOrg.id });
    }
  }, [isLoaded, organization, userMemberships.data, setActive]);

  // This component doesn't render anything
  return null;
}
