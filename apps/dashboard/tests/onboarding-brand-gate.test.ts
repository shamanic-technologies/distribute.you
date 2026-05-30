import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * DIS-91: the onboarding flow was unreachable because the redirect gate keyed on
 * `!hasOrg`, but a Clerk org is auto-created at signup → the gate never fired.
 *
 * New gate keys on the real first-run signal: an active org with ZERO brands.
 * Both entry parcours converge on it:
 *   - fresh signup    → Clerk auto-creates an org → 0 brands → /onboarding
 *   - "New organization" dropdown → /onboarding?new=1 → onboarding creates a new org → 0 brands
 *
 * Onboarding reuses the active org when present (skip createOrganization), unless
 * `?new=1` forces a brand-new org (so a populated org can spawn a sibling).
 */

const dashboardLayout = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx"),
  "utf-8"
);
const onboardingPage = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/onboarding/page.tsx"),
  "utf-8"
);
const breadcrumbNav = fs.readFileSync(
  path.join(__dirname, "../src/components/breadcrumb-nav.tsx"),
  "utf-8"
);

describe("DIS-91 gate keys on brand count, not org existence", () => {
  it("dashboard layout queries brands for the active org", () => {
    expect(dashboardLayout).toContain("listBrands");
    expect(dashboardLayout).toMatch(/\[\s*"brands"\s*\]/);
  });

  it("redirects to /onboarding when the active org has zero brands", () => {
    expect(dashboardLayout).toContain('router.push("/onboarding")');
    // the decision references a brand count of zero
    expect(dashboardLayout).toMatch(/brands.*length.*===\s*0|length\s*===\s*0/);
  });

  it("does not redirect while a brand auto-create is in flight", () => {
    // the brands page receives ?autoCreate=<url>; the gate must not bounce mid-create
    expect(dashboardLayout).toContain("autoCreate");
  });

  it("still guards against redirect loops on API error (isError retry UI kept)", () => {
    expect(dashboardLayout).toContain("isError");
    expect(dashboardLayout).toContain("window.location.reload()");
  });

  it("only queries brands once an org is active (enabled gate)", () => {
    expect(dashboardLayout).toMatch(/enabled:\s*hasOrg/);
  });
});

describe("DIS-91 onboarding reuses the active org", () => {
  it("reads the active org via useOrganization", () => {
    expect(onboardingPage).toContain("useOrganization");
  });

  it("reads the ?new force-new signal", () => {
    expect(onboardingPage).toContain("useSearchParams");
    expect(onboardingPage).toContain('searchParams.get("new")');
  });

  it("still creates an org via Clerk when forced or no active org", () => {
    expect(onboardingPage).toContain("createOrganization");
    expect(onboardingPage).toContain("setActive");
  });

  it("redirects to the brands page with autoCreate after setup", () => {
    expect(onboardingPage).toContain("/brands?autoCreate=");
    expect(onboardingPage).toContain("encodeURIComponent");
  });
});

describe("DIS-91 dropdown 'New organization' forces a brand-new org", () => {
  it("navigates to /onboarding?new=1 so a populated org spawns a sibling", () => {
    expect(breadcrumbNav).toContain("/onboarding?new=1");
  });
});
