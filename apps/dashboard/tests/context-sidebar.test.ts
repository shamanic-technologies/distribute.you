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
    // The OFFER level sits between the brand and its campaigns — a brand is an
    // identity, an offer is a proposition, and campaigns sell one of those.
    expect(content).toContain('"offer"');
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
    // NOTE: a "Campaigns" entry (`${basePath}/campaigns`, `campaignsOk`) carries the
    // campaign-centered v2 surface — see the dedicated guard below; the general
    // no-legacy assertions here exclude it.
    expect(content).toContain('label: "Overview"');
    expect(content).not.toContain('>Database<');
    expect(content).not.toContain('label: "Create Campaign"');
    expect(content).not.toContain('href: `${basePath}/conversions`');
  });

  it("names no campaign at the OFFER level: an offer sells through funnels", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // A campaign buys one LEG of a funnel, so it has a cost per step and no return.
    // The offer Overview lists the funnels; a funnel's own page lists its campaigns.
    expect(content).not.toContain("useIsAdminUser");
    const offerSidebar = content.slice(content.indexOf("function OfferLevelSidebar("));
    expect(offerSidebar.slice(0, 2000)).not.toContain('id: "campaigns"');
  });

  it("keeps Brand Settings OUT of the campaign sidebar (it is a brand-level surface)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    const campaignSidebar = content.slice(
      content.indexOf("function CampaignLevelSidebar"),
      content.indexOf("export function ContextSidebar"),
    );
    expect(campaignSidebar).not.toContain('label: "Brand Settings"');
    // The brand sidebar still owns it — this is a placement fix, not a removal.
    expect(content).toContain('label: "Brand Settings"');
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

  it("should give NO sidebar level a back link at its top", () => {
    // The tenant switcher at the top of every sidebar already names where you
    // are and lets you move anywhere, so a "< Brand" / "< Campaigns" /
    // "< Back to dashboard" row above it is a second, competing way up. The
    // whole affordance is gone from every level: the props, the component, and
    // the org settings sidebar's hand-rolled copy.
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain("backHref");
    expect(content).not.toContain("backLabel");
    expect(content).not.toContain("function BackLink");
    expect(content).not.toContain("Back to dashboard");
    const brandSidebar = content.slice(
      content.indexOf("function BrandLevelSidebar"),
      content.indexOf("function CampaignLevelSidebar"),
    );
    expect(brandSidebar).toContain("topSlot={<TenantSwitcher />}");
  });

  it("should have the API Key entry at org level", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('"API Key"');
    expect(content).toContain('`/orgs/${orgId}/api-keys`');
  });

  it("drops the Workflows entry — it was alpha-gated, so it rendered for nobody", () => {
    // `useFeatureFlag` returns false unconditionally in the dashboard, so this entry
    // was invisible to everyone and its page URL-reachable only. Workflows lives in
    // `apps/admin`, where the gate resolves; the dashboard copy is deleted.
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('"Workflows"');
    expect(content).not.toContain('`${basePath}/workflows`');
  });

  it("no longer renders a Brand Profile footer link (page removed)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain('label: "Brand Profile"');
    expect(content).not.toContain("/brand-profile`");
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});
