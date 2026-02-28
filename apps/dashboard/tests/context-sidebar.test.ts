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

  it("should import WORKFLOW_DEFINITIONS from content package", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("WORKFLOW_DEFINITIONS");
    expect(content).toContain("@distribute/content");
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

  it("should have app-level items (Home, API Keys, Workflows)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Home"');
    expect(content).toContain('"API Keys"');
    expect(content).toContain('href: "/api-keys"');
  });

  it("should have brand-level items with feature links", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Brand Info"');
    expect(content).toContain("features/");
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});
