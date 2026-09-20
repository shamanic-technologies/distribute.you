import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * THE OFFER IS ASKED BEFORE IT IS RECAPPED, AND IT IS ASKED ONCE.
 *
 * #4319 moved the signup wall so a signed-out visitor meets the ACCOUNT rather
 * than the checkout, and it did that by routing `consent` straight to `built` —
 * the recap. That skipped the six offer-lever screens the recap STATES, so the
 * page listed six Hormozi levers the visitor had never been shown. Reported
 * verbatim: *"je vois la page de recap qui contient les infos Hermozi alors que
 * tu ne m'as pas posé la question du tout"*.
 *
 * The order the existing code already expected is `consent` -> the six levers ->
 * the recap -> the account: `continueOffer` has carried a signed-out branch into
 * `built` since #4319. What was missing was the route IN.
 *
 * The second half is the one nothing reported yet, because nobody had reached
 * it: the post-payment sequence ends `model` -> `offer` -> launch, so a visitor
 * who answered the levers before the account would be asked the same six
 * questions again after paying, prefilled with their own answers and with
 * nothing saying why. A surface that asks one question twice is the same
 * self-contradiction as a recap that states an answer nobody gave, so the flag
 * travels with the flow and the post-payment walk skips the levers it already
 * has.
 *
 * Source-substring guards (the dashboard convention) — `onboarding.tsx` imports
 * through the `@` alias, which vitest does not resolve here, so it is not
 * runtime-importable.
 */
describe("The offer levers are asked before the recap, and asked once", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const onboardingPath = "src/components/onboarding/onboarding.tsx";

  /**
   * A slice bounded by the declaration that FOLLOWS it, so it moves with the file
   * instead of expiring on the next comment somebody adds. The `to` anchor is a
   * blank line rather than a comment delimiter wherever the block being sliced is
   * itself comment-led (a `"\n  // "` bound ends on line 2 of its own doc comment).
   */
  const between = (src: string, from: string, to: string): string => {
    const at = src.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf(to, at + from.length);
    expect(end).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  const SKIP_MARKER = "leversStatedBeforeAccount";

  it("consent walks a signed-out visitor into the levers, not the recap", () => {
    const body = between(
      read(onboardingPath),
      "function continueFromConsent()",
      "\n  }",
    );
    // The levers are what the recap recaps, so they come first.
    expect(body).toContain('setStep(user ? "pricing" : "offer")');
    // Reached from consent, the walk starts at the first lever — never wherever a
    // previous pass through this step happened to leave the index.
    expect(body).toContain("setOfferIndex(0)");
    // #4319's route, which is what skipped them.
    expect(body).not.toContain('setStep(user ? "pricing" : "built")');
  });

  it("the first lever's Back returns to consent while signed out", () => {
    const src = read(onboardingPath);
    const offerStep = between(src, 'if (step === "offer") {', "\n  // WHAT WE BUILT");
    // `model` is a POST-PAYMENT step: an anonymous visitor has never seen it, so
    // going back there from the first lever is a screen out of nowhere.
    expect(offerStep).toContain('setStep(user ? "model" : "consent")');
  });

  it("the last lever does not promise a launch to somebody with no account", () => {
    const src = read(onboardingPath);
    const offerStep = between(src, 'if (step === "offer") {', "\n  // WHAT WE BUILT");
    // Nothing launches here while signed out — the recap and the account come next.
    expect(offerStep).toContain("See what we built");
    expect(offerStep).toContain("Launch my campaign");
  });

  it("the recap goes back to the levers it recaps", () => {
    const src = read(onboardingPath);
    const builtStep = between(src, 'if (step === "built") {', "\n  if (step ===");
    expect(builtStep).toContain('setStep("offer")');
    // #4319's Back, correct while the recap followed consent directly.
    expect(builtStep).not.toContain('<BackButton onClick={() => setStep("consent")} />');
  });

  it("the post-payment walk skips the levers when they were already stated", () => {
    const src = read(onboardingPath);
    const modelStep = between(src, 'if (step === "model") {', "\n  if (step ===");
    // Asked once. A visitor who answered the six screens before creating the
    // account is not asked them again after paying.
    expect(modelStep).toContain(SKIP_MARKER);
    // The signed-in path (an existing org adding a brand) is untouched: it never
    // saw the levers, so it still walks them.
    expect(modelStep).toContain('setStep("offer")');
  });

  it("the flag is stated when the levers are answered before the account", () => {
    const body = between(read(onboardingPath), "function continueOffer()", "\n  }\n");
    expect(body).toContain(`set${SKIP_MARKER[0].toUpperCase()}${SKIP_MARKER.slice(1)}(true)`);
  });

  it("the flag is OPTIONAL on the snapshot, so no version bump strands a checkout", () => {
    const src = read(onboardingPath);
    // Same shape as startOutcomes / startFunnels: an older snapshot carries none
    // and reads false, which is exactly the pre-change walk.
    expect(src).toContain(`${SKIP_MARKER}?: boolean;`);
    expect(src).toContain(
      `!(p.${SKIP_MARKER} === undefined || typeof p.${SKIP_MARKER} === "boolean")`,
    );
    expect(src).toContain("const ONBOARDING_STATE_VERSION = 8;");
  });

  it("the flag rides the pending blob too, because the Stripe return is a fresh page", () => {
    const src = read(onboardingPath);
    const blob = between(src, "type PendingCheckoutLaunch = {", "\n};");
    // The post-payment steps run on a FRESH page load, so a value only React
    // state holds is gone by the time `model` needs it.
    expect(blob).toContain(`${SKIP_MARKER}?: boolean;`);
    const resume = between(src, "async function resumeCheckoutLaunch()", "\n  }\n");
    expect(resume).toContain(SKIP_MARKER);
  });
});
