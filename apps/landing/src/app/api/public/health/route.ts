import { NextResponse } from "next/server";

/**
 * What the Hetzner box asks before it accepts a deploy.
 *
 * `deploy.sh` health-checks each container from inside it and returns the clone to
 * its previous commit when the check fails, so this route is what stands between a
 * broken build and production. It deliberately touches NOTHING but this process —
 * in particular not the blog database, whose absence the blog itself already
 * degrades around, and which has no business failing a deploy.
 *
 * The path mirrors the dashboard's so the box asks both apps the same question.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", app: "landing" });
}
