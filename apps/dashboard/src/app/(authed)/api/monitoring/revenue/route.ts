import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { readRevenueBoard } from "@/lib/monitoring/revenue-read";
import type { RevenueBoard } from "@/lib/monitoring/revenue-series";

/**
 * GET /api/monitoring/revenue — STAFF ONLY. Monitoring > Revenue's board: cash collected, revenue
 * consumed, retention, the run-rate split and revenue per audience, every series built on the server
 * (`lib/monitoring/revenue-series.ts`) so the browser only draws (moved from the admin Revenue tab,
 * 2026-11-21). The billing cash totals and the PostHog first-seen months are read here because they
 * need server keys; features-service through the gateway's staff gate.
 *
 * One board for every staff reader, held a minute: a page answers at once and a burst of reloads
 * makes one round of reads. `?fresh=1` (sent after a stated amount is written, which moves both
 * run-rate halves) reads live and replaces it. The dashboard has no edge allowlist, so the
 * `isAdminEmail` check below is the sole boundary.
 */
const FRESH_MS = 60_000;
let memory: { at: number; board: Promise<RevenueBoard> } | null = null;

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const email = sessionClaims!.email as string;
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (fresh || !memory || Date.now() - memory.at >= FRESH_MS) {
    const board = readRevenueBoard(email);
    memory = { at: Date.now(), board };
    board.catch(() => {
      memory = null;
    });
  }
  try {
    return NextResponse.json(await memory.board, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[monitoring/revenue] board failed:", err);
    return NextResponse.json({ error: "Revenue read failed" }, { status: 502 });
  }
}
