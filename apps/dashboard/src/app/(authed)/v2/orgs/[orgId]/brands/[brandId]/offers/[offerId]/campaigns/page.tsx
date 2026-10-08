import { redirect } from "next/navigation";

/** The offer's Campaigns page folded into its Outbound (sales path) page (owner 2026-10-08). Old links land there. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; offerId: string }> }) {
  const { orgId, brandId, offerId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/offers/${encodeURIComponent(offerId)}/sales-path`);
}
