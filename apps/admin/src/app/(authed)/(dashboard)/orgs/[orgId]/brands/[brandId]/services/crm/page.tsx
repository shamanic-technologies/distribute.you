import { redirect } from "next/navigation";

// CRM base route → the Leads page (the concatenated uploaded-contacts pool).
export default async function CrmIndexPage({
  params,
}: {
  params: Promise<{ orgId: string; brandId: string }>;
}) {
  const { orgId, brandId } = await params;
  redirect(`/orgs/${orgId}/brands/${brandId}/services/crm/leads`);
}
