import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export async function GET() {
  // Require login to access the dashboard, but don't forward auth to the API.
  // The leaderboard is global data — identical to what performance.distribute.you shows.
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/performance/leaderboard`, {
    headers: { Accept: "application/json" },
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
