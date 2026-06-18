import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

function redirect(req: NextRequest, target: string): NextResponse {
  const url = new URL(target, req.url);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return redirect(req, "/sign-in");
  }
  if (!orgId) {
    return redirect(req, "/onboarding");
  }
  if (!API_KEY) {
    console.error("[dashboard] ADMIN_DISTRIBUTE_API_KEY not set in oauth callback");
    return redirect(
      req,
      `/orgs/${orgId}/services/crm?error=${encodeURIComponent("API key not configured")}`,
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    console.error("[dashboard] Google OAuth returned error:", oauthError);
    return redirect(
      req,
      `/orgs/${orgId}/services/crm?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    console.error("[dashboard] OAuth callback missing code or state");
    return redirect(
      req,
      `/orgs/${orgId}/services/crm?error=${encodeURIComponent("Missing code or state")}`,
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "x-external-org-id": orgId,
    "x-external-user-id": userId,
  };
  const user = await currentUser();
  if (user) {
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (email) headers["x-email"] = email;
    if (user.firstName) headers["x-first-name"] = user.firstName;
    if (user.lastName) headers["x-last-name"] = user.lastName;
  }

  const target = new URL("/v1/orgs/google/auth/callback", API_URL);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);

  const res = await fetch(target.toString(), { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text();
    console.error("[dashboard] /v1/orgs/google/auth/callback failed", res.status, body);
    const contentType = res.headers.get("Content-Type") ?? "";
    let detail = body || `HTTP ${res.status}`;
    if (contentType.includes("application/json") && body) {
      const parsed = JSON.parse(body) as { error?: string; detail?: string };
      if (typeof parsed.error === "string") detail = parsed.error;
      else if (typeof parsed.detail === "string") detail = parsed.detail;
    }
    return redirect(
      req,
      `/orgs/${orgId}/services/crm?error=${encodeURIComponent(detail)}`,
    );
  }

  return redirect(req, `/orgs/${orgId}/services/crm?connected=1`);
}
