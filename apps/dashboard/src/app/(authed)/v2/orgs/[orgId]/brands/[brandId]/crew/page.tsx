import { redirect } from "next/navigation";

/** Legacy staff URL: the page was deleted (2026-10-18), old bookmarks land on Campaigns. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string }> }) {
  const { orgId, brandId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/campaigns`);
}
