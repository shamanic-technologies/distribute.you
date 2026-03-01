import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard home page redirects to active org", () => {
  it("should redirect to /orgs/{activeOrgId}", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("router.replace");
    expect(content).toContain("/orgs/");
    // Should NOT have old content page elements
    expect(content).not.toContain("WORKFLOW_DEFINITIONS");
    expect(content).not.toContain("performance/leaderboard");
  });
});

describe("BrandsList shows 'View campaigns' CTA", () => {
  it("should display a 'View campaigns' link on each brand card", () => {
    const componentPath = path.join(
      __dirname,
      "../src/components/brands-list.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("View campaigns");
    expect(content).toContain("text-brand-500");
  });
});
