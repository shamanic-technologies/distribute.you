import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const HITL_SLUG = "pr-expert-quote-opportunities";

const sidebarPath = path.resolve(
  __dirname,
  "../src/components/context-sidebar.tsx",
);
const reportSidebarPath = path.resolve(
  __dirname,
  "../src/components/report/sidebar.tsx",
);
const reportApiPath = path.resolve(__dirname, "../src/lib/report-api.ts");
const reportOverviewPath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/page.tsx",
);
const quoteRequestsPagePath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-requests/page.tsx",
);
const quotePitchesPagePath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-pitches/page.tsx",
);
const promptPagePath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/prompt/page.tsx",
);
const publicHitlPath = path.resolve(
  __dirname,
  "../src/components/report/public-hitl-queue.tsx",
);
const draftRoutePath = path.resolve(
  __dirname,
  "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/draft/route.ts",
);
const replyRoutePath = path.resolve(
  __dirname,
  "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/reply/route.ts",
);
const reportHeaderPath = path.resolve(
  __dirname,
  "../src/components/report/header.tsx",
);

const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
const reportApiContent = fs.readFileSync(reportApiPath, "utf-8");
const reportOverviewContent = fs.readFileSync(reportOverviewPath, "utf-8");
const reportSidebarContent = fs.readFileSync(reportSidebarPath, "utf-8");

/** Strip block + line comments so assertions don't false-positive on doc
 *  references to old endpoints / fields. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("Sidebar — Report link enabled for pr-expert-quote-opportunities", () => {
  it("enables the report link for the pr-expert-quote family via isExpertQuoteFeature", () => {
    // The family is matched by the helper (not listed in the Set), so a
    // workflow re-version (-opportunities → -outreach) keeps the report link.
    expect(sidebarContent).toMatch(
      /reportEnabled\s*=[\s\S]*isExpertQuoteFeature\(featureSlug\)/,
    );
  });

  it("still has sales-cold-email-outreach (regression guard)", () => {
    expect(sidebarContent).toContain('"sales-cold-email-outreach"');
  });
});

describe("report-api.ts — brand-scoped HITL fetchers", () => {
  it("declares adminPost helper for write proxies with optional headers", () => {
    expect(reportApiContent).toMatch(/(?:async function|export async function) adminPost</);
    expect(reportApiContent).toContain("X-API-Key");
    expect(reportApiContent).toContain("x-external-org-id");
    // adminPost must accept an optional `extraHeaders` arg so callers can set
    // identity headers like `x-brand-id`.
    expect(reportApiContent).toMatch(/adminPost<[\s\S]*?extraHeaders\??:\s*Record<string,\s*string>/);
  });

  it("declares fetchRankedOpportunitiesByBrand (brand-scoped)", () => {
    expect(reportApiContent).toContain("fetchRankedOpportunitiesByBrand");
    expect(reportApiContent).toMatch(
      /fetchRankedOpportunitiesByBrand\s*\([^)]*orgId[^)]*brandId/,
    );
  });

  it("ranked-by-brand GET sends x-brand-id header, limit in query, no brandId/campaignId", () => {
    const rawBlock =
      reportApiContent
        .split("export async function fetchRankedOpportunitiesByBrand")[1]
        ?.split("export ")[0] ?? "";
    const block = stripComments(rawBlock);
    // Canonical read surface (DIS-102): GET /orgs/opportunities. The
    // deprecated POST /orgs/opportunities/ranked must not appear — clean cut,
    // no legacy/fallback path.
    expect(block).toContain("/orgs/opportunities");
    expect(block).not.toContain("/orgs/opportunities/ranked");
    // x-brand-id header must be present
    expect(block).toContain('"x-brand-id"');
    // The read uses adminGet (no request body): brand identity flows via the
    // x-brand-id header, pagination via the query string.
    const callMatch = block.match(/adminGet<[\s\S]*?>\s*\([\s\S]*?\)\s*;/);
    expect(callMatch).not.toBeNull();
    // The call must carry neither brandId nor campaignId as a value-introducer
    // ( : or , ) — brand identity flows via header, not the args.
    const callText = callMatch![0];
    expect(callText).not.toMatch(/\bbrandId\s*[:,]/);
    expect(callText).not.toMatch(/\bcampaignId\s*[:,]/);
  });
});

describe("Public report base route — redirects to first entity for PR feature slug", () => {
  it("imports redirect from next/navigation", () => {
    expect(reportOverviewContent).toContain('from "next/navigation"');
    expect(reportOverviewContent).toContain("redirect");
  });

  it("branches on the PR feature family and redirects to /quote-requests (no dead Overview)", () => {
    expect(reportOverviewContent).toContain("isExpertQuoteFeature(featureSlug)");
    expect(reportOverviewContent).toMatch(/redirect\([^)]*quote-requests/);
  });
});

describe("Public report sidebar — mirrors the campaign entities (Quote requests · Pitches · Prompt)", () => {
  it("accepts featureSlug prop", () => {
    expect(reportSidebarContent).toContain("featureSlug");
  });

  it("renders exactly the 3 campaign-mirrored links for the PR feature", () => {
    expect(reportSidebarContent).toContain("isExpertQuoteFeature(featureSlug)");
    expect(reportSidebarContent).toContain("Quote requests");
    expect(reportSidebarContent).toContain("Pitches");
    expect(reportSidebarContent).toContain("Prompt");
    expect(reportSidebarContent).toContain("/quote-requests");
    expect(reportSidebarContent).toContain("/quote-pitches");
    expect(reportSidebarContent).toContain("/prompt");
  });

  it("drops the dead Overview link from the PR feature branch", () => {
    // The HITL branch must not emit an Overview entry — the base route
    // redirects to the first entity instead. (Overview stays only on the
    // sales/default branch.) Strip comments first (a code comment mentioning
    // Overview would false-positive), then isolate the HITL `return [...]`
    // array — the first one after the slug check, up to its closing `];`.
    const stripped = stripComments(reportSidebarContent);
    const hitlReturn =
      stripped.split("if (isExpertQuoteFeature(featureSlug))")[1]?.split("];")[0] ?? "";
    expect(hitlReturn).toContain("Quote requests");
    expect(hitlReturn).not.toContain("Overview");
  });
});

describe("Public report header — feature label", () => {
  const headerContent = fs.readFileSync(reportHeaderPath, "utf-8");

  it("declares a label for pr-expert-quote-opportunities", () => {
    expect(headerContent).toContain(HITL_SLUG);
    expect(headerContent).toMatch(/Quote Opportunities|PR Expert Quote/);
  });
});

describe("Quote-requests page — server-renders brand-scoped HITL queue", () => {
  it("exists at /report/.../[featureSlug]/quote-requests/page.tsx (renamed from opportunities)", () => {
    expect(fs.existsSync(quoteRequestsPagePath)).toBe(true);
  });

  it("server-fetches via fetchRankedOpportunitiesByBrand (no campaignId in URL)", () => {
    const content = fs.readFileSync(quoteRequestsPagePath, "utf-8");
    expect(content).toContain("fetchRankedOpportunitiesByBrand");
    // Page params do NOT include campaignId
    expect(content).not.toMatch(/campaignId\s*:\s*string/);
  });

  it("renders the PublicHitlQueue client component", () => {
    const content = fs.readFileSync(quoteRequestsPagePath, "utf-8");
    expect(content).toContain("PublicHitlQueue");
  });

  it("has its own loading skeleton (queue-shaped, NOT the sales stats/CPA funnel)", () => {
    const loadingPath = path.resolve(
      __dirname,
      "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-requests/loading.tsx",
    );
    expect(fs.existsSync(loadingPath)).toBe(true);
    const content = stripComments(fs.readFileSync(loadingPath, "utf-8"));
    // Must not reuse the sales overview funnel copy.
    expect(content).not.toContain("Cost per acquisition");
  });
});

describe("Pitches page — read-only brand-scoped pitch list", () => {
  it("exists at /report/.../[featureSlug]/quote-pitches/page.tsx", () => {
    expect(fs.existsSync(quotePitchesPagePath)).toBe(true);
  });

  it("server-fetches via fetchQuotePitchesByBrand (read-only, no mutations)", () => {
    const content = fs.readFileSync(quotePitchesPagePath, "utf-8");
    expect(content).toContain("fetchQuotePitchesByBrand");
    // Read-only: no draft/reply route handler calls, no Clerk apiCall.
    expect(content).not.toContain("useAuthQuery");
    expect(content).not.toMatch(/\/api\/report\//);
  });

  it("has its own loading skeleton", () => {
    const loadingPath = path.resolve(
      __dirname,
      "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-pitches/loading.tsx",
    );
    expect(fs.existsSync(loadingPath)).toBe(true);
  });
});

describe("Prompt page — read-only generation template", () => {
  it("exists at /report/.../[featureSlug]/prompt/page.tsx", () => {
    expect(fs.existsSync(promptPagePath)).toBe(true);
  });

  it("server-fetches via fetchPromptAssignment, renders template + variables read-only", () => {
    const content = fs.readFileSync(promptPagePath, "utf-8");
    expect(content).toContain("fetchPromptAssignment");
    expect(content).toContain("promptType");
    // Read-only: no save/fork, no editable textarea, no Clerk apiCall.
    expect(content).not.toContain("savePromptAssignment");
    expect(content).not.toContain("useAuthQuery");
    expect(content).not.toContain("<textarea");
  });
});

describe("report-api.ts — brand-scoped read-only fetchers for Pitches + Prompt", () => {
  it("declares fetchQuotePitchesByBrand filtering org pitches by brandIds", () => {
    expect(reportApiContent).toContain("fetchQuotePitchesByBrand");
    const block =
      reportApiContent
        .split("export async function fetchQuotePitchesByBrand")[1]
        ?.split("export ")[0] ?? "";
    expect(block).toContain("/orgs/quote-pitches");
    expect(block).toContain("brandIds.includes(brandId)");
  });

  it("declares fetchPromptAssignment hitting /content/prompt-assignments", () => {
    expect(reportApiContent).toContain("fetchPromptAssignment");
    const block =
      reportApiContent
        .split("export async function fetchPromptAssignment")[1]
        ?.split("export ")[0] ?? "";
    expect(block).toContain("/content/prompt-assignments");
    expect(block).toContain("featureSlug");
  });
});

describe("PublicHitlQueue client component — uses dashboard route handlers", () => {
  it("exists", () => {
    expect(fs.existsSync(publicHitlPath)).toBe(true);
  });

  it('is a "use client" component', () => {
    const content = fs.readFileSync(publicHitlPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("calls /api/report/.../draft and /api/report/.../reply (NOT authed apiCall)", () => {
    const content = fs.readFileSync(publicHitlPath, "utf-8");
    expect(content).toMatch(/\/api\/report\/[^\s'"]+\/draft/);
    expect(content).toMatch(/\/api\/report\/[^\s'"]+\/reply/);
    // The public component must not import the Clerk-authenticated apiCall
    expect(content).not.toContain('from "@/lib/api"');
    expect(content).not.toContain("useAuthQuery");
  });

  it("ScoreBadge renders the score directly as a percent — never `score * 100` (was '9500')", () => {
    // Relevance judge (DIS-79) emits a 0–100 score (e.g. 95). The public report
    // badge must render `Math.round(score)` + '%' → "95%". `score * 100` → "9500".
    const content = fs.readFileSync(publicHitlPath, "utf-8");
    expect(content).not.toMatch(/score\s*\*\s*100/);
    expect(content).toContain("Math.round(score)");
    expect(content).toMatch(/\{pct\}%/);
  });
});

describe("Draft route handler — admin-key composite (extract-fields + content-gen)", () => {
  it("exists", () => {
    expect(fs.existsSync(draftRoutePath)).toBe(true);
  });

  it("delegates to adminPost + fetchBrand (admin key + org context held server-side)", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("adminPost");
    expect(content).toContain("fetchBrand");
    expect(content).toContain('from "@/lib/report-api"');
  });

  it("orchestrates brand fetch + brands/extract-fields + content/generate-expert-quote-pitch (no platform-prompts discovery)", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    // content-gen PR #124 contract is a fixed all-required set — the template
    // variable-discovery step (GET /content/platform-prompts) is gone.
    expect(content).not.toContain("/content/platform-prompts");
    // 1. Brand identity (name/url/logoUrl)
    expect(content).toContain("fetchBrand");
    // 2. Extract the brand + expert fields the public report has no inputs for
    expect(content).toContain("/brands/extract-fields");
    // 3. Generate pitch via content-generation-service with the new contract
    expect(content).toContain("/content/generate-expert-quote-pitch");
    expect(content).toContain("buildExpertQuotePitchVariables");
  });

  it("extracts the full brand + expert attribution set (incl. headshot URL) — public report has no campaign inputs", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    for (const key of [
      "brandDescription",
      "brandHeadquartersLocation",
      "expertBio",
      "expertName",
      "expertTitle",
      "expertPhotoUrl",
      "expertLinkedIn",
    ]) {
      expect(content).toContain(key);
    }
  });

  it("fails loud (422) with the offending field when a required value can't be sourced", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("ExpertQuotePitchInputError");
    expect(content).toContain("status: 422");
  });

  it("does NOT call the removed /orgs/quote-requests/:id/draft endpoint", () => {
    const content = stripComments(fs.readFileSync(draftRoutePath, "utf-8"));
    // No active adminPost call references the removed upstream path
    expect(content).not.toMatch(/`\/orgs\/quote-requests\//);
    expect(content).not.toContain("quoteRequestId");
  });

  it("accepts opportunity context (text, outlet, deadline) in body — supplied by client", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("opportunityId");
    expect(content).toContain("opportunityText");
    expect(content).toContain("mediaOutlet");
    expect(content).toContain("deadline");
  });

  it("sets x-brand-id header on brand-extract + generate calls", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain('"x-brand-id"');
  });

  it("forwards no campaignId in upstream POST bodies", () => {
    const content = stripComments(fs.readFileSync(draftRoutePath, "utf-8"));
    expect(content).not.toMatch(/\bcampaignId\s*[:,]/);
    // Brand identity flows via `brandIds: [brandId]` (plural array for content-
    // gen tracking) + `x-brand-id` header — not as a bare scalar in any body.
    // The brandIds plural form is the only allowed brand reference in body.
    expect(content).toContain("brandIds: [brandId]");
  });

  it("is POST-only", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+POST/);
  });
});

describe("Reply route handler — admin-key proxy, brand-scoped via header", () => {
  it("exists", () => {
    expect(fs.existsSync(replyRoutePath)).toBe(true);
  });

  it("delegates to adminPost (which holds admin key + org context)", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toContain("adminPost");
    expect(content).toContain('from "@/lib/report-api"');
  });

  it("targets /orgs/opportunities/<id>/reply", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toContain("/orgs/opportunities/");
    expect(content).toContain("/reply");
  });

  it("sets x-brand-id header and forwards pitchContent in body; no brandId/campaignId in body", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toContain("pitchContent");
    expect(content).toContain('"x-brand-id"');
    // No brandId/campaignId in upstream body per journalists-quotes-service v0.8.1
    expect(content).not.toMatch(/brandId\s*[:,]\s*brandId/);
    expect(content).not.toMatch(/campaignId\s*[:,]/);
  });

  it("invalidates the brand opportunities cache on success", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toContain("revalidateTag");
    expect(content).toContain("opportunities:brand:");
  });

  it("is POST-only", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+POST/);
  });
});

describe("PublicHitlQueue client — draft body carries opportunity context", () => {
  it("draft POST body includes opportunityText/mediaOutlet/deadline (Route Handler composes pitch)", () => {
    const content = fs.readFileSync(publicHitlPath, "utf-8");
    // Route Handler needs these fields to build content-gen variables
    expect(content).toContain("opportunityText");
    expect(content).toContain("mediaOutlet");
    expect(content).toContain("deadline");
  });
});
