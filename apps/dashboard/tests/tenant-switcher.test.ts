import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The tenant switch (org / brand / offer identity + god-mode join) lives in ONE
 * hook, `lib/use-tenant-switcher.ts`, and every surface that switches tenants reads
 * it.
 *
 * Source-substring guards (the dashboard convention — these modules import through
 * the `@` alias, which vitest does not resolve in this repo).
 */
describe("Tenant switcher", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const hook = read("src/lib/use-tenant-switcher.ts");

  it("breadcrumb-nav survives for the onboarding chrome", () => {
    // `onboarding-top-chrome` renders it (guarded by onboarding-escape-chrome.test.ts).
    expect(read("src/components/onboarding/onboarding-top-chrome.tsx")).toContain(
      "BreadcrumbNav",
    );
  });

  it("tenant surfaces share ONE switch implementation", () => {
    expect(hook).toContain("export function useTenantSwitcher");
    expect(read("src/components/breadcrumb-nav.tsx")).toContain("useTenantSwitcher()");
    // God-mode (staff all-orgs list + join-then-setActive) lives in the hook.
    expect(hook).toContain("isAdminEmail");
    expect(hook).toContain("/api/admin/orgs/${clerkOrgId}/join");
  });

  it("never asserts an offer name it does not have", () => {
    expect(hook).toContain("const offerKnown = !!displayOffer");
  });
});
