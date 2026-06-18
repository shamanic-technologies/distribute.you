import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The dashboard root is not a real page — it only routes. First-run users are
// sent to /onboarding at the edge (proxy.ts); everyone else lands on their org.
// The old build-in-public "public metrics" page was removed (it leaked global
// signup/card/visitor counts and was never meant to be a landing surface).
export default async function DashboardHome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  redirect("/orgs");
}
