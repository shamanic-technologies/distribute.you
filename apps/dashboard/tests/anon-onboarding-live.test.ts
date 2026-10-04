import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The lines that make the signed-out flow reachable.
 *
 * Everything else about this feature is bounded and tested on its own; these
 * are the ones that decide whether any of it runs at all, and each was a single
 * edit. Pinned together because they only make sense together: one reverted is
 * a funnel that dead-ends.
 */

describe("the signed-out build half is reachable", () => {
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

  it("the claim hands over to v2, which resumes the brand at the plan step", () => {
    const src = strip(read("src/app/(authed)/onboarding/claim/page.tsx"));
    // The v1 wizard is gone: the org page resumes the claimed brand in the v2
    // setup modal, which ends on "Choose your plan".
    expect(src).toContain('router.replace("/v2")');
    expect(src).not.toContain("/onboarding?claimed=1");
    expect(src).not.toContain("/onboarding/pay");
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
