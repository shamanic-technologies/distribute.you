import { redirect } from "next/navigation";
import { monitoringUrlForColdEmail } from "@/lib/cold-email-moved";

/**
 * The cold-email audit pages moved to dashboard v2 Monitoring > Emails (owner 2026-10-19: one
 * home for our monitoring charts). Old bookmarks and links land on the same page there.
 */
export default async function ColdEmailMoved({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  redirect(monitoringUrlForColdEmail(path?.[0]));
}
