import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as featureGates from "../src/lib/feature-gates";
import { MATURITY_STYLES, GA_BRAND_FEATURES } from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

/**
 * There is no alpha gating in the dashboard, and there must not be one again.
 *
 * `useFeatureFlag` returned `false` unconditionally in this app since the
 * admin/dashboard split, so a gate did not STAGE a surface — it REMOVED it: the nav
 * entry rendered for nobody and the page was reachable only by typing a URL. Brand
 * Info, Workflows and the Google CRM console lived that way for months before being
 * deleted; all three exist in `apps/admin`, where the flag resolves. A dashboard
 * surface that needs a limited audience uses the EMAIL allowlist, which evaluates.
 */
describe("no alpha gating in the dashboard", () => {
  it("the FEATURE_GATES registry is gone", () => {
    expect(featureGates).not.toHaveProperty("FEATURE_GATES");
  });

  it("the useFeatureFlag hook is gone — the file itself must not come back", () => {
    expect(fs.existsSync(path.join(__dirname, "../src/lib/use-feature-flag.ts"))).toBe(false);
  });

  // Match the CALL, not the bare word: several files legitimately EXPLAIN in a
  // comment why this app has no flag gating, and a guard that trips on its own
  // rationale is the source-substring trap this repo keeps recording.
  it("nothing under src calls useFeatureFlag", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && fs.readFileSync(full, "utf-8").includes("useFeatureFlag("))
          offenders.push(path.relative(path.join(__dirname, "../src"), full));
      }
    };
    walk(path.join(__dirname, "../src"));
    expect(offenders).toEqual([]);
  });

  it("the surfaces those gates hid are DELETED, not left URL-reachable", () => {
    for (const dead of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info",
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows",
      "app/(authed)/(dashboard)/workflows",
      "app/(authed)/(dashboard)/orgs/[orgId]/services",
      "app/(authed)/services",
      "components/workflows",
    ]) {
      expect(fs.existsSync(path.join(__dirname, "../src", dead)), dead).toBe(false);
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

describe("context-sidebar — no alpha gating, badges kept for beta", () => {
  const sidebar = read("../src/components/context-sidebar.tsx");

  it("still renders a maturity badge (the beta surfaces use it)", () => {
    expect(sidebar).toMatch(/MaturityBadge/);
  });

  it("holds no gate: every entry it renders is one somebody can actually reach", () => {
    // The CALL and the registry READ — the file's comments explain the history and
    // must stay free to name both.
    expect(sidebar).not.toMatch(/useFeatureFlag\(/);
    expect(sidebar).not.toMatch(/FEATURE_GATES\[/);
  });

  it("carries no link to a deleted surface", () => {
    expect(sidebar).not.toContain("/services/crm");
    expect(sidebar).not.toContain("/brand-info");
    expect(sidebar).not.toContain("}/workflows");
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

  it("no longer offers Brand Info or Workflows (both deleted)", () => {
    expect(brand.length).toBeGreaterThan(0);
    expect(brand).not.toContain("/brand-info");
    expect(brand).not.toContain("}/workflows");
  });

  it("no longer surfaces a Brand Profile footer link (page removed)", () => {
    expect(brand.length).toBeGreaterThan(0);
    // The standalone Brand Profile page + its nav entry were removed with the
    // 2-layer user-fields migration; the 7 fields are edited on Strategy / onboarding.
    expect(brand).not.toMatch(/id:\s*"brand-profile"/);
    expect(brand).not.toContain("/brand-profile`");
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
