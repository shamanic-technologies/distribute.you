import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Context sidebar", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");

  it("should exist", () => {
    expect(fs.existsSync(sidebarPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should import useFeatures from features-context", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("useFeatures");
    expect(content).toContain("@/lib/features-context");
  });

  it("should handle all navigation levels", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"app"');
    expect(content).toContain('"org"');
    expect(content).toContain('"brand"');
    expect(content).toContain('"feature"');
    expect(content).toContain('"campaign"');
  });

  it("should return null for campaign level (defers to CampaignSidebar)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('case "campaign"');
    expect(content).toContain("return null");
  });

  it("should have app-level items (Home) and feature links", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Home"');
    // Features section with links to /features/
    expect(content).toContain("Features");
    expect(content).toContain("/features/");
  });

  it("should NOT have API Keys at app level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('href: "/api-keys"');
  });

  it("should have API Keys at org level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('`/orgs/${orgId}/api-keys`');
  });

  it("should NOT have a Workflows link in app-level sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('href: "/workflows"');
  });

  it("should have brand-level items with feature links", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Brand Info"');
    expect(content).toContain("features/");
  });

  it("should grey out coming soon features with a tag", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("comingSoon");
    expect(content).toContain("Coming soon");
    expect(content).toContain("opacity-60");
    expect(content).toContain("!f.implemented");
  });
  it("should NOT have 'All Organizations' back link in org sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('"All Organizations"');
  });

  it("should have Brands link at org level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('`/orgs/${orgId}/brands`');
  });

  it("should have Features section in org sidebar with useFeatures", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // OrgLevelSidebar maps features from useFeatures to featureItems
    expect(content).toContain("useFeatures");
    expect(content).toContain("featureItems");
  });

  it("should have Tools section in brand sidebar with outlets, press kits, and journalists", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("Tools");
    expect(content).toContain("/tools/outlets");
    expect(content).toContain("/tools/press-kits");
    expect(content).toContain("/tools/journalists");
  });

  it("should have brand back link point to brands page", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('backLabel="Brands"');
    expect(content).toContain('`/orgs/${orgId}/brands`');
  });

  it("should have unified Keys entry at org level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Keys"');
    expect(content).toContain('`/orgs/${orgId}/api-keys`');
  });

  it("should have Workflows link in app feature sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Workflows"');
    expect(content).toContain('`${basePath}/workflows`');
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});
