import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * The old onboarding wizard is gone: `/get-started` is the one signup flow (owner
 * 2026-10-04). Old links still arrive here (sent emails, bookmarks, Stripe returns).
 *
 * Signed out: the visitor starts `/get-started`, query kept. Signed in: `/get-started`
 * refuses a signed-in walk (it would bill the active org), so the person goes to their
 * org page, which resumes an unfinished brand in the v2 setup modal and ends on
 * "Choose your plan".
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (userId) redirect(orgId ? `/v2/orgs/${encodeURIComponent(orgId)}` : "/v2");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.append(key, value);
    else value?.forEach((v) => query.append(key, v));
  }
  const qs = query.toString();
  redirect(qs ? `/get-started?${qs}` : "/get-started");
}
