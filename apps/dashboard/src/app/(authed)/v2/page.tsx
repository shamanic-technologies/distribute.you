import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** `/v2` names no tenant: the active org's v2 landing, else tenant resolution. */
export default async function V2RootPage() {
  const { orgId } = await auth();
  redirect(orgId ? `/v2/orgs/${encodeURIComponent(orgId)}` : "/orgs");
}
