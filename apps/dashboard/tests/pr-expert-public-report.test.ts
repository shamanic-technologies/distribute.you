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
  it("declares adminPost helper for write proxies", () => {
    expect(reportApiContent).toMatch(/async function adminPost</);
    expect(reportApiContent).toContain("X-API-Key");
    expect(reportApiContent).toContain("x-external-org-id");
  });

  it("declares fetchRankedOpportunitiesByBrand (brand-scoped)", () => {
    expect(reportApiContent).toContain("fetchRankedOpportunitiesByBrand");
    expect(reportApiContent).toMatch(
      /fetchRankedOpportunitiesByBrand\s*\([^)]*orgId[^)]*brandId/,
    );
  });

  it("ranked-by-brand POST body uses brandId, no campaignId", () => {
    const block =
      reportApiContent
        .split("export async function fetchRankedOpportunitiesByBrand")[1]
        ?.split("export ")[0] ?? "";
    expect(block).toContain("/orgs/opportunities/ranked");
    expect(block).toContain("brandId");
    // POST body builder must not embed campaignId
    expect(block).not.toMatch(/campaignId\s*[:,]/);
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
});

describe("Draft route handler — admin-key proxy, brand-scoped", () => {
  it("exists", () => {
    expect(fs.existsSync(draftRoutePath)).toBe(true);
  });

  it("delegates to adminPost (which holds admin key + org context)", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("adminPost");
    expect(content).toContain('from "@/lib/report-api"');
  });

  it("targets /orgs/quote-requests/<id>/draft", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("/orgs/quote-requests/");
    expect(content).toContain("/draft");
  });

  it("body forwards brandId (campaignId optional / absent)", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toContain("brandId");
    // No campaignId in the upstream body
    expect(content).not.toMatch(/campaignId\s*[:,]/);
  });

  it("is POST-only", () => {
    const content = fs.readFileSync(draftRoutePath, "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+POST/);
  });
});

describe("Reply route handler — admin-key proxy, brand-scoped", () => {
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

  it("body forwards brandId + pitchContent", () => {
    const content = fs.readFileSync(replyRoutePath, "utf-8");
    expect(content).toContain("brandId");
    expect(content).toContain("pitchContent");
    // No campaignId in the upstream body
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
