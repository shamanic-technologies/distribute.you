import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

async function proxyRequest(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId, orgId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization. Please complete onboarding." },
        { status: 403 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await segmentData.params;
    const url = new URL(`/v1/${path.join("/")}`, API_URL);
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Forward optional identity headers from client
    const brandId = req.headers.get("x-brand-id");
    if (brandId) headers["x-brand-id"] = brandId;

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await req.text()
        : undefined;

    const res = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const contentType = res.headers.get("Content-Type") || "application/json";

    // Stream SSE responses through instead of buffering
    if (contentType.includes("text/event-stream") && res.body) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    const { path } = await segmentData.params;
    console.error(`[api-proxy] ${req.method} /v1/${path.join("/")} failed:`, err);
    return NextResponse.json(
      { error: "Proxy error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
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

export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, segmentData);
}
