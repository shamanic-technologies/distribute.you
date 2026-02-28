import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Home page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import WORKFLOW_DEFINITIONS from content package", () => {
    expect(content).toContain("WORKFLOW_DEFINITIONS");
    expect(content).toContain("@distribute/content");
  });

  it("should have a Features section", () => {
    expect(content).toContain("Features");
    expect(content).toContain("features-grid");
  });

  it("should render feature cards with links to /features/[sectionKey]", () => {
    expect(content).toContain("feature-card");
    expect(content).toContain("/features/${feature.sectionKey}");
  });

  it("should show Coming Soon for unimplemented features", () => {
    expect(content).toContain("Coming Soon");
    expect(content).toContain("feature.implemented");
  });

  it("should show feature label and description", () => {
    expect(content).toContain("feature.label");
    expect(content).toContain("feature.description");
  });

  it("should NOT contain workflow leaderboard content", () => {
    expect(content).not.toContain("Top Workflows");
    expect(content).not.toContain("getLeaderboardWorkflows");
    expect(content).not.toContain("costPerReplyCents");
    expect(content).not.toContain('href="/workflows"');
  });

  it("should have Organizations section", () => {
    expect(content).toContain("Organizations");
    expect(content).toContain('href="/orgs"');
  });

  it("should have API Key section", () => {
    expect(content).toContain("ApiKeyPreview");
  });
});

describe("Brand overview page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should NOT link to /workflows", () => {
    expect(content).not.toContain('href="/workflows"');
  });

  it("should have Features section header", () => {
    expect(content).toContain("Features");
  });

  it("should link to Explore Features", () => {
    expect(content).toContain("Explore Features");
  });
});
