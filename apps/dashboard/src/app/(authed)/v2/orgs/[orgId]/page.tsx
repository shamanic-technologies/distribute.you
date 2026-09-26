import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lastBrandCookieName } from "@/lib/last-brand";
import { V2BrandPicker } from "@/components/v2/brand-picker";

/**
 * The org's v2 landing: the last brand opened in it (the same org-scoped cookie the edge
 * reads), else a picker of the org's brands. Never v1.
 */
export default async function V2OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const last = (await cookies()).get(lastBrandCookieName(orgId))?.value;
  if (last) redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(last)}`);
  return <V2BrandPicker orgId={orgId} />;
}
