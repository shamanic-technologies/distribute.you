import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { readLiveCatalog, readLivePerformance, readLiveResearch, readLiveScripts, readLiveTemplateTexts, ResearchReadError, type ResearchBasisParam } from "@/lib/research/live-file";
import { parseMaturityView } from "@/lib/v2/maturity-view-cookie";
import { createLiveMemory } from "@/lib/research/live-cache";

/**
 * GET /api/research/{basis}/{part} — STAFF ONLY. Every byte of Research, read LIVE from
 * features-service by Engine and script (`lib/research/live-file.ts`, RESEARCH-BY-ENGINE-1113): the file
 * (`file`), its catalogue (`catalog`), the template texts (`texts`), the Performance tab (`performance`)
 * and one measure's live script ranking (`live-scripts?measure=<id>`, net pricing), on the billed basis
 * (`user`) or the vendor-cost one (`actual`, which reveals our margin). Each part is held in memory for a
 * minute and re-read in the background up to five minutes (`lib/research/live-cache.ts`, owner 2026-10-23
 * « instantanées »), so a page answers in milliseconds; past five minutes, or after a failed re-read, the
 * request reads live and a failure answers 502 (a measure features-service does not know answers its 404)
 * and the page shows its error state.
 *
 * Every part but the texts and the live scripts takes `?view=mature|flash` (the staff Mature / Flash
 * switch, absent = mature, anything else 400 `view_unrecognised`), forwarded to features-service; the
 * memory is keyed on it, so one view's body is never served under the other.
 *
 * Research is staff-only, so its data is served here and nowhere else (no client module reads a
 * Research source; guarded by tests/research-actual-basis.test.ts). The dashboard has no edge
 * allowlist, so the `isAdminEmail` check below is the sole boundary.
 */
const BASES = new Set<ResearchBasisParam>(["user", "actual"]);
const PARTS = new Set(["file", "catalog", "texts", "performance", "live-scripts"]);

/** One memory for every staff reader: Research is fleet-wide, the same bytes for each of them. */
const memory = createLiveMemory();

export async function GET(req: Request, { params }: { params: Promise<{ basis: string; part: string }> }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { basis, part } = await params;
  if (!BASES.has(basis as ResearchBasisParam) || !PARTS.has(part)) {
    return NextResponse.json({ error: `Unknown research part ${basis}/${part}` }, { status: 404 });
  }
  const b = basis as ResearchBasisParam;
  const search = new URL(req.url).searchParams;
  const v = parseMaturityView(search.get("view"));
  if (!v) return NextResponse.json({ error: "view_unrecognised" }, { status: 400 });
  const email = sessionClaims!.email as string;
  try {
    let body: unknown;
    if (part === "file") body = await memory.read(`${b}/${v}/file`, () => readLiveResearch(b, v, email));
    else if (part === "catalog") body = await memory.read(`${b}/${v}/catalog`, () => readLiveCatalog(b, v, email));
    else if (part === "performance") body = await memory.read(`${b}/${v}/performance`, () => readLivePerformance(b, v, email));
    else if (part === "live-scripts") {
      const measure = search.get("measure");
      if (!measure) return NextResponse.json({ error: "measure_required" }, { status: 400 });
      // The fleet ranking is one body whatever the basis or view: one entry per measure.
      body = await memory.read(`live-scripts/${measure}`, () => readLiveScripts(measure, email));
    }
    // the texts are the same on both bases and both views: one entry
    else body = await memory.read("texts", () => readLiveTemplateTexts(email));
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error(`[research] live ${basis}/${part} failed:`, err);
    if (err instanceof ResearchReadError && err.status === 404) return NextResponse.json({ error: "Research measure not found" }, { status: 404 });
    return NextResponse.json({ error: "Research live read failed" }, { status: 502 });
  }
}
