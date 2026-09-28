import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The public onboarding is the critical path: every screen must paint at once.
 * Three waits were measured in prod (2026-09-28) and each is removed here:
 *   - the site read (~13 s) now starts on the first click, while the visitor
 *     reads the intro, instead of on "See what we'd build";
 *   - the claimed return (~8 s) no longer replays the loading screen;
 *   - the Stripe session (~2-15 s) is created while the $30 screen is on show.
 */
const SRC = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

describe("onboarding paints every screen at once", () => {
  it("starts the build on the visitor's first click, never on mount", () => {
    expect(SRC).toContain('if (step === "welcome" && next === "outcome") startPrebuild();');
    const fn = SRC.slice(SRC.indexOf("function startPrebuild()"), SRC.indexOf("async function finishPrebuild("));
    // Signed-out with a website only; a visitor with no website is asked at the URL step.
    expect(fn).toContain("if (user || noWebsiteMode || prebuildRef.current || brandIdRef.current) return;");
    expect(fn).toContain("createBrandAndFetchServices({ background: true })");
  });

  it("holds a refusal met in the background until the visitor reaches the build", () => {
    expect(SRC).toContain("if (!outcome.started && opts?.background) {");
    const fin = SRC.slice(SRC.indexOf("async function finishPrebuild("), SRC.indexOf("function continueAfterPicks()"));
    expect(fin).toContain("prebuildRefusalRef.current");
    // No loading screen when the build already finished.
    expect(fin).toContain('if (!fetchDoneRef.current) setStep("loading");');
    const cont = SRC.slice(SRC.indexOf("function continueAfterPicks()"), SRC.indexOf("async function startAnalyze()"));
    expect(cont.indexOf("finishPrebuild(")).toBeLessThan(cont.indexOf("startAnalyze()"));
  });

  it("lands a claimed return straight on the budget, without replaying the build", () => {
    const at = SRC.indexOf('if (resumeTargetRef.current === "pricing" && searchParams.get("claimed") === "1"');
    expect(at).toBeGreaterThan(-1);
    const block = SRC.slice(at, SRC.indexOf("void runResume(resumeTargetRef.current);", at));
    expect(block).toContain('setStep("pricing");');
    expect(block).toContain("hydrateOnboardingInBackground(restored.brandId)");
    expect(block).not.toContain("createBrandAndFetchServices");
  });

  it("prepares the Stripe session while the $30 screen is on show, keyed on what it charges", () => {
    expect(SRC).toContain('if (step !== "bonus") return;');
    expect(SRC).toContain("preparedCheckoutRef.current = { key, url };");
    const click = SRC.slice(SRC.indexOf("async function beginCheckoutAndLaunch()"), SRC.indexOf("async function resumeCheckoutLaunch()"));
    expect(click).toContain("prepared.key === checkoutKey(pending)");
    // The projection the session needs is loaded one screen earlier.
    expect(SRC).toContain('if (step !== "pricing") return;\n    ensureProjectionLoaded()');
  });
});
