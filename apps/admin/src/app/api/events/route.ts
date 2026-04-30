import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export async function GET(req: NextRequest) {
  if (!API_URL || !API_KEY) {
    return NextResponse.json(
      { error: "[admin] API not configured" },
      { status: 500 }
    );
  }

  const url = new URL("/v1/events", API_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
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
