import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Breadcrumb hierarchy", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("should show org as root breadcrumb with Clerk organization name", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("organization?.name");
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

  it("should parse org/brand/feature/campaign from path structure", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain('"orgs"');
    expect(content).toContain('"brands"');
    expect(content).toContain('"features"');
    expect(content).toContain('"campaigns"');
  });

  it("should use /orgs/ path prefix for brand links", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/orgs/${orgId}/brands/");
  });

  it("should use features instead of workflows in paths", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/features/${sectionKey}");
    expect(content).not.toContain('href={`/brands/');
  });
});
