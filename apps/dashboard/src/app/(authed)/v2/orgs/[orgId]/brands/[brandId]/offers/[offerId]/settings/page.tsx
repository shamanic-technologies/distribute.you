import { redirect } from "next/navigation";

/** New offers land on `/settings` (v1 NewOfferModal); in v2 an offer IS its settings. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; offerId: string }> }) {
  const { orgId, brandId, offerId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/offers/${encodeURIComponent(offerId)}`);
}
