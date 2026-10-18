import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { readLiveCatalog, readLiveResearch, readLiveTemplateTexts, type ResearchBasisParam } from "@/lib/research/live-file";
import { CATALOG_KINDS, PIPE_ORDER, type ResearchCatalog, type ResearchFile } from "@/lib/research/research";

/**
 * GET /api/research/{basis}/{part} — STAFF ONLY. Every byte of Research, read LIVE from
 * features-service (`lib/research/live-file.ts`): the file (`file`), its catalogue (`catalog`) and
 * the template texts (`texts`), on the billed basis (`user`) or the vendor-cost one (`actual`,
 * which reveals our margin). No snapshot backs it: a failed read answers 502 and the page shows
 * its error state.
 *
 * Research is staff-only, so its data is served here and nowhere else (no client module reads a
 * Research source; guarded by tests/research-actual-basis.test.ts). The dashboard has no edge
 * allowlist, so the `isAdminEmail` check below is the sole boundary.
 */
const BASES = new Set<ResearchBasisParam>(["user", "actual"]);
const PARTS = new Set(["file", "catalog", "texts"]);

/** How many rows each pipe's catalogue pages list: the hub's chips state the pages' own lengths. */
function catalogCountsOf(catalog: ResearchCatalog): ResearchFile["catalogCounts"] {
  return Object.fromEntries(
    PIPE_ORDER.map((pipe) => [pipe, Object.fromEntries(CATALOG_KINDS.map((kind) => [kind, catalog[pipe]?.[kind]?.length ?? 0]))]),
  ) as ResearchFile["catalogCounts"];
}

export async function GET(_req: Request, { params }: { params: Promise<{ basis: string; part: string }> }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { basis, part } = await params;
  if (!BASES.has(basis as ResearchBasisParam) || !PARTS.has(part)) {
    return NextResponse.json({ error: `Unknown research part ${basis}/${part}` }, { status: 404 });
  }
  const b = basis as ResearchBasisParam;
  const email = sessionClaims!.email as string;
  try {
    let body: unknown;
    if (part === "file") {
      const [file, catalog] = await Promise.all([readLiveResearch(b, email), readLiveCatalog(b, email)]);
      body = { ...file, catalogCounts: catalogCountsOf(catalog) };
    } else if (part === "catalog") body = await readLiveCatalog(b, email);
    else body = await readLiveTemplateTexts(email);
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error(`[research] live ${basis}/${part} failed:`, err);
    return NextResponse.json({ error: "Research live read failed" }, { status: 502 });
  }
}
