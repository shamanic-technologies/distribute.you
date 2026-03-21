import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Press Kit page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/press-kit/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should import press kit API functions", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listMediaKits");
    expect(content).toContain("getMediaKit");
    expect(content).toContain("editMediaKit");
    expect(content).toContain("getShareToken");
  });

  it("should have a generate button", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Generate Press Kit");
    expect(content).toContain("handleGenerate");
  });

  it("should show empty state when no kits exist", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("No press kit yet");
  });

  it("should have a detail panel for viewing kit content", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("selectedKit");
    expect(content).toContain("handleViewKit");
  });

  it("should support public share link", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("publicPressKitUrl");
    expect(content).toContain("Public Link");
  });

  it("should show generating state", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("generating");
    expect(content).toContain("Generating...");
  });
});

describe("Press Kit API functions", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  it("should export MediaKit interface", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface MediaKit");
  });

  it("should export listMediaKits function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function listMediaKits");
    expect(content).toContain("/press-kits/media-kit");
  });

  it("should export editMediaKit function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function editMediaKit");
    expect(content).toContain("/press-kits/edit-media-kit");
  });

  it("should export getShareToken function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getShareToken");
    expect(content).toContain("/press-kits/organizations/share-token/");
  });
});

describe("Sidebar includes Press Kit for journalist features", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");

  it("should conditionally show Press Kit item for journalist features", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"press-kit"');
    expect(content).toContain('"Press Kit"');
    expect(content).toContain("isJournalist");
  });

  it("should only show Press Kit for sections starting with 'journalists'", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('sectionKey.startsWith("journalists")');
  });
});
