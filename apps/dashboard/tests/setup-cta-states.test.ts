import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard page shows features from WORKFLOW_DEFINITIONS", () => {
  it("should use WORKFLOW_DEFINITIONS instead of performance leaderboard", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WORKFLOW_DEFINITIONS");
    expect(content).toContain("@distribute/content");
    // Should NOT have the old leaderboard fetching
    expect(content).not.toContain("performance/leaderboard");
    expect(content).not.toContain("costPerReplyCents");
    expect(content).not.toContain("topWorkflows");
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
