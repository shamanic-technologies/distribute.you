import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * THE RECAP'S BUTTON ASKS FOR AN ACCOUNT, SO IT HAS TO CHECK WHETHER THERE IS ONE.
 *
 * `built` is the screen a signed-OUT visitor reaches after the offer levers: it
 * recaps what we assembled and asks for the account that pays for it. Its CTA was
 * an unconditional `window.location.href = "/sign-up"`, which is correct for the
 * visitor it was written for and a CLOSED LOOP for anybody who already has an
 * account:
 *
 *   /sign-up  ->  proxy.ts redirects an authenticated user off every auth page
 *             ->  /orgs  ->  the first-run gate sees onboardingComplete !== true
 *             ->  /onboarding?brandId=<the cookie>  ->  the snapshot restores
 *             ->  `built` again, unchanged.
 *
 * Three redirects, no error, no network failure, and the same screen. The button
 * reads as dead and there is no way forward for as long as the tab lives.
 *
 * It is reachable: `continueOffer` only routes a signed-out visitor here, but the
 * snapshot is sessionStorage, so a tab left open across a signup comes back to
 * `built` with a session attached. Measured in production 2026-09-21 (brand
 * `fbe7898b`, callaireena.com): the org had been claimed the previous day — the
 * setup was already theirs — and the only control on screen could not move.
 *
 * Signed in there is no account to create, so the next thing is the money, which
 * is where `continueFromConsent` already sends a signed-in visitor. Same
 * destination, stated once per screen.
 *
 * Source-substring guards (the dashboard convention) — `onboarding.tsx` imports
 * through the `@` alias, which vitest does not resolve here, so it is not
 * runtime-importable.
 */
describe("The recap's account button knows whether there is an account", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const onboardingPath = "src/components/onboarding/onboarding.tsx";

  /**
   * Bounded by the declaration that FOLLOWS it, so the slice moves with the file
   * rather than expiring on the next comment somebody adds.
   */
  const between = (src: string, from: string, to: string): string => {
    const at = src.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf(to, at + from.length);
    expect(end).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  const builtStep = () =>
    between(read(onboardingPath), 'if (step === "built") {', "\n  if (step ===");

  it("a signed-in visitor is sent to the money, never to sign-up", () => {
    const body = builtStep();
    // The same destination `continueFromConsent` gives a signed-in visitor: the
    // account already exists, so the next unanswered question is the budget.
    expect(body).toContain('setStep("pricing")');
  });

  it("the signed-out visitor still goes to sign-up", () => {
    // The screen's whole reason to exist. Branching must not remove it.
    expect(builtStep()).toContain('window.location.href = "/sign-up"');
  });

  it("the account check PRECEDES the redirect", () => {
    const body = builtStep();
    const branch = body.indexOf("if (user)");
    const redirect = body.indexOf('window.location.href = "/sign-up"');
    expect(branch).toBeGreaterThan(-1);
    // An index compare, not a `toContain`: the ordering IS the fix. A redirect
    // that runs before the check is the loop this guard exists to stop.
    expect(branch).toBeLessThan(redirect);
  });

  it("the label states what the button will actually do", () => {
    const body = builtStep();
    // A signed-in visitor pressing "Create my account" is told the page will do
    // something it will not, so the label reads the same state the click does.
    expect(body).toContain('label={user ? "Continue" : "Create my account"}');
  });

  it("the unconditional redirect is gone", () => {
    const body = builtStep();
    // The shipped shape: `onClick={() => {` immediately followed by the redirect,
    // with nothing between it and the brace, is what looped.
    expect(body).not.toMatch(
      /onClick=\{\(\) => \{\s*(\/\/[^\n]*\n\s*)*window\.location\.href = "\/sign-up";/,
    );
  });
});
