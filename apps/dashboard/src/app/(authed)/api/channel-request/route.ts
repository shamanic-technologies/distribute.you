import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";
import { CHANNEL_REQUEST_MAX_CHARS, sendChannelRequestEmail } from "@/lib/channel-request-email";
import { v2OfferHref } from "@/lib/v2/routes";

/**
 * POST /api/channel-request  { channelSlug, channelName, message, orgId, brandId, offerId }
 *
 * "Contact us" on a channel we do not run yet. Staff get one email right away with the
 * customer's text (what they want, the budget they have in mind). The org is the
 * session's; the page's org must match it, so nobody files a request in another org's name.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string).trim() : "");
  const channelSlug = str("channelSlug");
  const channelName = str("channelName");
  const message = str("message");
  const brandId = str("brandId");
  const offerId = str("offerId");
  // The page's org (URL) must be the session's: a tab left on another org after a
  // switch would otherwise mail staff about the wrong customer.
  if (str("orgId") !== orgId) {
    return NextResponse.json({ error: "Your session switched organization. Reload the page." }, { status: 409 });
  }
  if (!channelSlug || !channelName || !brandId || !offerId) {
    return NextResponse.json({ error: "Missing channel, brand or offer." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Tell us what you have in mind." }, { status: 400 });
  if (message.length > CHANNEL_REQUEST_MAX_CHARS) {
    return NextResponse.json({ error: `Keep it under ${CHANNEL_REQUEST_MAX_CHARS} characters.` }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL?.replace(/\/$/, "");
  const adminKey = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!apiUrl || !adminKey) {
    console.error("[channel-request] NEXT_PUBLIC_DISTRIBUTE_API_URL and ADMIN_DISTRIBUTE_API_KEY are required");
    return NextResponse.json({ error: "Could not send your request. Try again." }, { status: 500 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const requesterEmail = user.primaryEmailAddress?.emailAddress;
  if (!requesterEmail) {
    console.error(`[channel-request] user=${userId} has no primary email`);
    return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  }

  try {
    await sendChannelRequestEmail({
      request: {
        channelSlug,
        channelName,
        message,
        requesterEmail,
        orgId,
        brandId,
        offerId,
        pageUrl: `https://dashboard.distribute.you${v2OfferHref(orgId, brandId, offerId, "sales-path")}`,
      },
      staffEmail: ADMIN_ALLOWED_EMAILS[0],
      userId,
      apiUrl,
      adminKey,
      requestId: randomUUID(),
    });
  } catch (err) {
    console.error(`[channel-request] org=${orgId} channel=${channelSlug} failed`, err);
    return NextResponse.json({ error: "Could not send your request. Try again." }, { status: 502 });
  }
  console.log(`[channel-request] org=${orgId} user=${userId} channel=${channelSlug} sent to staff`);
  return NextResponse.json({ ok: true });
}
