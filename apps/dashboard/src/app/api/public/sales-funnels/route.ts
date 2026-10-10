import { NextResponse } from "next/server";
import { SIGNUP_PROACTIVE_CHANNEL, SIGNUP_REACTIVE_CHANNEL } from "@/lib/v2/signup-campaign";

/**
 * The funnels the END of signup proposes (owner sketch 2026-10-10, "Your campaign"): the
 * runnable sales funnels features-service publishes (`GET /v1/public/catalogue/sales-funnels`,
 * public, `runnable` forced by the producer, ROI first), read twice: the ones on cold email
 * (the proactive pick) and the ones on AI meeting booking (the reactive pick). Both pages are
 * handed back VERBATIM; `lib/v2/signup-campaign.ts` picks.
 *
 * Server-side for the same reason as `/api/public/catalogue`: the visitor has no session, and the
 * gateway host stays out of the client bundle. FAIL LOUD: a page we could not read is a 502, never
 * an empty list (the step would read as "nothing to run").
 */
const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const UPSTREAM_TIMEOUT_MS = 12_000;

async function page(channel: string): Promise<unknown> {
  const res = await fetch(`${API_URL}/v1/public/catalogue/sales-funnels?containsChannels=${encodeURIComponent(channel)}&limit=25`, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sales funnels on ${channel}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function GET() {
  try {
    const [proactive, reactive] = await Promise.all([page(SIGNUP_PROACTIVE_CHANNEL), page(SIGNUP_REACTIVE_CHANNEL)]);
    return NextResponse.json({ proactive, reactive });
  } catch (err) {
    console.error("[public-sales-funnels] read failed:", err);
    return NextResponse.json({ error: "Campaigns are unavailable" }, { status: 502 });
  }
}
