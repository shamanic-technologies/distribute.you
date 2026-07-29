import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Breadcrumb hierarchy", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");
  // Org/brand identity + switching were extracted to `use-tenant-switcher` so the
  // pre-beta breadcrumb and the beta sidebar switcher share ONE implementation.
  // The identity guards follow the code to its new home.
  const switcherPath = path.join(__dirname, "../src/lib/use-tenant-switcher.ts");

  it("should show org as root breadcrumb with the PER-TAB URL org name", () => {
    // Display the URL org (per-tab, stable), cached off useOrganization when it
    // matches — NOT the raw shared active org, which flips cross-tab (#1948).
    const content = fs.readFileSync(switcherPath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("displayOrgName");
    expect(content).toContain("orgDisplayCacheRef");
    // The breadcrumb renders that resolved name (it no longer resolves it itself).
    expect(fs.readFileSync(breadcrumbPath, "utf-8")).toContain("displayOrgName");
  });

  it("should NOT use useOrg context (org is always root via Clerk)", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).not.toContain("@/lib/org-context");
    expect(content).not.toMatch(/\buseOrg\b(?!anization)/);
  });

  it("should have New organization option in org dropdown", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("New organization");
    expect(content).toContain("/onboarding");
  });

  it("should parse org/brand from path structure", () => {
    // Path parsing moved into the shared hook with the rest of the identity logic.
    const content =
      fs.readFileSync(switcherPath, "utf-8") + fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain('"orgs"');
    expect(content).toContain('"brands"');
    // The app-level feature switcher (`"features"` path) stays removed (#1768).
    // The `"channels"` section IS parsed for the channel-level crumb
    // (v2 staff preview, #2762) — `.../channels/[id]` shows Channels › <name>.
    expect(content).toContain('"channels"');
    expect(content).not.toContain('"features"');
  });

  it("should use /orgs/ path prefix for brand links", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("/orgs/${orgId}/brands/");
  });

  it("should use features instead of workflows in paths", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("");
    expect(content).not.toContain('href={`/brands/');
  });
});
