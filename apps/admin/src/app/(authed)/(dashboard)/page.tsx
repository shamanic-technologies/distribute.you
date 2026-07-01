import { redirect } from "next/navigation";

// The cross-org "build in public" metrics funnel now lives at `/metrics`
// (reached via the header logo). The bare root just forwards signed-in staff to
// their orgs — the proxy already handles the onboarding / last-brand hops.
export default function DashboardRoot() {
  redirect("/orgs");
}
