import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.API_SERVICE_API_KEY;

async function proxyRequest(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!API_KEY) {
      console.error("[api-proxy] API_SERVICE_API_KEY env var is not set");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }
    if (!clerkOrgId) {
      return NextResponse.json(
        { error: "No active organization. Please complete onboarding." },
        { status: 403 }
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
      "x-org-id": clerkOrgId,
      "x-user-id": clerkUserId,
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
