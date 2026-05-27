import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminPost } from "@/lib/report-api";

// Public-report pitch submission proxy. Hits journalists-quotes-service
// `/orgs/opportunities/:id/reply` via api-service with admin key + org
// context. Body is brand-scoped (no campaignId). After a successful submit
// the public opportunities cache for this brand is invalidated so the next
// page open hides the just-pitched opportunity.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const HITL_SLUG = "pr-expert-quote-opportunities";

interface ReplyRequestBody {
  opportunityId?: string;
  brandId?: string;
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
  const { orgId, brandId: brandIdParam, featureSlug } = await ctx.params;

  if (featureSlug !== HITL_SLUG) {
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
  const brandId = body.brandId ?? brandIdParam;
  const pitchContent = body.pitchContent;

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }
  if (!pitchContent || pitchContent.trim().length === 0) {
    return NextResponse.json({ error: "pitchContent is required" }, { status: 400 });
  }
  if (brandId !== brandIdParam) {
    return NextResponse.json(
      { error: "brandId in body must match URL brandId" },
      { status: 400 },
    );
  }

  try {
    const upstreamBody: Record<string, unknown> = {
      brandId,
      pitchContent,
    };
    if (body.subject) {
      upstreamBody.subject = body.subject;
    }
    const result = await adminPost<ReplyUpstreamResponse>(
      "submitQuotePitchReply",
      `/orgs/opportunities/${opportunityId}/reply`,
      orgId,
      upstreamBody,
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
