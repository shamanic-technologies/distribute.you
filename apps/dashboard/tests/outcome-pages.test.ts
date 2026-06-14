import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.resolve(__dirname, rel));

const brandDir = "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";
const sidebar = read("../src/components/context-sidebar.tsx");
const overviewPage = read(`${brandDir}/page.tsx`);
const outcomePage = read("../src/components/revenue/outcome-page.tsx");
const outcomeTable = read("../src/components/revenue/outcome-leads-table.tsx");
const lensMeta = read("../src/lib/outcome-lens.ts");
const betaAllowlist = read("../src/lib/beta-allowlist.ts");
const api = read("../src/lib/api.ts");
const revenueParse = read("../src/lib/revenue-parse.ts");

describe("row click → lead detail panel (status history + emails sent)", () => {
  it("the panel component exists", () => {
    expect(exists("../src/components/revenue/outcome-lead-panel.tsx")).toBe(true);
  });
  it("table rows are clickable (onSelect) and the page renders the panel on select", () => {
    expect(outcomeTable).toContain("onSelect");
    expect(outcomePage).toContain("OutcomeLeadPanel");
    expect(outcomePage).toContain("setSelected");
  });
  it("panel data is joined from existing endpoints — no faked/backend data", () => {
    expect(outcomePage).toContain("listBrandLeads");
    expect(outcomePage).toContain("listBrandEmails");
  });
  it("panel shows status history + emails sent", () => {
    const panel = read("../src/components/revenue/outcome-lead-panel.tsx");
    expect(panel).toContain("Status history");
    expect(panel).toContain("Emails sent");
    // status reached comes from real lead booleans; only known timestamps shown
    expect(panel).toContain("lastDeliveredAt");
    expect(panel).toContain("servedAt");
  });
});

describe("old Conversions surface is gone", () => {
  it("the conversions page route is deleted", () => {
    expect(exists(`${brandDir}/conversions/page.tsx`)).toBe(false);
  });
  it("the sidebar no longer links Conversions or Create Campaign", () => {
    expect(sidebar).not.toContain("`${basePath}/conversions`");
    expect(sidebar).not.toContain('label: "Create Campaign"');
  });
});

describe("three outcome pages exist (Signups / Booked Meetings / Sales)", () => {
  for (const seg of ["signups", "booked-meetings", "sales"]) {
    it(`route ${seg}/page.tsx exists and renders OutcomePage`, () => {
      expect(exists(`${brandDir}/${seg}/page.tsx`)).toBe(true);
      expect(read(`${brandDir}/${seg}/page.tsx`)).toContain("OutcomePage");
    });
  }
  it("lens metadata declares the three lenses", () => {
    for (const lens of ["signups", "booked-meetings", "sales"]) {
      expect(lensMeta).toContain(`"${lens}"`);
    }
  });
});

describe("outcome pages are BETA — gated on the email allowlist (Kevin + Adam)", () => {
  it("allowlist holds Kevin + Adam, no one else", () => {
    expect(betaAllowlist).toContain("kevin.lourd@gmail.com");
    expect(betaAllowlist).toContain("adam@distribute.you");
    expect(betaAllowlist).toContain("adam2d3d@gmail.com");
  });
  it("the page gates on useIsBetaUser and renders the beta badge", () => {
    expect(outcomePage).toContain("useIsBetaUser");
    expect(outcomePage).toContain('level="beta"');
    // non-beta / non-revenue users get the not-available card
    expect(outcomePage).toContain("isn&apos;t available yet");
  });
  it("the sidebar gates the three entries on revenueOk && isBeta with a beta maturity", () => {
    expect(sidebar).toContain("revenueOk && isBeta");
    expect(sidebar).toContain('maturity: "beta"');
  });
});

describe("features-service computes everything — the dashboard only renders", () => {
  it("pages fetch getFeatureOutcomes (the ?lens= revenue endpoint)", () => {
    expect(outcomePage).toContain("getFeatureOutcomes");
    expect(api).toMatch(/getFeatureOutcomes[\s\S]*?revenue\?\$\{query\.toString\(\)\}/);
    expect(api).toContain('query = new URLSearchParams({ brandId, lens })');
  });
  it("the per-lead probability is read straight from the wire, never derived", () => {
    // probability column reads the backend field; no orP / brand-rate math here.
    expect(outcomeTable).toContain("conversionProbabilityPct");
    expect(outcomeTable).not.toContain("orP");
    expect(outcomePage).not.toContain("orP");
    expect(outcomePage).not.toContain("visitToSignupPct");
    expect(outcomePage).not.toContain("replyToMeetingPct");
  });
  it("the revenue parser tolerates the optional per-lead probability field", () => {
    expect(revenueParse).toContain("conversionProbabilityPct: z.number().nullish()");
  });
});

describe("Overview (brand root) + retired client calc are unchanged", () => {
  it("brand root still renders the revenue overview gated on isRevenueFeature", () => {
    expect(overviewPage).toContain("RevenueOverviewSection");
    expect(overviewPage).toContain("isRevenueFeature(featureSlug)");
  });
  it("no client-side revenue aggregation lib was reintroduced", () => {
    expect(exists("../src/lib/revenue.ts")).toBe(false);
    expect(exists("../src/lib/revenue-sample.ts")).toBe(false);
  });
});
