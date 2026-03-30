import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_DOMAINS } from "@/lib/api-registry";

export const maxDuration = 15;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export async function GET(
  _req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }
  if (!clerkOrgId) {
    return NextResponse.json(
      { error: "No active organization. Please complete onboarding." },
      { status: 403 }
    );
  }

  const { id } = await segmentData.params;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "x-external-org-id": clerkOrgId,
      "x-external-user-id": clerkUserId,
    };

    // currentUser() calls Clerk's API — don't let it break the proxy if Clerk is down
    try {
      const user = await currentUser();
      if (user) {
        const email = user.emailAddresses?.[0]?.emailAddress;
        if (email) headers["x-email"] = email;
        if (user.firstName) headers["x-first-name"] = user.firstName;
        if (user.lastName) headers["x-last-name"] = user.lastName;
      }
    } catch (err) {
      console.warn("[workflows/required-providers] currentUser() failed:", err);
    }

    const res = await fetch(`${API_URL}/v1/workflows/${encodeURIComponent(id)}`, {
      method: "GET",
      headers,
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
      workflowSlug: workflow.slug,
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
