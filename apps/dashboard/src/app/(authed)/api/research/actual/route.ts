import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import file from "@/lib/research/actual/research.json";
import catalog from "@/lib/research/actual/research-catalog.json";

/**
 * GET /api/research/actual — STAFF ONLY. The Research snapshot written on the ACTUAL cost basis
 * (what the vendors charged us before our markup) by the same pipeline as the billed one
 * (apps/landing/scripts/blog-data, COST_BASIS=actual).
 *
 * It reveals our margin, so it is served here and nowhere else: the two JSON files are imported
 * by this server route ONLY, never by a client module, so they are not in any browser bundle
 * (guarded by tests/research-actual-basis.test.ts). The dashboard has no edge allowlist, so the
 * `isAdminEmail` check below is the sole boundary.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ file, catalog }, { headers: { "cache-control": "private, no-store" } });
}
