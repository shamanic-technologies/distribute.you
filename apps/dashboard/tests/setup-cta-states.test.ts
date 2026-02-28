import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard page fetches real workflows from leaderboard", () => {
  it("should fetch top workflows from performance leaderboard and render them", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("performance/leaderboard");
    expect(content).toContain("costPerReplyCents");
    expect(content).toContain("topWorkflows");
    // Should NOT have the old static WORKFLOW_DEFINITIONS
    expect(content).not.toContain("WORKFLOW_DEFINITIONS");
    expect(content).not.toContain("SalesColdEmailsCard");
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
