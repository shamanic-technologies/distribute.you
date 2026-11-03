import { redirect } from "next/navigation";

/** Legacy URL (/referral): the referral program ended (owner 2026-11-03), old links land on Billing. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string }> }) {
  const { orgId, brandId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/billing`);
}
