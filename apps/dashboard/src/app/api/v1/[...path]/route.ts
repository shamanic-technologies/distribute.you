import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.DISTRIBUTE_API_KEY;

async function proxyRequest(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  const { path } = await segmentData.params;
  const url = new URL(`/v1/${path.join("/")}`, API_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.text()
      : undefined;

  const res = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type":
        res.headers.get("Content-Type") || "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, segmentData);
}

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, segmentData);
}

export async function PUT(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, segmentData);
}

export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, segmentData);
}
