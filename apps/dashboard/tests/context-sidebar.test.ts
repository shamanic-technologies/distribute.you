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
    // The feature/featureSettings AND app-level feature ("Campaigns" island)
    // levels were removed (single-feature product at the brand level per brand).
    // The Brand Settings level was flattened into the brand sidebar (settings /
    // profile / info / workflows are flat footer links). The CAMPAIGN level is
    // re-introduced as a staff/god-mode v2 preview (#2762) — `.../campaigns/[id]`
    // swaps to the campaign sidebar. So nav is app → org → brand → campaign.
    expect(content).toContain('"app"');
    expect(content).toContain('"org"');
    expect(content).toContain('"brand"');
    expect(content).toContain('"campaign"');
    expect(content).not.toContain('"brandSettings"');
    expect(content).not.toContain('"appFeature"');
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
    // The feature segment is gone from the BRAND sidebar: it's Overview + Brand
    // Settings (the entity "Database" section was removed — lead data is now
    // surfaced via the overview's lead detail panel). Brand Profile lives inside
    // Brand Settings. The legacy "Create Campaign" and "Conversions" entries were
    // removed. (The app-level feature "Campaigns" island at
    // `/features/[featureId]` was also removed — #1768 follow-up.)
    // NOTE: a NEW staff/god-mode "Campaigns" entry (`${basePath}/campaigns`,
    // `campaignsOk` gate) re-introduces the campaign-centered v2 preview — see the
    // dedicated guard below; the general no-legacy assertions here exclude it.
    expect(content).toContain('label: "Overview"');
    expect(content).not.toContain('>Database<');
    expect(content).not.toContain('label: "Create Campaign"');
    expect(content).not.toContain('href: `${basePath}/conversions`');
  });

  it("has a STAFF-gated (v2) Campaigns entry with a beta badge", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // Re-introduced campaign concept: staff/god-mode preview only, so the entry is
    // gated on `campaignsOk` (isAdmin + revenue feature) and carries the beta badge.
    expect(content).toContain("const campaignsOk =");
    expect(content).toContain("useIsAdminUser");
    expect(content).toContain('id: "campaigns"');
    expect(content).toContain('href: `${basePath}/campaigns`');
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

  it("should have brand back link point to the org overview, labelled by org name", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('backLabel={organization?.name || "Overview"}');
    expect(content).toContain('backHref={`/orgs/${orgId}`}');
  });

  it("should have unified Keys entry at org level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Keys"');
    expect(content).toContain('`/orgs/${orgId}/api-keys`');
  });

  it("keeps the Workflows route (flat footer link in the brand sidebar, staff-only alpha)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"Workflows"');
    expect(content).toContain('`${basePath}/workflows`');
    expect(content).toContain('FEATURE_GATES["workflows"]');
  });

  it("keeps Brand Profile as a flat footer link in the brand sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('label: "Brand Profile"');
    expect(content).toContain('`${basePath}/brand-profile`');
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});
