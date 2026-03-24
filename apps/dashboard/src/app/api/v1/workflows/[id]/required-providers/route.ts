import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_DOMAINS } from "@/lib/api-registry";

export const maxDuration = 15;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export async function GET(
  _req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
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

  const { id } = await segmentData.params;

  try {
    const res = await fetch(`${API_URL}/v1/workflows/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return new NextResponse(body, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const workflow = await res.json();
    const providers: string[] = workflow.requiredProviders ?? [];

    const result = providers.map((provider) => ({
      provider,
      domain: PROVIDER_DOMAINS[provider.toLowerCase()] ?? null,
    }));

    return NextResponse.json({
      workflowId: id,
      workflowName: workflow.name,
      providers: result,
    });
  } catch (err) {
    console.error(`[workflows/${id}/required-providers] failed:`, err);
    return NextResponse.json(
      { error: "Failed to fetch workflow providers" },
      { status: 502 }
    );
  }
}
