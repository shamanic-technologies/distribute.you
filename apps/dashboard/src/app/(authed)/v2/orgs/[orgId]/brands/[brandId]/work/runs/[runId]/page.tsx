import { redirect } from "next/navigation";

/** Legacy staff URL: a run's page moved to `/runs/:runId` (2026-10-18). */
export default async function Page({ params }: { params: Promise<{ orgId: string; brandId: string; runId: string }> }) {
  const { orgId, brandId, runId } = await params;
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/runs/${encodeURIComponent(runId)}`);
}
