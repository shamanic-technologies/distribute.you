import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { readLiveCatalog, readLivePerformance, readLiveResearch, readLiveTemplateTexts, type ResearchBasisParam } from "@/lib/research/live-file";
import { createLiveMemory } from "@/lib/research/live-cache";
import { CATALOG_KINDS, catalogPipes, pipeCatalog, type ResearchCatalog, type ResearchFile } from "@/lib/research/research";

/**
 * GET /api/research/{basis}/{part} — STAFF ONLY. Every byte of Research, read LIVE from
 * features-service (`lib/research/live-file.ts`): the file (`file`), its catalogue (`catalog`) and
 * the template texts (`texts`), the Performance tab (`performance`), on the billed basis (`user`) or the vendor-cost one (`actual`,
 * which reveals our margin). Each part is held in memory for a minute and re-read in the background
 * up to five minutes (`lib/research/live-cache.ts`, owner 2026-10-23 « instantanées »), so a page
 * answers in milliseconds; past five minutes, or after a failed re-read, the request reads live
 * and a failure answers 502 and the page shows its error state.
 *
 * Research is staff-only, so its data is served here and nowhere else (no client module reads a
 * Research source; guarded by tests/research-actual-basis.test.ts). The dashboard has no edge
 * allowlist, so the `isAdminEmail` check below is the sole boundary.
 */
const BASES = new Set<ResearchBasisParam>(["user", "actual"]);
const PARTS = new Set(["file", "catalog", "texts", "performance"]);

/** One memory for every staff reader: Research is fleet-wide, the same bytes for each of them. */
const memory = createLiveMemory();

/** How many rows each pipe's catalogue pages list (every pipe the catalogue serves): the hub's chips state the pages' own lengths. */
function catalogCountsOf(catalog: ResearchCatalog): ResearchFile["catalogCounts"] {
  return Object.fromEntries(
    catalogPipes(catalog).map((pipe) => [pipe, Object.fromEntries(CATALOG_KINDS.map((kind) => [kind, pipeCatalog(catalog, pipe)[kind].length]))]),
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
    const catalog = () => memory.read(`${b}/catalog`, () => readLiveCatalog(b, email));
    let body: unknown;
    if (part === "file") {
      body = await memory.read(`${b}/file`, async () => {
        const [file, cat] = await Promise.all([readLiveResearch(b, email), catalog()]);
        return { ...file, catalogCounts: catalogCountsOf(cat) };
      });
    } else if (part === "catalog") body = await catalog();
    else if (part === "performance") body = await memory.read(`${b}/performance`, () => readLivePerformance(b, email));
    // the texts are the same on both bases: one entry
    else body = await memory.read("texts", () => readLiveTemplateTexts(email));
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error(`[research] live ${basis}/${part} failed:`, err);
    return NextResponse.json({ error: "Research live read failed" }, { status: 502 });
  }
}
