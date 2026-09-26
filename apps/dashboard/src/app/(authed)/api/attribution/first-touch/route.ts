import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { recordAcquisition } from "@/lib/client-service";
import { firstTouchForHandover } from "@/lib/first-touch";

/**
 * POST /api/attribution/first-touch — hand the signed-in org its FIRST TOUCH.
 *
 * Called once at signup (PostHogAuthTracker) and again at the end of onboarding
 * as a backstop. The touch is read from the `distribute_first_touch` cookie the
 * landing and the dashboard write on `.distribute.you` — never from the request
 * body, so a client cannot state its own channel — and an absent cookie is sent
 * as `unknown`, an answer, rather than as nothing.
 *
 * client-service keeps the first hand-over and ignores the rest, so an org that
 * started anonymous and was claimed keeps the touch recorded before the claim.
 * The org and user come from the session, never from the client.
 */
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const touch = firstTouchForHandover(req.headers.get("cookie"));
  const result = await recordAcquisition({ externalOrgId: orgId, externalUserId: userId }, touch);
  if (!result) {
    return NextResponse.json({ error: "Could not record the acquisition source" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, recorded: result.recorded, channel: touch.channel });
}
