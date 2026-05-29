import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FEATURE_GATES, MATURITY_STYLES } from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

describe("feature-gates registry", () => {
  it("gates services-crm + keys as alpha with alpha-* flags", () => {
    expect(FEATURE_GATES["services-crm"]).toEqual({ flag: "alpha-services-crm", maturity: "alpha" });
    expect(FEATURE_GATES["keys"]).toEqual({ flag: "alpha-keys", maturity: "alpha" });
  });

  it("every flag follows the <maturity>-<surface> naming convention", () => {
    for (const gate of Object.values(FEATURE_GATES)) {
      expect(gate.flag.startsWith(`${gate.maturity}-`)).toBe(true);
    }
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
});
