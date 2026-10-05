import { redirect } from "next/navigation";

/** The Missions list was deleted (owner 2026-10-05): old links land on Campaigns. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string }> }) {
  const { orgId, brandId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/campaigns`);
}
