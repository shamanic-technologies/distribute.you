import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export async function GET() {
  const res = await fetch(`${API_URL}/performance/leaderboard`, {
    headers: { Accept: "application/json" },
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
