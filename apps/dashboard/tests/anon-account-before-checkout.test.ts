import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * A SIGNED-OUT visitor may not be walked into the checkout, and a signed-in one
 * must be able to find its org.
 *
 * The anonymous flow builds the whole setup before anyone has an account: there is
 * no Clerk org, and none is created — the session IS the org, re-pointed at the
 * Clerk org at signup. Two things followed from that and both dead-ended the flow
 * at the same screen:
 *
 *  1. `consent` walked straight to `pricing` -> `bonus`, the PAYMENT step, with no
 *     account in sight. `buildPendingLaunchBlob` requires an org id, so Continue
 *     threw "Checkout state is missing. Go back to pricing and try again." — and
 *     going back to pricing changes nothing, so it is a wall rather than a retry.
 *     The screen built for this (`built`, "Create your account to launch it") was
 *     UNREACHABLE: its only route in was the post-payment offer levers, which an
 *     anonymous visitor can never reach.
 *
 *  2. After signup, `/onboarding/claim` sends the visitor back with `?claimed=1`,
 *     which lands on `pricing`. The snapshot it restores was written while signed
 *     out, so its `orgId` is null, and the `?brandId=` resume effect that reads
 *     Clerk bails whenever a snapshot exists — the normal same-tab case. So the
 *     ref stayed null and the SAME throw fired on the second pass.
 *
 * Measured in production: 24 anonymous orgs, one of them a test probe, and ZERO
 * campaigns created in the two days the flow was live (15 in the two weeks before).
 *
 * Source-substring guards (the dashboard convention) — `onboarding.tsx` imports
 * through the `@` alias, which vitest does not resolve here, so it is not
 * runtime-importable.
 */
describe("The account comes before the checkout", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const onboardingPath = "src/components/onboarding/onboarding.tsx";

  /**
   * A slice bounded by the declaration that FOLLOWS it, so it moves with the file
   * instead of expiring on the next comment somebody adds (the measured-length
   * traps this repo keeps recording).
   */
  const between = (src: string, from: string, to: string): string => {
    const at = src.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf(to, at + from.length);
    expect(end).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  const RECOVERY_MARKER = "// A signed-in session recovers the org it belongs to from Clerk";

  it("the consent step asks for the offer, not the money, while signed out", () => {
    const body = between(
      read(onboardingPath),
      "function continueFromConsent()",
      "\n  }",
    );
    // The levers, then the recap that states them, then the account. The claim
    // lands back on `pricing`, so the budget is asked once — after the org exists.
    // It routed straight to `built` for one release, which recapped an offer the
    // visitor had never been asked about (see offer-levers-before-account).
    expect(body).toContain('setStep(user ? "pricing" : "offer")');
    expect(body).not.toContain('setStep(user ? "pricing" : "built")');
  });

  it("the consent step routes through that function, never straight to pricing", () => {
    const src = read(onboardingPath);
    const consentStep = between(src, 'if (step === "consent") {', "\n  if (step ===");
    expect(consentStep).toContain("continueFromConsent");
    // The unconditional walk into the money is what put a signed-out visitor in
    // front of the checkout.
    expect(consentStep).not.toContain('setStep("pricing")');
  });

  it("the account gate goes back to the screen before it", () => {
    const src = read(onboardingPath);
    const builtStep = between(src, 'if (step === "built") {', "\n  if (step ===");
    // It is reached from the LAST offer lever, so Back returns there — to the
    // screens this one recaps, at the one it came from.
    expect(builtStep).toContain('setStep("offer")');
    expect(builtStep).toContain("setOfferIndex(POST_PAYMENT_OFFER_LEVERS.length - 1)");
  });

  it("a signed-in session recovers its org from Clerk", () => {
    const effect = between(read(onboardingPath), RECOVERY_MARKER, "\n\n");
    expect(effect).toContain("orgIdRef.current = organization.id");
    expect(effect).toContain("[organization?.id]");
  });

  it("the recovery FILLS an empty ref and never overwrites a stated org", () => {
    const effect = between(read(onboardingPath), RECOVERY_MARKER, "\n\n");
    // `createBrandAndFetchServices` is authoritative: on `?new=1` it mints a fresh
    // org and writes it here, so a later Clerk read must not walk over it.
    expect(effect).toContain("if (orgIdRef.current || !organization?.id) return;");
  });

  it("the launch blob still refuses to build without an org", () => {
    const body = between(
      read(onboardingPath),
      "function buildPendingLaunchBlob()",
      "async function beginCheckoutAndLaunch()",
    );
    // Fail loud. A placeholder org id would file the campaign, the money and the
    // post-launch redirect under an org that is not the customer's.
    expect(body).toContain("!orgId");
    expect(body).toContain(
      'throw new Error("Checkout state is missing. Go back to pricing and try again.")',
    );
    // Never invented, never defaulted.
    expect(body).not.toContain('orgId ?? "');
    expect(body).not.toContain('orgId || "');
  });
});
