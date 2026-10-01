import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  cookieFrom,
  createRateLimiter,
  entryMessage,
  isBotUserAgent,
  websiteHost,
  type OnboardingFlow,
} from "@/lib/onboarding-entry-ping";
import { firstTouchFromCookieHeader } from "@/lib/first-touch";
import { readLandingUrlCookie } from "@/lib/landing-url-cookie";

/**
 * Tells the owner on Telegram that someone reached the first page of onboarding
 * (`lib/onboarding-entry-ping.ts` says why and when the page calls it).
 *
 * Public (under /api/public): the visitor is usually signed out. A per-IP cap keeps
 * a loop from flooding the chat. Nothing the visitor sees depends on it: the page
 * fires and forgets, and a failed send is logged here, loud, for us.
 */
export const dynamic = "force-dynamic";

const allow = createRateLimiter(5, 10 * 60 * 1000);

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.error("[dashboard/onboarding-entry] TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID missing: entry not notified");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const headers = request.headers;
  if (isBotUserAgent(headers.get("user-agent"))) return new NextResponse(null, { status: 204 });

  const ip = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(ip)) return new NextResponse(null, { status: 429 });

  const body = (await request.json().catch(() => null)) as { flow?: unknown; url?: unknown } | null;
  const flow: OnboardingFlow | null = body?.flow === "v1" || body?.flow === "v2" ? body.flow : null;
  if (!flow) return NextResponse.json({ error: "flow must be v1 or v2" }, { status: 400 });

  const cookieHeader = headers.get("cookie");
  const firstTouch = firstTouchFromCookieHeader(cookieHeader);
  const { userId } = await auth();
  const text = entryMessage({
    flow,
    variant: cookieFrom(cookieHeader, "lp_variant"),
    website: websiteHost(typeof body?.url === "string" ? body.url : readLandingUrlCookie(cookieHeader)),
    channel: firstTouch?.channel ?? null,
    utmSource: firstTouch?.utmSource ?? null,
    referrer: firstTouch?.referrer ?? null,
    country: headers.get("cf-ipcountry"),
    signedIn: Boolean(userId),
  });

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  }).catch((err: unknown) => {
    console.error("[dashboard/onboarding-entry] telegram sendMessage threw:", err);
    return null;
  });
  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "network";
    console.error(`[dashboard/onboarding-entry] telegram sendMessage failed: ${res?.status ?? "-"} ${detail}`);
    return NextResponse.json({ error: "telegram_failed" }, { status: 502 });
  }
  return new NextResponse(null, { status: 204 });
}
