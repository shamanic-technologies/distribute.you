import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { lastBrandCookieName } from "@/lib/last-brand";
import { NO_ORG_HREF } from "@/lib/ui-version";

/**
 * `/v2/monitoring/<page>` names no tenant: Monitoring pools every org, but its pages live under
 * a brand (the sidebar is brand-scoped). This is the stable address an alert email or the old
 * admin cold-email pages link to: it lands on the same Monitoring page under the active org's
 * last brand (the org-scoped cookie the edge writes), else on the org page to pick one.
 */
export default async function V2MonitoringEntry({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const { orgId } = await auth();
  if (!orgId) redirect(NO_ORG_HREF);
  const last = (await cookies()).get(lastBrandCookieName(orgId))?.value;
  if (!last) redirect(`/v2/orgs/${encodeURIComponent(orgId)}`);
  const rest = (path ?? []).map(encodeURIComponent).join("/");
  redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(last)}/monitoring${rest ? `/${rest}` : ""}`);
}
