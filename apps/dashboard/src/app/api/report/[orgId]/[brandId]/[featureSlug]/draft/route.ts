import { NextResponse } from "next/server";
import { adminPost } from "@/lib/report-api";

// Public-report draft generation proxy. The public page has no Clerk
// session, so this route holds the admin key server-side and proxies
// through api-service to journalists-quotes-service. The brand-scoped
// `/orgs/quote-requests/:id/draft` endpoint accepts `{ brandId }` and
// auto-resolves generation inputs (spokesperson, expertiseTopics, etc.)
// from brand-service `extract-fields`.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const HITL_SLUG = "pr-expert-quote-opportunities";

interface DraftRequestBody {
  quoteRequestId?: string;
  brandId?: string;
}

interface DraftUpstreamResponse {
  pitch: string;
  charCount: number;
  attempts?: number;
  tokensInput?: number;
  tokensOutput?: number;
}

export async function POST(req: Request, ctx: RouteContext) {
  const { orgId, brandId: brandIdParam, featureSlug } = await ctx.params;

  if (featureSlug !== HITL_SLUG) {
    return NextResponse.json(
      { error: `featureSlug ${featureSlug} is not enabled for HITL draft generation` },
      { status: 404 },
    );
  }

  let body: DraftRequestBody;
  try {
    body = (await req.json()) as DraftRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const quoteRequestId = body.quoteRequestId;
  const brandId = body.brandId ?? brandIdParam;

  if (!quoteRequestId) {
    return NextResponse.json({ error: "quoteRequestId is required" }, { status: 400 });
  }
  if (brandId !== brandIdParam) {
    return NextResponse.json(
      { error: "brandId in body must match URL brandId" },
      { status: 400 },
    );
  }

  try {
    const result = await adminPost<DraftUpstreamResponse>(
      "generateQuoteDraft",
      `/orgs/quote-requests/${quoteRequestId}/draft`,
      orgId,
      { brandId },
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
