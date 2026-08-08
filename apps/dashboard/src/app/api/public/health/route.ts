import { NextResponse } from "next/server";

/**
 * What the Hetzner box asks before it accepts a deploy.
 *
 * `deploy.sh` health-checks each container from inside it and returns the clone to
 * its previous commit when the check fails, so this route is what stands between a
 * broken build and production. It deliberately touches NOTHING but this process:
 * a check that called the API gateway or a database would roll back a perfectly
 * good deploy every time a downstream compute happened to be waking up.
 *
 * It lives under /api/public because `proxy.ts` already treats that prefix as
 * unauthenticated — a health check that needed a Clerk session could never pass.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", app: "dashboard" });
}
