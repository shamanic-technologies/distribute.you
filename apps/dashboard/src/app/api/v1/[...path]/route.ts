import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.DISTRIBUTE_API_KEY;
const CLIENT_SERVICE_URL =
  process.env.CLIENT_SERVICE_URL || "https://client.mcpfactory.org";
const CLIENT_SERVICE_API_KEY = process.env.CLIENT_SERVICE_API_KEY;

/**
 * In-memory cache for Clerk → internal identity resolution.
 * Key: `${clerkOrgId}:${clerkUserId}`, Value: { orgId, userId, expiresAt }
 */
const identityCache = new Map<
  string,
  { orgId: string; userId: string; expiresAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveIdentity(
  clerkOrgId: string,
  clerkUserId: string
): Promise<{ orgId: string; userId: string }> {
  const cacheKey = `${clerkOrgId}:${clerkUserId}`;
  const cached = identityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { orgId: cached.orgId, userId: cached.userId };
  }

  if (!CLIENT_SERVICE_API_KEY) {
    throw new Error("CLIENT_SERVICE_API_KEY not configured");
  }

  const res = await fetch(`${CLIENT_SERVICE_URL}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLIENT_SERVICE_API_KEY,
    },
    body: JSON.stringify({
      appId: "mcpfactory",
      externalOrgId: clerkOrgId,
      externalUserId: clerkUserId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Identity resolution failed: ${res.status} — ${body}`);
  }

  const data = await res.json();
  identityCache.set(cacheKey, {
    orgId: data.orgId,
    userId: data.userId,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { orgId: data.orgId, userId: data.userId };
}

async function proxyRequest(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> }
) {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }
  if (!clerkOrgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  // Resolve Clerk IDs → internal UUIDs via client-service
  let orgId: string;
  let userId: string;
  try {
    const identity = await resolveIdentity(clerkOrgId, clerkUserId);
    orgId = identity.orgId;
    userId = identity.userId;
  } catch (err) {
    console.error("[proxy] Identity resolution error:", err);
    return NextResponse.json(
      { error: "Identity resolution failed" },
      { status: 502 }
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
    "x-org-id": orgId,
    "x-user-id": userId,
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
