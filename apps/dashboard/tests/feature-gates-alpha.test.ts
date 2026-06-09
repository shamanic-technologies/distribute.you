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

  it("gates public metrics as alpha", () => {
    expect(FEATURE_GATES["public-metrics"]).toEqual({ flag: "alpha-public-metrics", maturity: "alpha" });
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
    sidebar.indexOf("const OutcomeOutletIcon"),
  );

  it("OrgLevelSidebar no longer renders an org-level Features section", () => {
    expect(org.length).toBeGreaterThan(0);
    expect(org).not.toMatch(/Features<\/h4>/);
    expect(org).not.toMatch(/featureItems/);
  });

  it("OrgLevelSidebar keeps Billing ungated (GA)", () => {
    expect(org).toMatch(/label:\s*"Billing"/);
  });

  // Scope to the BrandLevelSidebar function body only.
  const brand = sidebar.slice(
    sidebar.indexOf("function BrandLevelSidebar"),
    sidebar.indexOf("function BrandSettingsLevelSidebar"),
  );
  // Scope to the BrandSettingsLevelSidebar function body only.
  const brandSettings = sidebar.slice(
    sidebar.indexOf("function BrandSettingsLevelSidebar"),
    sidebar.indexOf("const ENTITY_ICON_MAP"),
  );

  it("Brand Info moved out of BrandLevelSidebar into BrandSettingsLevelSidebar (alpha-gated)", () => {
    expect(brand.length).toBeGreaterThan(0);
    expect(brandSettings.length).toBeGreaterThan(0);
    // No longer at brand level…
    expect(brand).not.toMatch(/FEATURE_GATES\["brand-info"\]/);
    // …now gated under Brand Settings.
    expect(brandSettings).toMatch(/FEATURE_GATES\["brand-info"\]/);
  });

  it("BrandLevelSidebar gates features behind brand-features alpha flag + GA set", () => {
    expect(brand).toMatch(/FEATURE_GATES\["brand-features"\]/);
    expect(brand).toMatch(/GA_BRAND_FEATURES/);
  });

  it("BrandLevelSidebar renders a GA Database section header (for all users)", () => {
    expect(brand).toMatch(/Database<\/h4>/);
  });

  it("BrandLevelSidebar gates Outlets/Journalists/Articles behind brand-database alpha; Leads+Emails stay GA", () => {
    expect(brand).toMatch(/FEATURE_GATES\["brand-database"\]/);
    // Leads + Emails are the GA exceptions kept regardless of the flag.
    expect(brand).toMatch(/item\.id === "leads" \|\| item\.id === "emails"/);
  });
});

describe("brand overview page — alpha gating + Outcomes", () => {
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );

  it("imports the shared gating primitives", () => {
    expect(page).toMatch(/useFeatureFlag/);
    expect(page).toMatch(/MaturityBadge/);
    expect(page).toMatch(/FEATURE_GATES/);
    expect(page).toMatch(/GA_BRAND_FEATURES/);
  });

  it("gates features behind the brand-features alpha flag", () => {
    expect(page).toMatch(/FEATURE_GATES\["brand-features"\]/);
  });

  it("no longer renders a Brand Info card (moved under Brand Settings)", () => {
    expect(page).not.toMatch(/FEATURE_GATES\["brand-info"\]/);
  });
});
