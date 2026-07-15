import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Per-brand onboarding-completeness gate. The edge gate (proxy.ts, DIS-111) is
 * ORG-scoped, so a brand created via "Add brand" but abandoned before the terminal
 * launch (no campaign) is still reachable on an already-onboarded org. `BrandSetupGate`
 * closes that hole client-side (the edge can't fetch per-brand) and bounces the brand
 * back to resume onboarding via `?brandId=`.
 */
const gate = fs.readFileSync(
  path.join(__dirname, "../src/components/brand/brand-setup-gate.tsx"),
  "utf-8",
);
const brandLayout = fs.readFileSync(
  path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/layout.tsx",
  ),
  "utf-8",
);
const onboarding = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);

describe("BrandSetupGate — per-brand completeness redirect", () => {
  it("keys 'incomplete' on ZERO campaigns via the existing reader", () => {
    expect(gate).toContain("listCampaignsByBrand");
    expect(gate).toContain(".campaigns.length ?? 0) === 0");
  });

  it("redirects a never-finished brand back to resume onboarding", () => {
    expect(gate).toContain("/onboarding?from=add&brandId=");
    expect(gate).toContain("router.replace");
  });

  it("is fail-soft — redirects only once the query SETTLES empty (not isPending / isError)", () => {
    expect(gate).toContain("!isPending && !isError");
  });

  it("is mounted in the brand layout, which stays a passthrough (no fetch/cookies/headers)", () => {
    expect(brandLayout).toContain("<BrandSetupGate />");
    expect(brandLayout).not.toContain("cookies(");
    expect(brandLayout).not.toContain("headers(");
  });
});

describe("Onboarding — cross-session brand resume via ?brandId=", () => {
  it("reads the brandId param and re-hydrates the brand from backend", () => {
    expect(onboarding).toContain('searchParams.get("brandId")');
    expect(onboarding).toContain("getBrand(resumeBrandIdParam)");
    expect(onboarding).toContain('runResume("objective", seededUrl)');
  });

  it("only uses the param path when there is no snapshot / checkout return to restore", () => {
    expect(onboarding).toContain(
      "if (!resumeBrandIdParam || restored || searchParams.get(\"launch_checkout\")) return;",
    );
  });
});
