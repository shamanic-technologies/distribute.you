import { NextResponse } from "next/server";
import { adminPost, fetchBrand } from "@/lib/report-api";
import {
  buildExpertQuotePitchVariables,
  coerceExtractedToString,
  ExpertQuotePitchInputError,
} from "@/lib/quote-pitch-variables";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";

// Public-report draft generation. The upstream `/orgs/quote-requests/:id/draft`
// endpoint on journalists-quotes-service was removed in v0.8.1 — the service is
// now a pure opportunity catalog + submit. The pitch is composed here through
// api-service:
//   1. GET  /brands/:id            → brand identity (name / url / logoUrl)
//   2. POST /brands/extract-fields → brand + expert fields the public report
//                                    has no campaign inputs for (description,
//                                    HQ, bio, name, title, headshot, LinkedIn)
//   3. POST /v1/content/generate-expert-quote-pitch → render + run content-gen
//
// content-gen PR #124 / v0.21.0 made the template's `variables` body EXPLICIT
// + ALL-REQUIRED — every declared field must be non-empty or it 400s. The
// public report is brand-scoped (no campaign → no operator featureInputs), so
// EVERY brand + expert field is sourced from extract-fields. We never send an
// empty/placeholder value: `buildExpertQuotePitchVariables` throws (→ 422) when
// extraction yields nothing for a required field.
//
// The public page never holds an admin key client-side; this Route Handler
// proxies through api-service with the server-side ADMIN_DISTRIBUTE_API_KEY.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

// Fields extracted via brand-service extract-fields. Descriptions seed the
// extraction prompt; the expert-* keys mirror DIS-136 extractKeys for quality.
const EXTRACT_FIELDS = [
  {
    key: "brandDescription",
    description: "One-line description of what the company does and who it serves.",
  },
  {
    key: "brandHeadquartersLocation",
    description: "City and country/region of the company's headquarters.",
  },
  {
    key: "expertBio",
    description:
      "Short professional bio of the company's spokesperson/expert — role, experience, and credentials.",
  },
  {
    key: "expertName",
    description: "Full name of the company's spokesperson/expert (from the about/team page).",
  },
  {
    key: "expertTitle",
    description: "Title or role of the spokesperson/expert (e.g. 'CEO & Co-founder').",
  },
  {
    key: "expertPhotoUrl",
    description: "URL of the spokesperson/expert's headshot image.",
  },
  {
    key: "expertLinkedIn",
    description: "URL of the spokesperson/expert's LinkedIn profile.",
  },
];

interface DraftRequestBody {
  opportunityId?: string;
  opportunityText?: string;
  mediaOutlet?: string | null;
  journalistName?: string | null;
  deadline?: string | null;
  whyRelevant?: string | null;
  category?: string | null;
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

  if (!isExpertQuoteFeature(featureSlug)) {
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

  const {
    opportunityId,
    opportunityText,
    mediaOutlet,
    journalistName,
    deadline,
    whyRelevant,
    category,
  } = body;
  if (!opportunityId || !opportunityText) {
    return NextResponse.json(
      { error: "opportunityId and opportunityText are required" },
      { status: 400 },
    );
  }

  const brandHeader = { "x-brand-id": brandId };

  // Question-driven brand evidence: append an extract-fields entry seeded with
  // the journalist's question so brand-service mines the brand for facts that
  // answer THIS question (description-hash keyed → its own cache slot). Feeds
  // `expertAnswerContext.brandEvidence`, replacing the old whyRelevant/category.
  const extractFields = [
    ...EXTRACT_FIELDS,
    { key: "expertAnswerContext", description: opportunityText.trim() },
  ];

  try {
    // 1 + 2. Brand identity (name/url/logoUrl) and the extracted brand/expert
    //        fields, in parallel.
    const [brand, extracted] = await Promise.all([
      fetchBrand(orgId, brandId),
      adminPost<ExtractFieldsResponse>(
        "extractBrandFields",
        `/brands/extract-fields`,
        orgId,
        { brandIds: [brandId], fields: extractFields },
        brandHeader,
      ),
    ]);

    // 3. Assemble the all-required contract. Throws ExpertQuotePitchInputError
    //    (→ 422) if any required field is empty — no empty/placeholder is sent.
    const f = extracted.fields;
    const variables = buildExpertQuotePitchVariables({
      identity: {
        brandName: brand?.name ?? null,
        brandUrl: brand?.url ?? null,
        brandLogoUrl: brand?.logoUrl ?? null,
      },
      extracted: {
        brandDescription: coerceExtractedToString(f.brandDescription?.value),
        brandHeadquartersLocation: coerceExtractedToString(
          f.brandHeadquartersLocation?.value,
        ),
        expertBio: coerceExtractedToString(f.expertBio?.value),
      },
      expert: {
        expertName: coerceExtractedToString(f.expertName?.value),
        expertTitle: coerceExtractedToString(f.expertTitle?.value),
        expertPhotoUrl: coerceExtractedToString(f.expertPhotoUrl?.value),
        expertLinkedIn: coerceExtractedToString(f.expertLinkedIn?.value),
      },
      opportunity: {
        opportunityText,
        mediaOutlet,
        journalistName,
        deadline,
        whyRelevant,
        category,
      },
      // Public report has no "Edit with AI" modal and no brand-scoped pitch
      // list helper, so revision instructions + prior pitches are absent here.
      // brandEvidence (question-driven) is the grounding win and rides along.
      answerContext: {
        brandEvidence: coerceExtractedToString(f.expertAnswerContext?.value),
        evidenceSourceUrls: [],
        revisionInstructions: null,
        priorSubmittedPitches: [],
      },
    });

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
    if (err instanceof ExpertQuotePitchInputError) {
      // Required data couldn't be sourced — fail loud with the specific field.
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
