import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { lastBrandCookieName } from "@/lib/last-brand";
import { V2BrandPicker } from "@/components/v2/brand-picker";

/**
 * The org's v2 landing: the last brand opened in it (the same org-scoped cookie the edge
 * reads), else a picker of the org's brands. Never v1.
 *
 * An org not set up yet (its first brand's setup stopped before the campaign launched)
 * never redirects to a brand: every brand page is behind the edge's first-run gate, which
 * would send the person to the old onboarding. The picker resumes the v2 modal instead.
 */
export default async function V2OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { orgId: activeOrgId, sessionClaims } = await auth();
  const setUp = activeOrgId === orgId && sessionClaims?.orgMeta?.onboardingComplete === true;
  const last = (await cookies()).get(lastBrandCookieName(orgId))?.value;
  if (last && setUp) redirect(`/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(last)}`);
  return <V2BrandPicker orgId={orgId} setUp={setUp} />;
}
