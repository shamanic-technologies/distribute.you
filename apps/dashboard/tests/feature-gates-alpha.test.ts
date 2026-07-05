import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FEATURE_GATES, MATURITY_STYLES, GA_BRAND_FEATURES } from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

describe("feature-gates registry", () => {
  it("gates services-crm + keys as alpha with alpha-* flags", () => {
    expect(FEATURE_GATES["services-crm"]).toEqual({ flag: "alpha-services-crm", maturity: "alpha" });
    expect(FEATURE_GATES["keys"]).toEqual({ flag: "alpha-keys", maturity: "alpha" });
  });

  it("gates brand-info + brand-features as alpha with alpha-* flags", () => {
    expect(FEATURE_GATES["brand-info"]).toEqual({ flag: "alpha-brand-info", maturity: "alpha" });
    expect(FEATURE_GATES["brand-features"]).toEqual({ flag: "alpha-brand-features", maturity: "alpha" });
  });

  it("gates workflows (page + sidebar entries) as alpha; Feature Settings landing is GA", () => {
    expect(FEATURE_GATES["workflows"]).toEqual({ flag: "alpha-workflows", maturity: "alpha" });
    // Feature Settings itself is GA → no gate entry for it.
    expect(FEATURE_GATES).not.toHaveProperty("feature-settings");
  });

  it("gates brand-database as alpha (Outlets/Journalists/Articles; Leads+Emails stay GA)", () => {
    expect(FEATURE_GATES["brand-database"]).toEqual({ flag: "alpha-brand-database", maturity: "alpha" });
  });

  it("every flag follows the <maturity>-<surface> naming convention", () => {
    for (const gate of Object.values(FEATURE_GATES)) {
      expect(gate.flag.startsWith(`${gate.maturity}-`)).toBe(true);
    }
  });
});

describe("GA_BRAND_FEATURES — brand-page GA exceptions", () => {
  it("contains only sales cold-email (pr cold-email is alpha-gated)", () => {
    expect(GA_BRAND_FEATURES.has("sales-cold-email-outreach")).toBe(true);
    expect(GA_BRAND_FEATURES.has("pr-cold-email-outreach")).toBe(false);
    expect(GA_BRAND_FEATURES.size).toBe(1);
  });
});

describe("MaturityBadge styles", () => {
  it("alpha = amber, beta = violet", () => {
    expect(MATURITY_STYLES.alpha).toContain("amber");
    expect(MATURITY_STYLES.beta).toContain("violet");
  });
});

describe("org overview page — stats + org-level feature surface removed", () => {
  const page = read("../src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx");

  it("has no quick-stats grid", () => {
    expect(page).not.toMatch(/overview-stats/);
    expect(page).not.toMatch(/StatCard/);
  });

  it("does not fetch global stats", () => {
    expect(page).not.toMatch(/fetchGlobalStats/);
  });

  it("has no org-level Features summary heading", () => {
    expect(page).not.toMatch(/>\s*Features\s*<\/h2>/);
  });
});

describe("context-sidebar — alpha gating + maturity badges", () => {
  const sidebar = read("../src/components/context-sidebar.tsx");

  it("imports the shared gating primitives", () => {
    expect(sidebar).toMatch(/useFeatureFlag/);
    expect(sidebar).toMatch(/MaturityBadge/);
    expect(sidebar).toMatch(/FEATURE_GATES/);
  });

  it("gates CRM + Keys behind their alpha flags", () => {
    expect(sidebar).toMatch(/FEATURE_GATES\["services-crm"\]/);
    expect(sidebar).toMatch(/FEATURE_GATES\["keys"\]/);
  });

  // Scope the next assertions to the OrgLevelSidebar function body only —
  // App/Brand sidebars legitimately keep their own Features sections.
  const org = sidebar.slice(
    sidebar.indexOf("function OrgLevelSidebar"),
    sidebar.indexOf("const ENTITY_ICON_MAP"),
  );

  it("OrgLevelSidebar no longer renders an org-level Features section", () => {
    expect(org.length).toBeGreaterThan(0);
    expect(org).not.toMatch(/Features<\/h4>/);
    expect(org).not.toMatch(/featureItems/);
  });

  it("OrgLevelSidebar keeps Billing ungated (GA)", () => {
    expect(org).toMatch(/label:\s*"Billing"/);
  });

  // Scope to the BrandLevelSidebar function body only. The Brand Settings level
  // was flattened into this sidebar, so its body now runs to ContextSidebar.
  const brand = sidebar.slice(
    sidebar.indexOf("function BrandLevelSidebar"),
    sidebar.indexOf("export function ContextSidebar"),
  );

  it("Brand Info is a flat footer link in BrandLevelSidebar (alpha-gated)", () => {
    expect(brand.length).toBeGreaterThan(0);
    // Brand Info folded into the brand sidebar footer, still alpha-gated.
    expect(brand).toMatch(/FEATURE_GATES\["brand-info"\]/);
    expect(brand).toMatch(/`\$\{basePath\}\/brand-info`/);
  });

  it("Brand Profile surfaced flat in BrandLevelSidebar footer (next to Brand Settings)", () => {
    expect(brand.length).toBeGreaterThan(0);
    // Flat at brand level, replacing the old intermediate Settings button.
    expect(brand).toMatch(/id:\s*"brand-profile"/);
    expect(brand).toMatch(/`\$\{basePath\}\/brand-profile`/);
  });

  it("BrandLevelSidebar no longer renders a Database section header", () => {
    // The entity Database section was removed — lead data is surfaced via the
    // overview's lead detail panel.
    expect(brand).not.toMatch(/Database<\/h4>/);
  });
});

describe("brand overview page — is the (sole) feature's Revenue overview", () => {
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );

  // The feature segment was flattened into the brand level (single-feature
  // product): the brand root renders the feature's Outreach & Conversions overview
  // inline. The old feature-grid + Ahrefs BrandMetricsHeader + per-feature alpha
  // gating + Brand Info card were all REMOVED from this page.
  it("renders the Revenue overview inline (not a feature grid / metrics header)", () => {
    expect(page).toMatch(/RevenueOverviewSection/);
    expect(page).not.toMatch(/BrandMetricsHeader/);
    expect(page).not.toMatch(/FEATURE_GATES/);
  });
});
