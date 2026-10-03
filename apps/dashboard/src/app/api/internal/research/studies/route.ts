import { NextResponse } from "next/server";
import { verifyServiceKey } from "@/lib/service-key";
import { researchStudies } from "@/lib/research/conclusions";
import type { ResearchFile } from "@/lib/research/research";
import billedFile from "@/lib/research/research.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/research/studies — SERVICE KEY ONLY (`x-api-key`, see lib/service-key.ts).
 *
 * Every MEASURED Research study with its facts, from the same billed snapshot the staff Research
 * page renders. Each carries `quotable` (true only for a conclusion): social-service's comment
 * writer reads signal/noise studies for context but states figures only from a conclusion. The
 * vendor-cost (`actual`) basis is never served here.
 */
export async function GET(req: Request) {
  try {
    if (!verifyServiceKey(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = researchStudies(billedFile as unknown as ResearchFile);
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[dashboard-research-studies] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
