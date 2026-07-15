import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";

export const dynamic = "force-dynamic";

const DASHBOARD_URL = "https://dashboard.distribute.you";

/**
 * Sends a positive, reassuring email to the org user when they flip a brand's
 * Pause / Restart toggle (active <-> paused). Staff (ADMIN_ALLOWED_EMAILS) are
 * BCC'd on the send so the team sees each status switch — the send API exposes
 * only `bccEmails` (no visible `cc`), which mirrors the daily-outcome-digest.
 *
 * Fired fire-and-forget from the BrandStatusControl `setPaused` mutation, so a
 * failure here never blocks the toggle. Still fail-loud (500/502 + console.error)
 * rather than silently swallowing.
 *
 * Identity is derived server-side from the Clerk session (never trusted from the
 * client): `orgId`/`userId` become the `x-external-*` headers, the recipient email
 * comes from Clerk. The client passes only `{ brandId, paused }` (the NEW state).
 * The brand name is resolved server-side from api-service.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  const { brandId, paused } = (await req.json()) as {
    brandId?: string;
    paused?: boolean;
  };
  if (!brandId || typeof paused !== "boolean") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL?.replace(/\/$/, "");
  const adminApiKey = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!apiUrl || !adminApiKey) {
    console.error("[brand-status-email] api url / admin key not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const adminHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": adminApiKey,
    "x-external-org-id": orgId,
    "x-external-user-id": userId,
  };

  // Recipient + greeting name from Clerk (server-side source of truth).
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const recipientEmail = user.primaryEmailAddress?.emailAddress;
  if (!recipientEmail) {
    console.error(`[brand-status-email] user ${userId} has no primary email`);
    return NextResponse.json({ error: "no_recipient" }, { status: 400 });
  }
  const firstName = user.firstName || "there";

  // Resolve the brand name server-side (client only holds the id).
  let brandName = "your brand";
  const brandRes = await fetch(`${apiUrl}/v1/brands/${brandId}`, {
    headers: adminHeaders,
  });
  if (brandRes.ok) {
    const body = (await brandRes.json()) as {
      brand?: { name?: string | null; domain?: string | null };
    };
    brandName = body.brand?.name || body.brand?.domain || brandName;
  } else {
    console.error(
      `[brand-status-email] brand lookup ${brandId} failed ${brandRes.status}`,
    );
  }

  const bccEmails = ADMIN_ALLOWED_EMAILS.filter(
    (email) => email !== recipientEmail,
  );
  const state = paused ? "paused" : "resumed";
  const day = new Date().toISOString().slice(0, 10);

  const sendRes = await fetch(`${apiUrl}/v1/emails/send`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      eventType: paused ? "brand-paused" : "brand-resumed",
      recipientEmail,
      ...(bccEmails.length > 0 ? { bccEmails } : {}),
      brandId,
      // Dedup accidental rapid double-fires of the SAME transition on the same
      // day; a genuine re-toggle to the other state has a different key.
      productId: `brand-status:${brandId}:${state}:${day}`,
      metadata: { firstName, brandName },
    }),
  });

  if (!sendRes.ok) {
    const errBody = await sendRes.text();
    console.error(
      `[brand-status-email] send failed ${sendRes.status}: ${errBody}`,
    );
    return NextResponse.json(
      { error: "send_error", status: sendRes.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
