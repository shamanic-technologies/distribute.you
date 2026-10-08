import { redirect } from "next/navigation";

// Integrations > Conversations moved to Records > Unibox (owner 2026-10-08).
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string }> }) {
  const { orgId, brandId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/unibox`);
}
