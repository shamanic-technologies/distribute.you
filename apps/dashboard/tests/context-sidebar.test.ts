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
    // The feature/featureSettings AND campaign levels were removed (single-feature
    // product + one subscription per brand — everything flattens to the brand).
    expect(content).toContain('"app"');
    expect(content).toContain('"appFeature"');
    expect(content).toContain('"org"');
    expect(content).toContain('"brand"');
    expect(content).toContain('"brandSettings"');
    expect(content).not.toContain('"campaign"');
  });

  it("should render no app-level nav (root only redirects to /orgs)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // The build-in-public "public metrics" analytics links were removed; the
    // app-level sidebar now renders nothing.
    expect(content).not.toContain("Unique visitors");
    expect(content).not.toContain("/?view=landing");
    expect(content).not.toContain('href: `/features/${f.slug}`');
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

  it("should have brand-level items (single-feature nav flattened into the brand)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // The feature segment + the campaign concept are gone from the BRAND sidebar:
    // it's Overview + the entity Database + Brand Settings. The brand "Campaigns"
    // entry (`${basePath}/campaigns`), "Create Campaign" and "Conversions" were
    // all removed. (The app-FEATURE level sidebar keeps its own "Campaigns" list
    // entry at `/features/[featureId]` — a separate surface, out of brand scope.)
    expect(content).toContain('label: "Overview"');
    expect(content).toContain("Database");
    expect(content).not.toContain('href: `${basePath}/campaigns`');
    expect(content).not.toContain('label: "Create Campaign"');
    expect(content).not.toContain('href: `${basePath}/conversions`');
  });

  it("should grey out coming soon items with a tag (SidebarLink primitive)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // The brand feature-grid (and its `!f.implemented` greying) was removed, but
    // the SidebarLink primitive keeps the comingSoon affordance for any item.
    expect(content).toContain("comingSoon");
    expect(content).toContain("Coming soon");
    expect(content).toContain("opacity-60");
  });
  it("should NOT have 'All Organizations' back link in org sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('"All Organizations"');
  });

  it("should NOT have a Brands link at org level (brands list removed)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('label: "Brands"');
  });

  it("should NOT have a Tools section in brand sidebar (outlets and journalists moved to campaign modules)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain("/tools/outlets");
    expect(content).not.toContain("/tools/journalists");
    expect(content).not.toContain("/tools/press-kits");
  });

  it("should have brand back link point to the org overview", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('backLabel="Overview"');
    expect(content).toContain('backHref={`/orgs/${orgId}`}');
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

  it("keeps the Workflows route (folded into Brand Settings, staff-only alpha)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('`${basePath}/workflows`');
    expect(content).toContain('FEATURE_GATES["workflows"]');
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});
