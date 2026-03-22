import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Press Kit page removed", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/press-kits/page.tsx"
  );

  it("should not exist (press kits are now campaign-driven)", () => {
    expect(fs.existsSync(pagePath)).toBe(false);
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
    expect(content).toContain('"/press-kits/media-kits"');
    expect(content).toContain("/press-kits/media-kits?org_id=");
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/mdx");
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/status");
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/validate");
    expect(content).toContain("/press-kits/media-kits/${mediaKitId}/cancel");
  });

  it("should use PATCH method for mdx and status updates", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    const mdxSection = content.slice(content.indexOf("updateMediaKitMdx"), content.indexOf("updateMediaKitStatus"));
    expect(mdxSection).toContain('method: "PATCH"');
    const statusSection = content.slice(content.indexOf("updateMediaKitStatus"), content.indexOf("validateMediaKit"));
    expect(statusSection).toContain('method: "PATCH"');
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

describe("Sidebar does not have dedicated Press Kit link", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");

  it("should not have a press-kits sidebar item", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain("isPressKit");
    expect(content).not.toContain('"Press Kits"');
  });

  it("should still have press-kit feature icon", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('sectionKey.startsWith("press-kit")');
  });
});
