import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The beta onboarding wizard keeps all step + form state in memory. Without
 * persistence a refresh / back-navigation resets to the welcome screen and loses
 * everything the user typed/selected. These guards pin the sessionStorage snapshot
 * wiring that resumes the flow on the SAME step with inputs intact. (Behavioural
 * import isn't possible — the component pulls Clerk/posthog/api — so we assert the
 * load-bearing source, matching the repo's other onboarding guards.)
 */
describe("Beta onboarding resume persistence", () => {
  const filePath = path.join(__dirname, "../src/components/onboarding/onboarding.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  it("persists to a versioned sessionStorage snapshot key", () => {
    expect(src).toContain('ONBOARDING_STATE_KEY = "distribute:onboarding-beta-state"');
    expect(src).toContain("ONBOARDING_STATE_VERSION = 1");
    expect(src).toContain("window.sessionStorage.setItem(ONBOARDING_STATE_KEY");
  });

  it("reads + validates the snapshot before restoring (no throw on bad/SSR state)", () => {
    expect(src).toContain("function readOnboardingState()");
    expect(src).toContain('typeof window === "undefined"');
    // version + shape validation guards a stale/incompatible snapshot.
    expect(src).toContain("p.version !== ONBOARDING_STATE_VERSION");
  });

  it("seeds every restored field via lazy useState initializers (no restore flash)", () => {
    expect(src).toContain("restored?.url ??");
    expect(src).toContain("restored?.outcome ??");
    expect(src).toContain("restored?.rates ??");
    expect(src).toContain("restored?.services ??");
    expect(src).toContain("restored?.brandId ??");
    // edited-guards restored so a resume's re-extraction can't clobber user edits.
    expect(src).toContain("restored?.servicesEdited ??");
    expect(src).toContain("restored?.ratesEdited ??");
  });

  it("defers to the Stripe checkout-return resume (skips snapshot when launch_checkout present)", () => {
    expect(src).toContain('searchParams.get("launch_checkout") ? null : readOnboardingState()');
    expect(src).toContain('if (searchParams.get("launch_checkout")) return;');
  });

  it("does not bleed a snapshot across flow intents (signup vs add vs new)", () => {
    expect(src).toContain("snap.flowKey === flowKey");
  });

  it("remaps transient action steps on resume (never restores INTO loading/launching)", () => {
    expect(src).toContain("function resolveResumeStep(step: Step, brandId: string | null)");
    expect(src).toContain('if (step === "loading") return brandId ? "services" : "url";');
    expect(src).toContain('if (step === "launching") return "pricing";');
  });

  it("replays the loading screen once to re-hydrate before landing on a deep step", () => {
    expect(src).toContain("async function runResume(target: Step)");
    expect(src).toContain("createBrandAndFetchServices({ isResume: true })");
    expect(src).toContain("resumeStartedRef");
  });

  it("forces org reuse on resume so it never spins up a duplicate org", () => {
    expect(src).toContain("const reuseOrg = (isResume || !forceNew) && !!reuseOrgId;");
  });

  it("clears the snapshot on genuine completion", () => {
    expect(src).toContain("clearOnboardingState();");
  });
});
