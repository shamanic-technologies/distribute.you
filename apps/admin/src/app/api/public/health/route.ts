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
 * It widens NO gate. `proxy.ts` already lists `/api/public(.*)` in `isPublicRoute`,
 * which is what both the staff-email 403 and the sign-in redirect branch on — the
 * prefix was already exempt and only this file was missing. The staff allowlist,
 * the Cloudflare Access application and the Caddy Cloudflare-IP guard are all
 * unchanged, and what leaks here is the word "ok".
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", app: "admin" });
}
