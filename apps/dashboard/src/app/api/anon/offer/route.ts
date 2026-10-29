import { NextRequest, NextResponse } from "next/server";
import { ANON_SESSION_COOKIE } from "@/lib/anon-session-cookie";
import { readAnonSession } from "@/lib/anon-session-token";
import { getOrgFreeCreditOffer } from "@/lib/billing-service";

/**
 * GET /api/anon/offer: the free-credit offer of the org this browser's walk built
 * (`{ freeCreditOffer }`), read by the signed-out wall before any account exists.
 * An org created since 2026-10-29 is `prepaid_at_cost` (owner 2026-10-29: no match,
 * no referral reward), so the wall promises it no free money; an older one keeps
 * what it was sold. Read-only: the anonymous proxy reaches no billing route, this
 * one answers a single field from the server.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!secret) {
    console.error("[anon-offer] ADMIN_DISTRIBUTE_API_KEY not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const { session, refusal } = readAnonSession(req.cookies.get(ANON_SESSION_COOKIE)?.value, secret);
  if (!session) {
    return NextResponse.json({ error: "No anonymous session", reason: refusal }, { status: 401 });
  }
  try {
    const freeCreditOffer = await getOrgFreeCreditOffer(session.orgId);
    return NextResponse.json({ freeCreditOffer });
  } catch (err) {
    console.error(`[anon-offer] offer read failed for org ${session.orgId}:`, err);
    return NextResponse.json({ error: "Could not read the offer" }, { status: 502 });
  }
}
