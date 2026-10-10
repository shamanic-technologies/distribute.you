import { redirect } from "next/navigation";

/** Revenue Steps (the ticked steps and legs) is retired (owner 2026-10-10): old links land on the offer. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; offerId: string }> }) {
  const { orgId, brandId, offerId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/offers/${encodeURIComponent(offerId)}`);
}
