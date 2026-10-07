import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatOwnerPing, isStaffEmail, OWNER_PING_EVENTS } from "@/lib/owner-ping";

export const dynamic = "force-dynamic";

/**
 * POST: one short Telegram line to the owner for a signup step (`lib/owner-ping.ts`).
 *
 * Public: an anonymous visitor walks `/get-started` before any account exists. WHO
 * is never taken from the body: a signed-in caller is named from Clerk, anyone else
 * is "Visitor". The body only says what happened, from a closed list, so a stranger
 * calling this can at worst send the owner a bounded number of plain step lines.
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
  const body = parsed.data;

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (overLimit(ip)) return NextResponse.json({ error: "Too many" }, { status: 429 });

  let who: string | null = null;
  const { userId } = await auth();
  if (userId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? null;
    // The owner never gets a line about himself.
    if (isStaffEmail(email)) return new NextResponse(null, { status: 204 });
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    who = [name, email].filter(Boolean).join(" · ") || null;
  }

  let text: string;
  try {
    text = formatOwnerPing({ ...body, who, country: req.headers.get("cf-ipcountry") });
  } catch (e) {
    console.error("[dashboard/owner-ping] unformattable ping:", body, e);
    return NextResponse.json({ error: "Invalid ping" }, { status: 400 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    console.error(`[dashboard/owner-ping] Telegram refused ${res.status}: ${await res.text()}`);
    return NextResponse.json({ error: "Telegram refused" }, { status: 502 });
  }
  return new NextResponse(null, { status: 204 });
}
