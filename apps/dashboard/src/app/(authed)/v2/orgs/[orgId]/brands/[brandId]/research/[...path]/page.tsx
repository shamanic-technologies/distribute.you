import { auth } from "@clerk/nextjs/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { V2Research } from "@/components/v2/research-page";

// The staff check reads the session claim on the server (no network), so the page paints at once
// instead of waiting for Clerk to load in the browser. One client view serves the hub and every
// question; see V2Research.
export default async function Page() {
  const { sessionClaims } = await auth();
  return <V2Research staff={isAdminEmail(sessionClaims?.email)} />;
}
