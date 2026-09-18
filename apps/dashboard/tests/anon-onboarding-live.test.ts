import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The FOUR lines that make the signed-out flow reachable.
 *
 * Everything else about this feature is bounded and tested on its own; these
 * are the ones that decide whether any of it runs at all, and each was a single
 * edit. Pinned together because they only make sense together: three of the
 * four with the fourth reverted is a funnel that dead-ends.
 */

describe("the signed-out build half is reachable", () => {
  it("/start sends a visitor to the wizard, not to signup", () => {
    const src = strip(read("src/components/start/start-flow.tsx"));
    expect(src).toContain('window.location.href = "/onboarding"');
    expect(src).not.toContain('window.location.href = "/sign-up"');
  });

  it("the wizard is public — EXACTLY, so pay and build stay behind the gate", () => {
    const src = strip(read("src/proxy.ts"));
    // Bounded to the PUBLIC matcher: `"/onboarding(.*)"` legitimately appears
    // further down in `isOnboardingRoute`, which exempts the flow from the
    // first-run gate and is a different question entirely. An unbounded check
    // fails on that one.
    const from = src.indexOf("const isPublicRoute");
    const publicBlock = src.slice(from, src.indexOf("]);", from));
    expect(from).toBeGreaterThan(-1);
    expect(publicBlock).toContain('"/onboarding",');
    // A `(.*)` HERE would open `/onboarding/pay` and `/onboarding/build`, which
    // genuinely need the account to exist.
    expect(publicBlock).not.toContain('"/onboarding(.*)"');
    expect(publicBlock).toContain('"/api/anon(.*)"');
  });

  it("signup lands on the claim when there is a session to claim", () => {
    const src = strip(read("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"));
    // Both paths: the emailed code and the Google round-trip.
    expect((src.match(/\/onboarding\/claim/g) ?? []).length).toBe(2);
    expect((src.match(/browserHasAnonSession/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the claim returns to the wizard AT THE MONEY, carrying the brand", () => {
    const src = strip(read("src/app/(authed)/onboarding/claim/page.tsx"));
    expect(src).toContain("claimed=1");
    expect(src).toContain("brandId=");
    // Not the old pay screen: the wizard's own budget step is the charging basis.
    expect(src).not.toContain("/onboarding/pay");
  });

  it("a claimed return lands on the budget step, not back on the summary", () => {
    const src = strip(read("src/components/onboarding/onboarding.tsx"));
    // Resuming at `built` would ask them to create an account they now have.
    expect(src).toMatch(/claimed"\)\s*===\s*"1"\s*\?\s*"pricing"/);
  });
});

describe("what must NOT come back", () => {
  it("the offer step still terminates at the launch for a signed-IN user", () => {
    // An existing org adding a brand, or a session that already paid, must not
    // be routed into the summary-then-signup path.
    const src = strip(read("src/components/onboarding/onboarding.tsx"));
    expect(src).toContain("void finalizePostPaymentAndLaunch();");
    expect(src).toMatch(/if \(!user\) \{\s*setStep\("built"\);/);
  });
});
