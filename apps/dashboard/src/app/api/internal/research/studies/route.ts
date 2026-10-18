import { NextResponse } from "next/server";
import { verifyServiceKey } from "@/lib/service-key";
import { researchStudies } from "@/lib/research/conclusions";
import { readMergedResearch } from "@/lib/research/live-file";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/research/studies — SERVICE KEY ONLY (`x-api-key`, see lib/service-key.ts).
 *
 * Every MEASURED Research study with its facts, from the same billed file the staff Research
 * page renders. Each carries `quotable` (true only for a conclusion): social-service's comment
 * writer reads signal/noise studies for context but states figures only from a conclusion. The
 * vendor-cost (`actual`) basis is never served here.
 */
export async function GET(req: Request) {
  try {
    if (!verifyServiceKey(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // The same LIVE file the staff page renders (features-service, snapshot studies marked), billed basis.
    const body = researchStudies(await readMergedResearch("user", ADMIN_ALLOWED_EMAILS[0]));
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[dashboard-research-studies] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
