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

  it("should have focused app-level public analytics links instead of feature links", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("Unique visitors");
    expect(content).toContain("Signups");
    expect(content).toContain("Paid users");
    expect(content).toContain("Revenue");
    expect(content).toContain("/metrics?view=landing");
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

  it("should NOT have a Tools section in brand sidebar (outlets and journalists moved to campaign modules)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).not.toContain("/tools/outlets");
    expect(content).not.toContain("/tools/journalists");
    expect(content).not.toContain("/tools/press-kits");
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

  it("wires the featureSettings nav level to the EXISTING /settings + /workflows routes (not an orphan)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // Feature Settings sub-level: GA landing (/settings, Sales Economics) +
    // staff-only Workflows. Both are real routes (no removed/404 route, unlike
    // the prior dead `/settings` link this guard originally protected against).
    expect(content).toContain("featureSettings");
    expect(content).toContain("FeatureSettingsLevelSidebar");
    expect(content).toContain('case "featureSettings"');
    expect(content).toContain('`${basePath}/settings`');
    expect(content).toContain('`${basePath}/workflows`');
  });

  it("the Feature Settings entry is GA (no flag); only Workflows under it is alpha", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // Not the old dead `id:"settings" label:"Settings"` pattern…
    expect(content).not.toContain('id: "settings", label: "Settings"');
    // …it's the GA Feature Settings entry pointing at the real /settings landing.
    expect(content).toContain('label: "Feature Settings"');
    // Workflows (not Feature Settings) is what stays alpha-gated.
    expect(content).toContain('FEATURE_GATES["workflows"]');
    expect(content).not.toContain('FEATURE_GATES["feature-settings"]');
  });

  it("keeps the feature-level Workflows route (under Feature Settings, staff-only)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain('`${basePath}/workflows`');
  });
});

describe("Old sidebar removed", () => {
  it("should not have the old sidebar.tsx file", () => {
    const oldSidebar = path.join(__dirname, "../src/components/sidebar.tsx");
    expect(fs.existsSync(oldSidebar)).toBe(false);
  });
});

describe("sidebar badge counts do not re-download their lists", () => {
  /**
   * Each badge read pulls a whole brand list to call `.length` on it, because
   * no served count exists. Fourteen of them polled every 30 seconds for the
   * lifetime of the tab; on a brand with 12,000+ outlets that is megabytes per
   * tick, retained in the query cache and written to IndexedDB. That is the
   * renderer memory growth, and it is why they now fetch once per navigation.
   */
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/context-sidebar.tsx"),
    "utf8"
  );

  it("has no 30-second poll left in the sidebar", () => {
    expect(src).not.toContain("refetchInterval: 30_000");
  });

  it("routes every badge read through the one shared options object", () => {
    expect(src).toContain("const SIDEBAR_BADGE_QUERY");
    // 15 call sites plus the definition.
    expect(src.match(/SIDEBAR_BADGE_QUERY/g) ?? []).toHaveLength(16);
  });

  it("turns the poll off rather than merely slowing it", () => {
    expect(src).toContain("refetchInterval: false as const");
  });

  it("does not re-fetch the whole list on every window focus either", () => {
    expect(src).toContain("refetchOnWindowFocus: false");
    expect(src).toContain("refetchOnReconnect: false");
  });
});

describe("every top-level page commits navigation instantly", () => {
  /**
   * Next 16 does not prefetch a dynamic route, and every admin route is dynamic
   * (Clerk `auth()`). Without a `loading.tsx` the router BLOCKS on the page you
   * are leaving until the new one's server render returns, so a sidebar click
   * does nothing at all: no paint, no route change, the old page still under the
   * cursor. A boundary makes the route commit at once and load in place.
   *
   * The boundary must sit BELOW `(dashboard)` — one at that segment would blank
   * the sidebar and header on every navigation.
   */
  const root = path.join(__dirname, "../src/app/(authed)/(dashboard)");

  const TOP_LEVEL_PAGES = [
    "investors",
    "investors/deck",
    "investors/update",
    "metrics",
    "customer-success",
    "orgs",
    "feature-stats",
    "audit/accounts",
    "audit/instantly",
  ];

  it.each(TOP_LEVEL_PAGES)("%s has a loading boundary", (seg) => {
    expect(fs.existsSync(path.join(root, seg, "loading.tsx"))).toBe(true);
  });

  it("has no boundary at the (dashboard) segment itself, which would blank the chrome", () => {
    expect(fs.existsSync(path.join(root, "loading.tsx"))).toBe(false);
  });

  it("does not await a slow server fan-out in the deck page body", () => {
    const src = fs.readFileSync(path.join(root, "investors/deck/page.tsx"), "utf8");
    // The fetch lives inside a Suspense child, not the default export.
    expect(src).toContain("<Suspense");
    expect(src).not.toMatch(/export default async function/);
  });
});
