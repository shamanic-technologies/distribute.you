import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Press Kit page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/press-kits/page.tsx"
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
    expect(content).toContain("drafted");
    expect(content).toContain("generating");
    expect(content).toContain("validated");
    expect(content).toContain("denied");
    expect(content).toContain("archived");
    expect(content).toContain("MediaKitStatus");
  });

  it("should not generate random UUIDs for new media kits", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("crypto.randomUUID()");
  });

  it("should call editMediaKit with instruction and brandId (no organizationUrl)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("mediaKitId:");
    expect(content).not.toContain("organizationUrl");
    expect(content).toContain("brandId,");
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

  it("should use RESTful media-kits endpoints", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    // POST /press-kits/media-kits (create/edit)
    expect(content).toContain('"/press-kits/media-kits"');
    // GET /press-kits/media-kits (list)
    expect(content).toContain("/press-kits/media-kits?org_id=");
    // PATCH .../media-kits/:id/mdx
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/mdx");
    // PATCH .../media-kits/:id/status
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/status");
    // POST .../media-kits/:id/validate
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/validate");
    // POST .../media-kits/:id/cancel
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/cancel");
  });

  it("should use PATCH method for mdx and status updates", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    // updateMediaKitMdx and updateMediaKitStatus should use PATCH
    const mdxSection = content.slice(content.indexOf("updateMediaKitMdx"), content.indexOf("updateMediaKitStatus"));
    expect(mdxSection).toContain('method: "PATCH"');
    const statusSection = content.slice(content.indexOf("updateMediaKitStatus"), content.indexOf("validateMediaKit"));
    expect(statusSection).toContain('method: "PATCH"');
  });

  it("should not use old endpoint paths", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).not.toContain("/press-kits/edit-media-kit");
    expect(content).not.toContain("/press-kits/update-mdx");
    expect(content).not.toContain("/press-kits/update-status");
    expect(content).not.toContain("/press-kits/validate");
    expect(content).not.toContain("/press-kits/cancel-draft");
    expect(content).not.toContain("/press-kits/organizations/share-token/");
  });

  it("should use new share-token path format", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getShareToken");
    expect(content).toContain("/press-kits/organizations/${orgId}/share-token");
  });

  it("should export upsertPressKitOrg function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function upsertPressKitOrg");
    expect(content).toContain("/press-kits/organizations");
  });

  it("should export checkPressKitOrgsExist function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function checkPressKitOrgsExist");
    expect(content).toContain("/press-kits/organizations/exists");
  });

  it("should not send organizationUrl in editMediaKit body", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    const editSection = content.slice(content.indexOf("export async function editMediaKit"), content.indexOf("export async function updateMediaKitMdx"));
    expect(editSection).not.toContain("organizationUrl");
  });

  it("should send brandId as x-brand-id header in editMediaKit", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    const editSection = content.slice(content.indexOf("export async function editMediaKit"), content.indexOf("export async function updateMediaKitMdx"));
    expect(editSection).toContain("x-brand-id");
    expect(editSection).toContain("brandId");
  });

  it("should support custom headers in apiCall", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("headers?: Record<string, string>");
  });
});

describe("API proxy", () => {
  const proxyPath = path.join(__dirname, "../src/app/api/v1/[...path]/route.ts");

  it("should forward x-brand-id header from client", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("x-brand-id");
  });
});

describe("Sidebar includes Press Kit for journalist features", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");

  it("should conditionally show Press Kits item for press-kit features", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"press-kits"');
    expect(content).toContain('"Press Kits"');
    expect(content).toContain("isPressKit");
  });

  it("should only show Press Kits for sections starting with 'press-kit'", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('sectionKey.startsWith("press-kit")');
  });
});
