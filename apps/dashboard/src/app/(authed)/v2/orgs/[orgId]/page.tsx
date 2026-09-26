import { redirect } from "next/navigation";

/**
 * v2 has no org-level page yet. The v1 org URL resolves the last-visited brand at the
 * edge and, for a v2 user, lands on that brand's v2 Dashboard.
 */
export default async function V2OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/orgs/${encodeURIComponent(orgId)}`);
}
