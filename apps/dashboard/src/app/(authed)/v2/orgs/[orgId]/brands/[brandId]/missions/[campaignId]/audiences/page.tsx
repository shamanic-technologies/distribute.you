import { redirect } from "next/navigation";

/** The mission page became the campaign page (owner 2026-10-05): old links and onboarding mails land there. */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; campaignId: string }> }) {
  const { orgId, brandId, campaignId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/campaigns/${encodeURIComponent(campaignId)}?tab=targeting`);
}
