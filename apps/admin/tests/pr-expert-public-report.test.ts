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
const statusPagePath = path.resolve(
  __dirname,
  "../src/app/report/[orgId]/[brandId]/[featureSlug]/[status]/page.tsx",
);
const statusViewPath = path.resolve(
  __dirname,
  "../src/components/report/pitch-status-view.tsx",
);
const tabsLibPath = path.resolve(__dirname, "../src/lib/report-pitch-tabs.ts");
const reportHeaderPath = path.resolve(
  __dirname,
  "../src/components/report/header.tsx",
);

const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
const reportApiContent = fs.readFileSync(reportApiPath, "utf-8");
const reportOverviewContent = fs.readFileSync(reportOverviewPath, "utf-8");
const reportSidebarContent = fs.readFileSync(reportSidebarPath, "utf-8");
const statusPageContent = fs.readFileSync(statusPagePath, "utf-8");
const statusViewContent = fs.readFileSync(statusViewPath, "utf-8");
const tabsLibContent = fs.readFileSync(tabsLibPath, "utf-8");

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

describe("report-pitch-tabs — read-only status tab model", () => {
  it("declares exactly the 4 tabs Published / Selected / In Review / Pitched", () => {
    expect(tabsLibContent).toContain('slug: "published"');
    expect(tabsLibContent).toContain('slug: "selected"');
    expect(tabsLibContent).toContain('slug: "in-review"');
    expect(tabsLibContent).toContain('slug: "pitched"');
    expect(tabsLibContent).toContain('label: "Published"');
    expect(tabsLibContent).toContain('label: "Selected"');
    expect(tabsLibContent).toContain('label: "In Review"');
    expect(tabsLibContent).toContain('label: "Pitched"');
  });

  it("maps each tab to its wire pitch status (Pitched←drafted, In Review←submitted)", () => {
    const block = stripComments(tabsLibContent);
    expect(block).toMatch(/slug:\s*"published"[\s\S]*?statuses:\s*\[\s*"published"\s*\]/);
    expect(block).toMatch(/slug:\s*"selected"[\s\S]*?statuses:\s*\[\s*"selected"\s*\]/);
    expect(block).toMatch(/slug:\s*"in-review"[\s\S]*?statuses:\s*\[\s*"submitted"\s*\]/);
    expect(block).toMatch(/slug:\s*"pitched"[\s\S]*?statuses:\s*\[\s*"drafted"\s*\]/);
  });

  it("does NOT surface not_selected / error statuses in any tab", () => {
    const block = stripComments(tabsLibContent);
    // The tab definitions array must not reference a rejected/failure status.
    const tabsArray = block.split("PITCH_STATUS_TABS")[1]?.split("]")[0] ?? "";
    expect(tabsArray).not.toContain("not_selected");
    expect(tabsArray).not.toContain("length_violation");
  });

  it("exposes countsByTab for the sidebar badges", () => {
    expect(tabsLibContent).toContain("export function countsByTab");
  });
});

describe("Public report base route — redirects to the first status tab", () => {
  it("imports redirect from next/navigation", () => {
    expect(reportOverviewContent).toContain('from "next/navigation"');
    expect(reportOverviewContent).toContain("redirect");
  });

  it("branches on the PR feature family and redirects to /published (no dead Overview)", () => {
    expect(reportOverviewContent).toContain("isExpertQuoteFeature(featureSlug)");
    expect(reportOverviewContent).toMatch(/redirect\([^)]*\/published/);
    // Old first-entity redirect target is gone.
    expect(stripComments(reportOverviewContent)).not.toMatch(/redirect\([^)]*quote-requests/);
  });
});

describe("Public report sidebar — 4 status tabs with counts", () => {
  it("accepts featureSlug + counts props", () => {
    expect(reportSidebarContent).toContain("featureSlug");
    expect(reportSidebarContent).toContain("counts");
    expect(reportSidebarContent).toContain("PitchTabCounts");
  });

  it("renders the 4 status tabs for the PR feature (via PITCH_STATUS_TABS)", () => {
    expect(reportSidebarContent).toContain("isExpertQuoteFeature(featureSlug)");
    expect(reportSidebarContent).toContain("PITCH_STATUS_TABS");
    // Labels come from the tab model, not literals — assert the model import.
    expect(reportSidebarContent).toContain('from "@/lib/report-pitch-tabs"');
  });

  it("drops the old Quote requests / Pitches / Prompt links + the dead Overview", () => {
    const stripped = stripComments(reportSidebarContent);
    const hitlBranch =
      stripped.split("if (isExpertQuoteFeature(featureSlug))")[1]?.split("}")[0] ?? "";
    expect(hitlBranch).not.toContain("Overview");
    expect(hitlBranch).not.toContain("Quote requests");
    expect(hitlBranch).not.toContain("/prompt");
  });
});

describe("Public report header — feature label", () => {
  const headerContent = fs.readFileSync(reportHeaderPath, "utf-8");

  it("declares a label for pr-expert-quote-opportunities", () => {
    expect(headerContent).toContain(HITL_SLUG);
    expect(headerContent).toMatch(/Quote Opportunities|PR Expert Quote/);
  });
});

describe("Status tab route — read-only, gated on feature + tab slug", () => {
  it("exists at /report/.../[featureSlug]/[status]/page.tsx", () => {
    expect(fs.existsSync(statusPagePath)).toBe(true);
  });

  it("gates on isExpertQuoteFeature + tabForSlug and 404s otherwise", () => {
    expect(statusPageContent).toContain("isExpertQuoteFeature(featureSlug)");
    expect(statusPageContent).toContain("tabForSlug(status)");
    expect(statusPageContent).toContain("notFound()");
  });

  it("is read-only — no write path, no Clerk apiCall", () => {
    expect(statusPageContent).not.toMatch(/\/api\/report\//);
    expect(statusPageContent).not.toContain("useAuthQuery");
    expect(statusPageContent).not.toContain("<textarea");
    expect(statusPageContent).not.toContain("PublicHitlQueue");
  });

  it("has its own table-shaped loading skeleton", () => {
    const loadingPath = path.resolve(
      __dirname,
      "../src/app/report/[orgId]/[brandId]/[featureSlug]/[status]/loading.tsx",
    );
    expect(fs.existsSync(loadingPath)).toBe(true);
    const content = stripComments(fs.readFileSync(loadingPath, "utf-8"));
    // Not the sales overview funnel copy.
    expect(content).not.toContain("Cost per acquisition");
  });
});

describe("PitchStatusView — the shared read-only press-tracker table", () => {
  it("server-fetches pitches + the quote-request outlet index (read-only)", () => {
    expect(statusViewContent).toContain("fetchQuotePitchesByBrand");
    expect(statusViewContent).toContain("fetchQuoteRequestIndex");
    expect(statusViewContent).not.toMatch(/\/api\/report\//);
    expect(statusViewContent).not.toContain("useAuthQuery");
  });

  it("renders the 5 columns Publication / Article / DR / Attribution / Updated", () => {
    expect(statusViewContent).toContain("Publication");
    expect(statusViewContent).toContain("Article");
    expect(statusViewContent).toContain("DR");
    expect(statusViewContent).toContain("Attribution");
    expect(statusViewContent).toContain("Updated");
  });

  it("renders the Publication logo via ProviderLogo keyed on the outlet domain (never the pitchUrl)", () => {
    expect(statusViewContent).toContain("ProviderLogo");
    expect(statusViewContent).toContain("toDomain");
    // The connectively.us platform link must never feed the logo (it would put
    // the same Connectively logo on every row).
    expect(statusViewContent).not.toContain("outletPitchUrl");
  });

  it("renders DR / Attribution / publish date from the wire, never fabricated", () => {
    // DR + Attribution + publish date now arrive on the pitch (journalists-
    // quotes-service reconcile). The view reads them straight off the wire —
    // a genuinely-absent value falls back to "—" / "Unknown", never computed
    // from names/heuristics.
    expect(statusViewContent).toContain("pitch.outletDomainRating");
    expect(statusViewContent).toContain("pitch.backlinkAttribution");
    expect(statusViewContent).toContain("pitch.publicationSource");
    // publish date drives the timestamp (not the bulk reconcile updatedAt)
    expect(tabsLibContent).toContain("pitch.publishedAt");
  });
});

describe("report-api.ts — brand-scoped read-only fetchers", () => {
  it("keeps adminPost helper with optional extraHeaders", () => {
    expect(reportApiContent).toMatch(/(?:async function|export async function) adminPost</);
    expect(reportApiContent).toContain("X-API-Key");
    expect(reportApiContent).toContain("x-external-org-id");
    expect(reportApiContent).toMatch(/adminPost<[\s\S]*?extraHeaders\??:\s*Record<string,\s*string>/);
  });

  it("declares fetchQuotePitchesByBrand filtering org pitches by brandIds", () => {
    expect(reportApiContent).toContain("fetchQuotePitchesByBrand");
    const block =
      reportApiContent
        .split("export async function fetchQuotePitchesByBrand")[1]
        ?.split("export ")[0] ?? "";
    expect(block).toContain("/orgs/quote-pitches");
    expect(block).toContain("brandIds.includes(brandId)");
  });

  it("declares fetchQuoteRequestIndex hitting /orgs/quote-requests, keyed by request id", () => {
    expect(reportApiContent).toContain("fetchQuoteRequestIndex");
    const block =
      reportApiContent
        .split("export async function fetchQuoteRequestIndex")[1]
        ?.split("export ")[0] ?? "";
    expect(block).toContain("/orgs/quote-requests");
    expect(block).toContain("providerQuoteRequests");
    expect(block).toContain('"x-brand-id"');
  });
});

describe("Removed interactive HITL surface — write path is gone", () => {
  const removed = [
    "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-requests/page.tsx",
    "../src/app/report/[orgId]/[brandId]/[featureSlug]/quote-pitches/page.tsx",
    "../src/app/report/[orgId]/[brandId]/[featureSlug]/prompt/page.tsx",
    "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/draft/route.ts",
    "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/reply/route.ts",
    "../src/components/report/public-hitl-queue.tsx",
  ];
  for (const rel of removed) {
    it(`removed: ${rel.split("/").slice(-2).join("/")}`, () => {
      expect(fs.existsSync(path.resolve(__dirname, rel))).toBe(false);
    });
  }
});
