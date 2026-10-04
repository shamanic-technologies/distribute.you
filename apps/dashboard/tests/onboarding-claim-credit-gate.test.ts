import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The claim is the one route that may not be preceded by an authenticated read.
 *
 * `/onboarding/claim` re-points the anonymous org at the identity the person
 * just signed up with. Any `/api/v1` call made before it resolves (org, user)
 * at the gateway, which brings a client-service org into being on that same
 * identity — so the claim then finds the identity held and refuses
 * `external_id_taken`, deterministically, forever. Retrying cannot help: it
 * collides with a row our own read created.
 *
 * The v1 `OnboardingCreditGate` was that read (production 2026-09-20: 28
 * anonymous orgs, exactly one claim). The gate and the onboarding layout that
 * mounted it are deleted; these guards keep any replacement layout from
 * re-introducing a read above the claim, and keep the claim page itself clean.
 */
const root = path.join(__dirname, "..", "src");
const layoutPath = path.join(root, "app/(authed)/onboarding/layout.tsx");
const claimPath = path.join(root, "app/(authed)/onboarding/claim/page.tsx");

describe("nothing reads the account above the claim", () => {
  it("no onboarding layout mounts a billing read or the old credit gate", () => {
    if (!fs.existsSync(layoutPath)) return;
    const layout = fs.readFileSync(layoutPath, "utf-8");
    expect(layout).not.toContain("OnboardingCreditGate");
    expect(layout).not.toContain("getBillingAccount");
  });
});

describe("the claim page", () => {
  const claim = fs.readFileSync(claimPath, "utf-8");

  it("makes no api call that would resolve the identity first", () => {
    expect(claim).not.toContain("@/lib/api");
    expect(claim).toContain('fetch("/api/anon/claim"');
  });

  it("lands on v2 after a successful claim (the v1 wizard is gone)", () => {
    expect(claim).toContain('router.replace("/v2")');
    expect(claim).not.toContain("/onboarding?claimed=1");
  });
});
