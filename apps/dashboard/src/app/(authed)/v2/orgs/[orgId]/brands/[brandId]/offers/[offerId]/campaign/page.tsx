import { redirect } from "next/navigation";

/** The old single "Campaign" page (one sales path) is gone: campaigns live on the Sales path page. Old links land there. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; offerId: string }> }) {
  const { orgId, brandId, offerId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/offers/${encodeURIComponent(offerId)}/sales-path`);
}
