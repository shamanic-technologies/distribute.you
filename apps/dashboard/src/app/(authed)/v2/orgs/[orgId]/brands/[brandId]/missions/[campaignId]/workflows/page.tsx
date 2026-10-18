import { redirect } from "next/navigation";

/** Legacy URL (/missions): old links and onboarding emails land on the campaign page. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; campaignId: string }> }) {
  const { orgId, brandId, campaignId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/campaigns/${encodeURIComponent(campaignId)}?tab=workflows`);
}
