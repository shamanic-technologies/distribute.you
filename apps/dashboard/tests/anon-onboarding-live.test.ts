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
  it("the sell-first screens continue the wizard in place, never to signup", () => {
    // They ARE the wizard's first steps now: the last CTA hands over to the
    // wizard's own handler, no navigation, no cookie join, no reload.
    const src = strip(read("src/components/start/start-picks.tsx"));
    expect(src).toContain("<StartButton onClick={onContinue}>");
    expect(src).not.toContain("window.location.href");
    const wizard = strip(read("src/components/onboarding/onboarding.tsx"));
    const at = wizard.indexOf("function continueAfterPicks()");
    expect(at).toBeGreaterThan(-1);
    const handler = wizard.slice(at, at + 400);
    expect(handler).toContain('setStep("url")');
    expect(handler).toContain("void startAnalyze()");
    expect(handler).not.toContain("sign-up");
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
    // The signed-out branch now also STATES that the levers were answered, so the
    // post-payment walk does not ask the same six screens again after the card.
    expect(src).toMatch(
      /if \(!user\) \{\s*setLeversStatedBeforeAccount\(true\);\s*setStep\("built"\);/,
    );
  });
});

describe("both cookies actually reach the browser", () => {
  const strip2 = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("the session and claim routes use cookies.set, NEVER two Set-Cookie appends", () => {
    // Two `headers.append("Set-Cookie", ...)` on one response are joined into a
    // SINGLE header by a comma and the browser keeps only one — in practice the
    // last, so the readable flag survives and the signed token is dropped. The
    // route still answers 200, the api client still routes to the anonymous
    // proxy, and the very next call is a 401 with no session to read.
    //
    // Found in production on the first browser pass, not by any test.
    for (const f of [
      "src/app/api/anon/session/route.ts",
      "src/app/api/anon/claim/route.ts",
    ]) {
      const src = strip2(read(f));
      expect(src, f).not.toMatch(/headers\.append\(\s*"Set-Cookie"/);
      expect(src, f).toContain("res.cookies.set(");
    }
  });

  it("the token is httpOnly and the flag is not", () => {
    const src = strip2(read("src/app/api/anon/session/route.ts"));
    expect(src).toMatch(/ANON_SESSION_COOKIE[\s\S]{0,80}httpOnly: true/);
    // The flag must stay readable: the api client reads it off document.cookie
    // to decide which proxy carries the call.
    expect(src).toMatch(/ANON_FLAG_COOKIE, "1", opts\)/);
  });
});
