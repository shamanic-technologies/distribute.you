import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminPost } from "@/lib/report-api";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";

// Public-report pitch submission proxy. Hits journalists-quotes-service
// `/orgs/opportunities/:id/reply` via api-service with admin key + org
// context. `:id` is the Gold cluster id (quote_opportunities.id) round-
// tripped from /ranked. Brand identity flows via the `x-brand-id` header
// (journalists-quotes-service v0.8.1 contract); body carries only
// pitchContent + optional subject. After a successful submit the public
// opportunities cache for this brand is invalidated so the next page open
// hides the just-pitched opportunity.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

interface ReplyRequestBody {
  opportunityId?: string;
  pitchContent?: string;
  subject?: string;
}

interface ReplyUpstreamResponse {
  status: "submitted" | "already_submitted" | "rate_limited" | "error";
  pitchId?: string;
  deliveryMethod?: "featured_api" | "email_reply";
  outboundMessageId?: string | null;
  featuredQuestionId?: number | null;
  retryAfter?: number;
  error?: string;
}

export async function POST(req: Request, ctx: RouteContext) {
  const { orgId, brandId, featureSlug } = await ctx.params;

  if (!isExpertQuoteFeature(featureSlug)) {
    return NextResponse.json(
      { error: `featureSlug ${featureSlug} is not enabled for HITL reply` },
      { status: 404 },
    );
  }

  let body: ReplyRequestBody;
  try {
    body = (await req.json()) as ReplyRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const opportunityId = body.opportunityId;
  const pitchContent = body.pitchContent;

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }
  if (!pitchContent || pitchContent.trim().length === 0) {
    return NextResponse.json({ error: "pitchContent is required" }, { status: 400 });
  }

  try {
    // journalists-quotes-service v0.8.1 reads brand identity from the
    // `x-brand-id` header (api-service forwards it via buildInternalHeaders).
    // Body carries only pitchContent (+ optional subject).
    const upstreamBody: Record<string, unknown> = { pitchContent };
    if (body.subject) {
      upstreamBody.subject = body.subject;
    }
    const result = await adminPost<ReplyUpstreamResponse>(
      "submitQuotePitchReply",
      `/orgs/opportunities/${opportunityId}/reply`,
      orgId,
      upstreamBody,
      { "x-brand-id": brandId },
    );

    if (result.status === "submitted" || result.status === "already_submitted") {
      revalidateTag(`opportunities:brand:${brandId}`, "default");
      revalidateTag(`report:brand:${brandId}`, "default");
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
