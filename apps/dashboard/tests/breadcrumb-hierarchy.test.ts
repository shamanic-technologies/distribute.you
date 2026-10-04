import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The org/brand identity behind the sidebar switcher lives in `use-tenant-switcher`
// (the v1 breadcrumb that also rendered it is gone with the v1 onboarding).
describe("Tenant switcher hierarchy", () => {
  const switcherPath = path.join(__dirname, "../src/lib/use-tenant-switcher.ts");

  it("should show the PER-TAB URL org name", () => {
    // Display the URL org (per-tab, stable), cached off useOrganization when it
    // matches — NOT the raw shared active org, which flips cross-tab (#1948).
    const content = fs.readFileSync(switcherPath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("displayOrgName");
    // Snapshotted into a persisted query (was an in-memory ref) so the name paints
    // from disk before Clerk hydrates — see tenant-switcher-swr.test.ts.
    expect(content).toContain('queryKey: ["orgIdentity", orgId]');
  });

  it("should parse org/brand from path structure", () => {
    const content = fs.readFileSync(switcherPath, "utf-8");
    expect(content).toContain('pathParts[0] === "orgs"');
    expect(content).toContain("brandIdFromPathname(pathname)");
    // The app-level feature switcher (`"features"` path) stays removed (#1768).
    expect(content).not.toContain('"features"');
  });
});
