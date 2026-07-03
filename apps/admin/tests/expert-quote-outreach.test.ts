import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const featurePagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
);
const byokBannerPath = path.resolve(
  __dirname,
  "../src/components/feature-byok-banner.tsx",
);
const runButtonPath = path.resolve(
  __dirname,
  "../src/components/feature-run-button.tsx",
);
const apiLibPath = path.resolve(__dirname, "../src/lib/api.ts");
const quoteRequestsPath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-requests/page.tsx",
);
const quotePitchesPath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-pitches/page.tsx",
);

const featurePageContent = fs.readFileSync(featurePagePath, "utf-8");
const runButtonContent = fs.readFileSync(runButtonPath, "utf-8");
const apiLibContent = fs.readFileSync(apiLibPath, "utf-8");
const quoteRequestsContent = fs.readFileSync(quoteRequestsPath, "utf-8");
const quotePitchesContent = fs.readFileSync(quotePitchesPath, "utf-8");

describe("Feature page — generic routing (no per-slug branch)", () => {
  it("does not branch on the pr-expert-quote-outreach slug", () => {
    expect(featurePageContent).not.toContain('featureSlug === "pr-expert-quote-outreach"');
    expect(featurePageContent).not.toContain("ExpertQuoteOutreachPage");
  });

  it("does not render FeatureBYOKBanner — Featured creds come from platform env (Vercel)", () => {
    expect(featurePageContent).not.toContain("FeatureBYOKBanner");
    expect(featurePageContent).not.toContain("feature-byok-banner");
  });
});

describe("FeatureBYOKBanner component removed", () => {
  it("feature-byok-banner.tsx no longer exists", () => {
    expect(fs.existsSync(byokBannerPath)).toBe(false);
  });
});

describe("FeatureRunButton — generic trigger", () => {
  it("calls triggerFeatureRun with the supplied feature slug", () => {
    expect(runButtonContent).toContain("triggerFeatureRun(featureSlug");
    expect(runButtonContent).toContain('data-testid="trigger-run-button"');
    expect(runButtonContent).toContain('data-testid="trigger-run-error"');
  });
});

describe("Quote requests + pitches — generic entity routes", () => {
  it("quote-requests page calls listQuoteRequests", () => {
    expect(quoteRequestsContent).toContain("listQuoteRequests(");
    expect(quoteRequestsContent).toContain('data-testid="quote-requests-page"');
  });

  it("quote-pitches page calls listAllQuotePitches", () => {
    expect(quotePitchesContent).toContain("listAllQuotePitches(");
    expect(quotePitchesContent).toContain('data-testid="quote-pitches-page"');
  });
});

describe("QuoteRequest type — matches journalists-quotes-service shape", () => {
  const quoteRequestBlock =
    apiLibContent.split("export interface QuoteRequest {")[1]?.split("\n}")[0] ?? "";

  it("declares fields returned by GET /orgs/quote-requests", () => {
    expect(quoteRequestBlock).toMatch(/opportunityText:\s*string/);
    expect(quoteRequestBlock).toMatch(/mediaOutlet:\s*string \| null/);
    expect(quoteRequestBlock).toMatch(/deadline:\s*string \| null/);
    expect(quoteRequestBlock).toMatch(/fetchedAt:\s*string/);
    expect(quoteRequestBlock).toMatch(/provider:\s*string/);
    expect(quoteRequestBlock).toMatch(/externalId:\s*string/);
  });

  it("does NOT declare aspirational fields the backend never returns", () => {
    expect(quoteRequestBlock).not.toContain("title:");
    expect(quoteRequestBlock).not.toContain("question:");
    expect(quoteRequestBlock).not.toContain("publication:");
    expect(quoteRequestBlock).not.toContain("priorityScore");
    expect(quoteRequestBlock).not.toMatch(/\bstatus:/);
    expect(quoteRequestBlock).not.toContain("topics:");
    expect(quoteRequestBlock).not.toContain("deadlineAt");
    expect(quoteRequestBlock).not.toContain("scoringRationale");
    expect(quoteRequestBlock).not.toContain("brandId:");
  });
});

describe("listQuoteRequests — backend contract", () => {
  const fnBlock =
    apiLibContent
      .split("export async function listQuoteRequests(")[1]
      ?.split("\nexport async function")[0] ?? "";
  const paramsBlock =
    apiLibContent
      .split("export interface ListQuoteRequestsParams {")[1]
      ?.split("\n}")[0] ?? "";

  it("declares campaign_id snake_case in params (not campaignId)", () => {
    expect(paramsBlock).toContain("campaign_id");
    expect(paramsBlock).not.toContain("campaignId");
    expect(paramsBlock).not.toContain("brandId");
    expect(paramsBlock).not.toContain("status");
  });

  it("returns { providerQuoteRequests } not { requests }", () => {
    expect(fnBlock).toContain("providerQuoteRequests");
    expect(fnBlock).not.toMatch(/\brequests:\s*QuoteRequest/);
  });

  it("validates response with Zod safeParse and console.errors on mismatch", () => {
    expect(fnBlock).toContain("safeParse");
    expect(fnBlock).toContain("[dashboard]");
  });
});

describe("Quote requests page — renders real backend shape", () => {
  it("renders opportunityText, not request.title/question", () => {
    expect(quoteRequestsContent).toContain("opportunityText");
    expect(quoteRequestsContent).not.toContain("request.title");
    expect(quoteRequestsContent).not.toContain("request.question");
  });

  it("renders mediaOutlet, not request.publication", () => {
    expect(quoteRequestsContent).toContain("mediaOutlet");
    expect(quoteRequestsContent).not.toContain("request.publication");
  });

  it("uses request.deadline, not request.deadlineAt", () => {
    expect(quoteRequestsContent).toContain("request.deadline");
    expect(quoteRequestsContent).not.toContain("deadlineAt");
  });

  it("drops priorityScore, status filter, STATUS_STYLES", () => {
    expect(quoteRequestsContent).not.toContain("priorityScore");
    expect(quoteRequestsContent).not.toContain("statusFilter");
    expect(quoteRequestsContent).not.toContain("STATUS_STYLES");
    expect(quoteRequestsContent).not.toContain("QuoteRequestStatus");
  });

  it("reads providerQuoteRequests from response, not data.requests", () => {
    expect(quoteRequestsContent).toContain("providerQuoteRequests");
    expect(quoteRequestsContent).not.toContain("data.requests");
  });

  it("forwards campaign_id snake_case to listQuoteRequests", () => {
    expect(quoteRequestsContent).toContain("campaign_id");
  });
});

describe("api client functions", () => {
  it("does not export setFeaturedCreds — Featured creds are platform-managed via env", () => {
    expect(apiLibContent).not.toContain("setFeaturedCreds");
  });

  it("declares the journalists-quotes endpoints", () => {
    expect(apiLibContent).toContain("export async function listQuoteRequests(");
    expect(apiLibContent).toContain("export async function getQuoteRequest(");
    expect(apiLibContent).toContain("export async function getQuoteRequestStats(");
    expect(apiLibContent).toContain("export async function listQuotePitches(");
    expect(apiLibContent).toContain("export async function getQuotePitch(");
  });

  it("triggerFeatureRun resolves the workflow by featureSlug then executes it", () => {
    expect(apiLibContent).toContain("export async function triggerFeatureRun(");
    const block = apiLibContent.split("export async function triggerFeatureRun(")[1];
    expect(block).toContain("listWorkflows({ featureSlug }");
    expect(block).toContain("/workflows/${wf.id}/execute");
  });

  it("triggerFeatureRun throws ApiError(404) when workflow not registered", () => {
    const block = apiLibContent.split("export async function triggerFeatureRun(")[1];
    expect(block).toContain("throw new ApiError(");
    expect(block).toContain("404");
  });
});

describe("QuotePitch type + listQuotePitches — matches journalists-quotes-service GET /orgs/quote-pitches openapi", () => {
  const quotePitchBlock =
    apiLibContent.split("export interface QuotePitch {")[1]?.split("\n}")[0] ?? "";
  const listPitchesBlock =
    apiLibContent
      .split("export async function listQuotePitches(")[1]
      ?.split("\nexport async function")[0] ?? "";
  const listPitchesParamsBlock =
    apiLibContent
      .split("export interface ListQuotePitchesParams {")[1]
      ?.split("\n}")[0] ?? "";

  it("declares fields returned by the wire (brandIds[] not brandId, draft not pitchText, error not errorMessage, featuredArticleUrl not publishedUrl)", () => {
    expect(quotePitchBlock).toMatch(/brandIds:\s*string\[\]/);
    expect(quotePitchBlock).toMatch(/draft:\s*string \| null/);
    expect(quotePitchBlock).toMatch(/error:\s*string \| null/);
    expect(quotePitchBlock).toMatch(/featuredArticleUrl:\s*string \| null/);
    expect(quotePitchBlock).toMatch(/deliveryMethod:\s*QuotePitchDeliveryMethod/);
    expect(quotePitchBlock).toMatch(/pitchCharCount:\s*number \| null/);
    expect(quotePitchBlock).toMatch(/pitchAttempts:\s*number \| null/);
    expect(quotePitchBlock).toMatch(/quoteOpportunityId:\s*string \| null/);
  });

  it("does NOT declare aspirational fields the wire never returns", () => {
    expect(quotePitchBlock).not.toMatch(/\bpitchText:/);
    expect(quotePitchBlock).not.toMatch(/\bbrandId:/);
    expect(quotePitchBlock).not.toMatch(/\bexpertName:/);
    expect(quotePitchBlock).not.toMatch(/\bexpertTitle:/);
    expect(quotePitchBlock).not.toMatch(/\bselectedAt:/);
    expect(quotePitchBlock).not.toMatch(/\bpublishedAt:/);
    expect(quotePitchBlock).not.toMatch(/\bpublishedUrl:/);
    expect(quotePitchBlock).not.toMatch(/\berrorMessage:/);
  });

  it("QuotePitchStatus enum declares all 10 wire statuses", () => {
    const enumBlock =
      apiLibContent.split("export type QuotePitchStatus =")[1]?.split(";")[0] ?? "";
    for (const status of [
      "drafted",
      "submitted",
      "selected",
      "published",
      "not_selected",
      "error",
      "length_violation",
      "template_missing",
      "brand_missing_fields",
      "insufficient_credits",
    ]) {
      expect(enumBlock).toContain(`"${status}"`);
    }
  });

  it("ListQuotePitchesParams uses snake_case campaign_id (not camelCase) and drops brandId", () => {
    expect(listPitchesParamsBlock).toContain("campaign_id");
    expect(listPitchesParamsBlock).not.toMatch(/\bcampaignId\b/);
    expect(listPitchesParamsBlock).not.toMatch(/\bbrandId\b/);
  });

  it("returns { quotePitches } not { pitches }", () => {
    expect(listPitchesBlock).toContain("quotePitches");
    expect(listPitchesBlock).not.toMatch(/\bpitches:\s*QuotePitch/);
    expect(listPitchesBlock).not.toMatch(/\btotal:\s*number\b/);
  });
});

describe("HITL helpers — journalists-quotes-service v0.8.1 contract (x-brand-id header, Gold ids)", () => {
  const rankedBlock =
    apiLibContent
      .split("export async function listRankedOpportunities(")[1]
      ?.split("\nexport ")[0] ?? "";
  const replyBlock =
    apiLibContent
      .split("export async function submitQuoteOpportunityReply(")[1]
      ?.split("\nexport ")[0] ?? "";
  const draftBlock =
    apiLibContent
      .split("export async function generateQuoteDraft(")[1]
      ?.split("\nexport ")[0] ?? "";

  it("listRankedOpportunities is a GET on /orgs/opportunities with x-brand-id header, no brandId/campaignId", () => {
    // Canonical read surface (DIS-102): GET /orgs/opportunities with query
    // params. The deprecated POST /orgs/opportunities/ranked must not appear
    // in the dashboard — clean cut, no legacy/fallback path.
    expect(rankedBlock).toContain("/orgs/opportunities");
    expect(rankedBlock).not.toContain("/orgs/opportunities/ranked");
    expect(rankedBlock).toMatch(/method:\s*["']GET["']/);
    expect(rankedBlock).toContain('"x-brand-id"');
    expect(rankedBlock).not.toMatch(/brandId\s*[:,]\s*brandId/);
    expect(rankedBlock).not.toMatch(/campaignId\s*[:,]/);
  });

  it("submitQuoteOpportunityReply sends x-brand-id header, body has no brandId/campaignId", () => {
    expect(replyBlock).toContain("/orgs/opportunities/");
    expect(replyBlock).toContain("/reply");
    expect(replyBlock).toContain('"x-brand-id"');
    expect(replyBlock).not.toMatch(/brandId\s*[:,]\s*brandId/);
    expect(replyBlock).not.toMatch(/campaignId\s*[:,]/);
  });

  it("generateQuoteDraft hits content-gen via api-service /content/generate-expert-quote-pitch with x-brand-id header", () => {
    expect(draftBlock).toContain("/content/generate-expert-quote-pitch");
    expect(draftBlock).toContain('"x-brand-id"');
    // Old upstream endpoint must NOT be referenced
    expect(draftBlock).not.toContain("/orgs/quote-requests/");
    expect(draftBlock).not.toMatch(/\/draft['"`]/);
  });
});

describe("Authed HITL quote-requests page — handleGenerate sends the all-required contract", () => {
  const handleGenerateBlock =
    quoteRequestsContent.split("const handleGenerate")[1]?.split("};")[0] ?? "";
  it("passes expert attribution from featureInputs + the opportunity (content-gen PR #124)", () => {
    // Expert name/title/photo/LinkedIn come from the operator's campaign
    // featureInputs (DIS-136); the orchestrator (generateExpertQuotePitch)
    // fetches brand identity + extracts description/HQ/bio and assembles the
    // brands[] + expert + journalistRequest + expertAnswerContext body.
    expect(handleGenerateBlock).toContain("expert: {");
    expect(handleGenerateBlock).toContain("expertName: featureInputs.expertName");
    expect(handleGenerateBlock).toContain("expertTitle: featureInputs.expertTitle");
    expect(handleGenerateBlock).toContain("expertPhotoUrl: featureInputs.expertPhotoUrl");
    expect(handleGenerateBlock).toContain("expertLinkedIn: featureInputs.expertLinkedIn");
    expect(handleGenerateBlock).toContain("opportunity,");
  });
  it("no longer assembles the legacy contract or flat template variables", () => {
    expect(handleGenerateBlock).not.toContain("buildBrandVariableFromInputs");
    expect(handleGenerateBlock).not.toContain("buildQuoteRequestVariable");
    expect(handleGenerateBlock).not.toContain("buildAdditionalContextVariable");
    expect(handleGenerateBlock).not.toContain("additionalContext:");
    expect(handleGenerateBlock).not.toContain("opportunityText:");
    expect(handleGenerateBlock).not.toContain("spokesperson:");
    expect(handleGenerateBlock).not.toContain("expertiseTopics:");
  });
  it("threads campaignId into the generate mutation body (campaign-level cost attribution)", () => {
    // content-gen (f59c704) reads campaignId from the body → the generate LLM
    // spend is attributed to the campaign, not just brand+feature. (#1209 had
    // dropped it as scope when the contract only took { variables, brandIds }.)
    expect(handleGenerateBlock).toMatch(/campaignId\s*[,}]/);
  });
  it("threads revisionInstructions (Edit-with-AI modal) into the generate body", () => {
    expect(handleGenerateBlock).toContain("revisionInstructions");
  });
});

describe("Authed HITL quote-requests page — Edit with AI revision modal", () => {
  it("renames the regenerate action to 'Edit with AI'", () => {
    expect(quoteRequestsContent).toContain('"Edit with AI"');
  });
  it("renders the revision modal: textarea + regenerate submit", () => {
    expect(quoteRequestsContent).toContain('data-testid="quote-revision-modal"');
    expect(quoteRequestsContent).toContain('data-testid="quote-revision-textarea"');
    expect(quoteRequestsContent).toContain('data-testid="quote-revision-submit"');
  });
  it("opens the modal when a draft exists, generates directly on first run", () => {
    expect(quoteRequestsContent).toContain("setEditModalOpen(true)");
    expect(quoteRequestsContent).toContain("handleGenerate(null)");
  });
});

describe("Authed HITL quote-requests page — campaign inputs are the DIS-136 attribution keys", () => {
  it("HITL_INPUT_KEYS = expertName/expertTitle/expertPhotoUrl/expertLinkedIn (not the dropped blob keys)", () => {
    const keysBlock =
      quoteRequestsContent.split("const HITL_INPUT_KEYS")[1]?.split("]")[0] ?? "";
    expect(keysBlock).toContain("expertName");
    expect(keysBlock).toContain("expertTitle");
    expect(keysBlock).toContain("expertPhotoUrl");
    expect(keysBlock).toContain("expertLinkedIn");
    // DIS-136 dropped these; they must not gate the page anymore.
    expect(keysBlock).not.toContain("spokesperson");
    expect(keysBlock).not.toContain("expertiseTopics");
    expect(keysBlock).not.toContain("responseStyle");
    expect(keysBlock).not.toContain("valueProposition");
  });
});

describe("Authed HITL quote-requests page — relevance ScoreBadge (0–100 judge score)", () => {
  it("renders the score directly as a percent — never `score * 100` (was '9500')", () => {
    // Relevance judge (DIS-79) emits a 0–100 score (e.g. 95). The badge must
    // render `Math.round(score)` + '%' → "95%". `Math.round(score * 100)`
    // produced "9500". Regression guard for the screenshot bug.
    expect(quoteRequestsContent).not.toMatch(/score\s*\*\s*100/);
    expect(quoteRequestsContent).toContain("Math.round(score)");
    expect(quoteRequestsContent).toMatch(/\{pct\}%/);
  });
});
