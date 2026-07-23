import { NextResponse } from "next/server";
import { fetchQuoteRequestDetail } from "@/lib/report-api";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";

// On-demand detail for a single quote request, fetched when a report row is
// CLICKED (keeps the heavy question body out of the page-load path). Read-only:
// it only GETs one request the report already exposes, scoped to the URL org
// (journalists-quotes filters by org, so a foreign request id resolves to
// nothing). No client-side admin key — the key lives here, server-side.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      orgId: string;
      brandId: string;
      featureSlug: string;
      requestId: string;
    }>;
  },
) {
  const { orgId, featureSlug, requestId } = await params;

  // Only the PR-Expert quote report has this surface.
  if (!isExpertQuoteFeature(featureSlug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const detail = await fetchQuoteRequestDetail(orgId, requestId);
    return NextResponse.json(detail);
  } catch (err) {
    console.error(
      `[dashboard-report] quote-request detail ${requestId} failed:`,
      err,
    );
    return NextResponse.json(
      { error: "Failed to load question" },
      { status: 502 },
    );
  }
}
