"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";

/**
 * / → redirects to /orgs/{activeOrgId}
 * The active org is always set by the dashboard layout guard.
 */
export default function DashboardHome() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();

  useEffect(() => {
    if (isLoaded && organization) {
      router.replace(`/orgs/${organization.id}`);
    }
  }, [isLoaded, organization, router]);

  return <div className="h-screen bg-gray-50" />;
}
