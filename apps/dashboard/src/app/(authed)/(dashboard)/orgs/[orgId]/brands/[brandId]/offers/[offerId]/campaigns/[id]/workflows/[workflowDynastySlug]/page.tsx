/**
 * The workflow DETAIL page is gone: one workflow is read in a PANEL over the ranking
 * rather than on a page of its own, so the list a customer is comparing stays on
 * screen. This route survives only so an existing link still lands somewhere true —
 * it redirects to the list with that workflow open.
 */
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{
    orgId: string;
    brandId: string;
    offerId: string;
    id: string;
    workflowDynastySlug: string;
  }>;
}) {
  const { orgId, brandId, offerId, id, workflowDynastySlug } = await params;
  redirect(
    `/orgs/${orgId}/brands/${brandId}/offers/${offerId}/campaigns/${id}/workflows?workflow=${encodeURIComponent(
      workflowDynastySlug,
    )}`,
  );
}
