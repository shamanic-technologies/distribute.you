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
const opportunitiesPagePath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/opportunities/page.tsx",
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
  it("REPORT_ENABLED_FEATURES contains the PR slug", () => {
    expect(sidebarContent).toContain(`"${HITL_SLUG}"`);
    expect(sidebarContent).toMatch(
      /REPORT_ENABLED_FEATURES\s*=\s*new Set\(\[[^\]]*pr-expert-quote-opportunities[^\]]*\]\)/,
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

describe("Public report overview — redirects for PR feature slug", () => {
  it("imports redirect from next/navigation", () => {
    expect(reportOverviewContent).toContain('from "next/navigation"');
    expect(reportOverviewContent).toContain("redirect");
  });

  it("branches on the PR feature slug and redirects to /opportunities", () => {
    expect(reportOverviewContent).toContain(HITL_SLUG);
    expect(reportOverviewContent).toMatch(/redirect\([^)]*opportunities/);
  });
});

describe("Public report sidebar — adapts to feature", () => {
  it("accepts featureSlug prop", () => {
    expect(reportSidebarContent).toContain("featureSlug");
  });

  it("renders an Opportunities link for the PR feature", () => {
    expect(reportSidebarContent).toContain(HITL_SLUG);
    expect(reportSidebarContent).toContain("Opportunities");
    expect(reportSidebarContent).toContain("opportunities");
  });
});

describe("Public report header — feature label", () => {
  const headerContent = fs.readFileSync(reportHeaderPath, "utf-8");

  it("declares a label for pr-expert-quote-opportunities", () => {
    expect(headerContent).toContain(HITL_SLUG);
    expect(headerContent).toMatch(/Quote Opportunities|PR Expert Quote/);
  });
});

describe("Opportunities page — server-renders brand-scoped queue", () => {
  it("exists at /report/.../[featureSlug]/opportunities/page.tsx", () => {
    expect(fs.existsSync(opportunitiesPagePath)).toBe(true);
  });

  it("server-fetches via fetchRankedOpportunitiesByBrand (no campaignId in URL)", () => {
    const content = fs.readFileSync(opportunitiesPagePath, "utf-8");
    expect(content).toContain("fetchRankedOpportunitiesByBrand");
    // Page params do NOT include campaignId
    expect(content).not.toMatch(/campaignId\s*:\s*string/);
  });

  it("renders the PublicHitlQueue client component", () => {
    const content = fs.readFileSync(opportunitiesPagePath, "utf-8");
    expect(content).toContain("PublicHitlQueue");
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
