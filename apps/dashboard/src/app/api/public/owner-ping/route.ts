import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clerkUserIdFromDistinctId, formatOwnerPing, isStaffEmail, OWNER_PING_EVENTS } from "@/lib/owner-ping";
import { escapeHtml } from "@/lib/visit-recap";
import { fetchCompanyLines } from "@/lib/visit-recap-job";

export const dynamic = "force-dynamic";

/**
 * POST: one short Telegram line to the owner for a signup step (`lib/owner-ping.ts`).
 *
 * Public: an anonymous visitor walks `/get-started` before any account exists. WHO
 * is never taken from the body: a signed-in caller is named from Clerk, anyone else
 * is "Visitor". The body only says what happened, from a closed list, so a stranger
 * calling this can at worst send the owner a bounded number of plain step lines.
 *
 * One exception: a signed-out browser's PostHog distinct id, when it is a Clerk user
 * id (that browser signed in before), is looked up in Clerk and named as "signed
 * out". Clerk ids are unguessable and the line only reaches the owner.
 */

const BodySchema = z.object({
  event: z.enum(OWNER_PING_EVENTS),
  domain: z
    .string()
    .max(100)
    .regex(/^[a-z0-9.-]+$/i)
    .nullish(),
  step: z
    .object({
      label: z.string().min(1).max(60),
      index: z.number().int().min(1).max(50),
      total: z.number().int().min(1).max(50),
    })
    .nullish(),
  amountUsd: z.number().positive().max(1_000_000).nullish(),
  posthogDistinctId: z.string().max(200).nullish(),
});

// A stranger replaying this cannot flood the owner: 40 lines per IP per 10 minutes
// (a full walk is ~18). In memory: a restart resets it, which is fine for a bound.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const sent = new Map<string, number[]>();

function overLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (sent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  sent.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.error("[dashboard/owner-ping] TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ping" }, { status: 400 });
  const { posthogDistinctId, ...body } = parsed.data;

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (overLimit(ip)) return NextResponse.json({ error: "Too many" }, { status: 429 });

  let who: string | null = null;
  let signedOut = false;
  const { userId } = await auth();
  const knownUserId = userId ? null : clerkUserIdFromDistinctId(posthogDistinctId);
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  if (userId) {
    user = await currentUser();
  } else if (knownUserId) {
    try {
      user = await (await clerkClient()).users.getUser(knownUserId);
      signedOut = true;
    } catch (e) {
      console.error(`[dashboard/owner-ping] no Clerk user for distinct id ${knownUserId}:`, e);
    }
  }
  if (user) {
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    // The owner never gets a line about himself.
    if (isStaffEmail(email)) return new NextResponse(null, { status: 204 });
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    who = [name, email].filter(Boolean).join(" · ") || null;
  }

  let text: string;
  try {
    text = formatOwnerPing({ ...body, who, signedOut, country: req.headers.get("cf-ipcountry") });
  } catch (e) {
    console.error("[dashboard/owner-ping] unformattable ping:", body, e);
    return NextResponse.json({ error: "Invalid ping" }, { status: 400 });
  }

  // "Entered their site" is the first ping carrying the domain: it also says who the company is
  // (HQ, industry, size, revenue, role), like the visit recap (owner 2026-10-27). Later steps stay one line.
  const lines = [escapeHtml(text)];
  if (body.event === "started" && body.domain) {
    const apolloUrl = process.env.APOLLO_SERVICE_URL?.trim();
    const apolloKey = process.env.APOLLO_SERVICE_API_KEY?.trim();
    const brandUrl = process.env.BRAND_SERVICE_URL?.trim();
    const brandKey = process.env.BRAND_SERVICE_API_KEY?.trim();
    if (!apolloUrl || !apolloKey || !brandUrl || !brandKey) {
      console.error("[dashboard/owner-ping] APOLLO_SERVICE_URL, APOLLO_SERVICE_API_KEY, BRAND_SERVICE_URL or BRAND_SERVICE_API_KEY is not set");
      lines.push(`Company lookup failed for ${escapeHtml(body.domain)}`);
    } else {
      lines.push(
        ...(await fetchCompanyLines(
          { url: apolloUrl, apiKey: apolloKey },
          { url: brandUrl, apiKey: brandKey },
          {
            domain: body.domain,
            email: user?.primaryEmailAddress?.emailAddress ?? null,
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
          },
          "dashboard/owner-ping",
        )),
      );
    }
  }

  // One more try on a transport failure: a DNS blip on the box (`EAI_AGAIN api.telegram.org`, 2026-10-25)
  // lost a signup's "started" line with a 500.
  const send = () =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
    });
  let res: Response;
  try {
    res = await send();
  } catch (e) {
    console.error("[dashboard/owner-ping] Telegram unreachable, trying once more:", e);
    await new Promise((r) => setTimeout(r, 1_000));
    res = await send();
  }
  if (!res.ok) {
    console.error(`[dashboard/owner-ping] Telegram refused ${res.status}: ${await res.text()}`);
    return NextResponse.json({ error: "Telegram refused" }, { status: 502 });
  }
  return new NextResponse(null, { status: 204 });
}
