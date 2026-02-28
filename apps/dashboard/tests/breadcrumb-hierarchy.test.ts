import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Breadcrumb hierarchy", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("should import useApp for app name", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("useApp");
    expect(content).toContain("@/lib/app-context");
  });

  it("should parse org/brand/feature/campaign from new path structure", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    // Check path parsing references the new structure
    expect(content).toContain('"orgs"');
    expect(content).toContain('"brands"');
    expect(content).toContain('"features"');
    expect(content).toContain('"campaigns"');
  });

  it("should show app name as first breadcrumb", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("app?.name");
  });

  it("should use /orgs/ path prefix for brand links", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/orgs/${orgId}/brands/");
  });

  it("should use features instead of workflows in paths", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/features/${sectionKey}");
    // Should NOT have the old /workflows/ path structure in links
    expect(content).not.toContain('href={`/brands/');
  });
});
