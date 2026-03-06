import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export async function GET() {
  // Require login + org context. Forward identity headers to the API.
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId || !API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/performance/leaderboard`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": API_KEY,
      "x-external-org-id": clerkOrgId,
      "x-external-user-id": clerkUserId,
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
