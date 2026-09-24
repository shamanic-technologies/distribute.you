"use client";

import { useParams } from "next/navigation";
import { CrmSidebar } from "@/components/crm/crm-sidebar";
import { useIsBetaUser } from "@/lib/use-beta-user";

/**
 * Mounts the CRM's second sidebar (Raw / Merged) beside the page. BETA: a
 * non-beta reader gets no sidebar, and each page body gates itself too.
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const isBeta = useIsBetaUser();
  const params = useParams<{ orgId: string; brandId: string }>();
  if (!isBeta) return <>{children}</>;
  const basePath = `/orgs/${params.orgId}/brands/${params.brandId}/crm`;
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <CrmSidebar basePath={basePath} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
