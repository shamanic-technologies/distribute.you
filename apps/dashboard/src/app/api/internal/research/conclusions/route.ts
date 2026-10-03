import { NextResponse } from "next/server";
import { verifyServiceKey } from "@/lib/service-key";
import { researchConclusions } from "@/lib/research/conclusions";
import type { ResearchFile } from "@/lib/research/research";
import billedFile from "@/lib/research/research.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/research/conclusions — SERVICE KEY ONLY (`x-api-key`, see lib/service-key.ts).
 *
 * The Research studies whose verdict is a CONCLUSION, with their quotable facts, read from the
 * same billed snapshot the staff Research page renders (`research.json`), so a figure quoted by
 * a backend service (social-service's takes) is the page's figure exactly. `signal` and `noise`
 * studies, Learning points and the vendor-cost (`actual`) basis are never served here.
 *
 * Public in proxy.ts (`/api/internal(.*)`): there is no Clerk session on a service call, the key
 * check below is the boundary. A missing DASHBOARD_APP_API_KEY answers 500, never an open route.
 */
export async function GET(req: Request) {
  try {
    if (!verifyServiceKey(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = researchConclusions(billedFile as unknown as ResearchFile);
    return NextResponse.json(body, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    console.error("[dashboard-research-conclusions] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
