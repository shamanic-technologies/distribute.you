import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard home page shows public global metrics", () => {
  it("should keep / as the build-in-public root and link into orgs", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("distribute public metrics");
    expect(content).toContain("fetchPublicStatsSummary");
    expect(content).toContain("Unique visitors over time");
    expect(content).toContain("Signup conversion over time");
    expect(content).toContain("Cards added over time");
    expect(content).toContain('href="/orgs"');
    expect(content).not.toContain("useOrganization");
    expect(content).not.toContain("router.replace");
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
