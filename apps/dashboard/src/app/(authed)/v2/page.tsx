import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NO_ORG_HREF } from "@/lib/ui-version";

/** `/v2` names no tenant: the active org's v2 landing, else Clerk's org picker. */
export default async function V2RootPage() {
  const { orgId } = await auth();
  redirect(orgId ? `/v2/orgs/${encodeURIComponent(orgId)}` : NO_ORG_HREF);
}
