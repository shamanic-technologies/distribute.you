import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { registryFetch } from "@/lib/api-registry";

export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  segmentData: { params: Promise<{ service: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service } = await segmentData.params;

  try {
    const res = await registryFetch(`/openapi/${encodeURIComponent(service)}`);
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch (err) {
    console.error(`[platform/services/${service}] failed:`, err);
    return NextResponse.json(
      { error: `Failed to fetch spec for service: ${service}` },
      { status: 502 }
    );
  }
}
