import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import billedFile from "@/lib/research/research.json";
import billedCatalog from "@/lib/research/research-catalog.json";
import actualFile from "@/lib/research/actual/research.json";
import actualCatalog from "@/lib/research/actual/research-catalog.json";
import texts from "@/lib/research/research-templates.json";

/**
 * GET /api/research/{basis}/{part} — STAFF ONLY. Every byte of Research: the snapshot (`file`),
 * its catalogue (`catalog`) and the template texts (`texts`), on the billed basis (`user`) or the
 * vendor-cost one (`actual`, which reveals our margin).
 *
 * Research is staff-only, so its data is served here and nowhere else: the JSON files are imported
 * by this server route ONLY, never by a client module, so they are in no browser bundle (guarded by
 * tests/research-actual-basis.test.ts). The dashboard has no edge allowlist, so the `isAdminEmail`
 * check below is the sole boundary.
 */
const PARTS: Record<string, Record<string, unknown>> = {
  user: { file: billedFile, catalog: billedCatalog, texts },
  actual: { file: actualFile, catalog: actualCatalog, texts },
};

export async function GET(_req: Request, { params }: { params: Promise<{ basis: string; part: string }> }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { basis, part } = await params;
  const body = Object.hasOwn(PARTS, basis) && Object.hasOwn(PARTS[basis], part) ? PARTS[basis][part] : undefined;
  if (body === undefined) return NextResponse.json({ error: `Unknown research part ${basis}/${part}` }, { status: 404 });
  return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
}
