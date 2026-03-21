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
    expect(content).toContain("upsertPressKitOrg");
    expect(content).toContain("validateMediaKit");
    expect(content).toContain("cancelDraftMediaKit");
  });

  it("should upsert org on mount", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("upsertPressKitOrg(orgId)");
  });

  it("should filter media kits by orgId", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listMediaKits(orgId)");
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

  it("should support validate and cancel-draft actions", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("handleValidate");
    expect(content).toContain("handleCancelDraft");
    expect(content).toContain("Validate");
    expect(content).toContain("Cancel");
  });

  it("should use correct media kit statuses", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    // Statuses appear as Record keys (unquoted) and in comparisons
    expect(content).toContain("drafted");
    expect(content).toContain("generating");
    expect(content).toContain("validated");
    expect(content).toContain("denied");
    expect(content).toContain("archived");
    // Should reference the MediaKitStatus type
    expect(content).toContain("MediaKitStatus");
  });
});

describe("Press Kit API functions", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  it("should export MediaKit interface and MediaKitStatus type", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface MediaKit");
    expect(content).toContain("export type MediaKitStatus");
  });

  it("should export listMediaKits with orgId filter", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function listMediaKits");
    expect(content).toContain("org_id=${orgId}");
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

  it("should export upsertPressKitOrg function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function upsertPressKitOrg");
    expect(content).toContain("/press-kits/organizations");
  });

  it("should export updateMediaKitMdx function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function updateMediaKitMdx");
    expect(content).toContain("/press-kits/update-mdx");
  });

  it("should export updateMediaKitStatus function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function updateMediaKitStatus");
    expect(content).toContain("/press-kits/update-status");
  });

  it("should export validateMediaKit function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function validateMediaKit");
    expect(content).toContain("/press-kits/validate");
  });

  it("should export cancelDraftMediaKit function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function cancelDraftMediaKit");
    expect(content).toContain("/press-kits/cancel-draft");
  });

  it("should export checkPressKitOrgsExist function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function checkPressKitOrgsExist");
    expect(content).toContain("/press-kits/organizations/exists");
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
