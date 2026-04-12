import { NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";

export const revalidate = 300;

export async function GET() {
  const data = await fetchLeaderboard();

  if (!data) {
    return NextResponse.json(
      { error: "Leaderboard data unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
