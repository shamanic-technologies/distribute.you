import { NextResponse } from "next/server";

/**
 * The expected price of ONE website visit and ONE booked meeting, for the signed-out
 * "what you want" step of `/get-started`.
 *
 * features-service computes both (`GET /public/stats/outcome-prices`, proxied by the
 * gateway at `/v1/public/outcome-prices`): per leg, the best workflow's MATURE figure
 * when one exists, else its best early figure, and a meeting multiplies the two legs
 * (reply cost divided by the reply-to-meeting rate, plus the meeting leg's own cost).
 * Nothing is computed here: the body is handed back verbatim, and the page only reads
 * it. Same transport reason as `/api/public/catalogue`: the visitor has no session.
 *
 * FAIL LOUD: an unreadable upstream answers 502, and the page then states no price
 * rather than one of ours.
 */
const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const UPSTREAM_TIMEOUT_MS = 12_000;

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/v1/public/outcome-prices`, {
      headers: { accept: "application/json" },
      // The producer rebuilds every 15 minutes off the request path.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[outcome-prices] upstream read failed: ${res.status} ${body.slice(0, 200)}`);
      return NextResponse.json({ error: "Outcome prices are unavailable" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[outcome-prices] upstream read errored:", err);
    return NextResponse.json({ error: "Outcome prices are unavailable" }, { status: 502 });
  }
}
