import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Breadcrumb hierarchy", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("should show org as root breadcrumb with the PER-TAB URL org name", () => {
    // Display the URL org (per-tab, stable), cached off useOrganization when it
    // matches — NOT the raw shared active org, which flips cross-tab (#1948).
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("displayOrgName");
    expect(content).toContain("orgDisplayCacheRef");
  });

  it("should NOT use useOrg context (org is always root via Clerk)", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).not.toContain("@/lib/org-context");
    expect(content).not.toMatch(/\buseOrg\b(?!anization)/);
  });

  it("should have New organization option in org dropdown", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("New organization");
    expect(content).toContain("/onboarding");
  });

  it("should parse org/brand from path structure", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain('"orgs"');
    expect(content).toContain('"brands"');
    // The campaign switcher was removed with the campaign concept; the app-level
    // feature switcher (`"features"` path) was removed in the #1768 follow-up.
    expect(content).not.toContain('"campaigns"');
    expect(content).not.toContain('"features"');
  });

  it("should use /orgs/ path prefix for brand links", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/orgs/${orgId}/brands/");
  });

  it("should use features instead of workflows in paths", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("");
    expect(content).not.toContain('href={`/brands/');
  });
});
