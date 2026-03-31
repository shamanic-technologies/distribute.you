import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

/**
 * @deprecated This route proxied the old /v1/stats/leaderboard endpoint.
 * Dashboard now uses /features/ranked via the catch-all proxy.
 * Kept temporarily for backwards compatibility.
 */
export async function GET() {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId || !API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proxy to the public ranked endpoint (featureDynastySlug + objective now required)
  const res = await fetch(`${API_URL}/v1/public/features/ranked?featureDynastySlug=sales-cold-email-outreach&objective=emailsReplied&limit=100`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": API_KEY,
    },
    cache: "no-store",
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
