import { NextResponse } from "next/server";
import { adminGet, adminPost } from "@/lib/report-api";

// Public-report draft generation. The upstream `/orgs/quote-requests/:id/draft`
// endpoint on journalists-quotes-service was removed in v0.8.1 (PR #41,
// commit 4982ea4) — the service is now a pure opportunity catalog + submit.
// Pitch generation is composed client-side from three calls through
// api-service:
//   1. GET  /v1/content/platform-prompts?type=expert-quote-pitch
//        → discover which variables the prompt template expects
//   2. POST /v1/brands/extract-fields
//        → extract brand-derivable variables via brand-service
//   3. POST /v1/content/generate-expert-quote-pitch
//        → render template + run content-generation-service
//
// The public page never holds an admin key client-side; this Route Handler
// proxies through api-service with the server-side ADMIN_DISTRIBUTE_API_KEY.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const HITL_SLUG = "pr-expert-quote-opportunities";
const PROMPT_TYPE = "expert-quote-pitch";

// Template variables that come from the SELECTED OPPORTUNITY row, not from
// brand-service. The client always has these on the ranked-queue row, so the
// dashboard composes them in directly rather than trying to brand-extract
// them. If the template adds a new opportunity-context variable, list it
// here so the dashboard does not mistakenly try to brand-extract it.
const OPPORTUNITY_VARS = new Set([
  "opportunityText",
  "mediaOutlet",
  "deadline",
]);

interface DraftRequestBody {
  opportunityId?: string;
  opportunityText?: string;
  mediaOutlet?: string | null;
  deadline?: string | null;
}

interface PromptTemplate {
  id: string;
  type: string;
  prompt: string;
  variables: Array<{ name: string; description: string }>;
}

interface ExtractFieldsResponse {
  brands: Array<{
    brandId: string;
    domain: string;
    name: string;
    brandUrl: string;
  }>;
  fields: Record<
    string,
    {
      value: unknown;
      byBrand: Record<string, { value: unknown }>;
    }
  >;
}

interface GenerateResponse {
  pitch: string;
  charCount: number;
  attempts: number;
  tokensInput: number;
  tokensOutput: number;
}

export async function POST(req: Request, ctx: RouteContext) {
  const { orgId, brandId, featureSlug } = await ctx.params;

  if (featureSlug !== HITL_SLUG) {
    return NextResponse.json(
      {
        error: `featureSlug ${featureSlug} is not enabled for HITL draft generation`,
      },
      { status: 404 },
    );
  }

  let body: DraftRequestBody;
  try {
    body = (await req.json()) as DraftRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { opportunityId, opportunityText, mediaOutlet, deadline } = body;
  if (!opportunityId || !opportunityText) {
    return NextResponse.json(
      { error: "opportunityId and opportunityText are required" },
      { status: 400 },
    );
  }

  const brandHeader = { "x-brand-id": brandId };

  try {
    // 1. Discover prompt template variable shape (names + descriptions). The
    //    template is platform-wide; this call has no identity coupling but we
    //    still go via api-service for consistent auth.
    const template = await adminGet<PromptTemplate>(
      "getExpertQuotePitchTemplate",
      `/content/platform-prompts?type=${encodeURIComponent(PROMPT_TYPE)}`,
      orgId,
    );

    // 2. Split template variables into brand-derivable (extract via
    //    brand-service) vs opportunity-context (supplied by client).
    const brandFields = template.variables.filter(
      (v) => !OPPORTUNITY_VARS.has(v.name),
    );

    const extracted = await adminPost<ExtractFieldsResponse>(
      "extractBrandFields",
      `/brands/extract-fields`,
      orgId,
      {
        brandIds: [brandId],
        fields: brandFields.map((v) => ({
          key: v.name,
          description: v.description,
        })),
      },
      brandHeader,
    );

    const brandValues: Record<string, unknown> = {};
    for (const v of brandFields) {
      brandValues[v.name] = extracted.fields?.[v.name]?.value ?? null;
    }

    // 3. Assemble variables (brand-extracted + opportunity context) and
    //    render via content-generation-service /generate-expert-quote-pitch.
    const variables: Record<string, unknown> = {
      ...brandValues,
      opportunityText,
      mediaOutlet: mediaOutlet ?? null,
      deadline: deadline ?? null,
    };

    const result = await adminPost<GenerateResponse>(
      "generateExpertQuotePitch",
      `/content/generate-expert-quote-pitch`,
      orgId,
      {
        variables,
        brandIds: [brandId],
        featureSlug,
      },
      brandHeader,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
