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
    expect(src).toContain("ONBOARDING_STATE_VERSION = 5");
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
    expect(src).toContain("restored?.audiencePrompt ??");
    expect(src).toContain("restored?.audienceCandidates ??");
    expect(src).toContain("restored?.selectedAudienceIds ??");
    expect(src).toContain("restored?.brandId ??");
    // edited-guards restored so a resume's re-extraction can't clobber user edits.
    expect(src).toContain("restored?.servicesEdited ??");
    expect(src).toContain("restored?.ratesEdited ??");
  });

  it("uses the full onboarding snapshot even when returning from Stripe checkout", () => {
    expect(src).toContain("readCheckoutOnboardingSnapshot()");
    expect(src).toContain("pending.onboardingState");
    expect(src).not.toContain('searchParams.get("launch_checkout") ? null : readOnboardingState()');
    expect(src).toContain('if (searchParams.get("launch_checkout") === "success") return;');
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

  it("checkout amount prefers the LIVE selection over a stale restored budget", () => {
    // After a checkout cancel, checkoutBudgetUsd holds the PRIOR tier; re-picking a
    // different tier updates derivedBudget() (selectedCount), so the charge must read
    // derivedBudget() FIRST — same precedence as the bonus/pricing display.
    expect(src).toContain("const budget = derivedBudget() ?? checkoutBudgetUsd ?? storedPending?.budgetUsd;");
    expect(src).not.toContain("const budget = checkoutBudgetUsd ?? storedPending?.budgetUsd ?? derivedBudget();");
    // display precedence the charge now matches
    expect(src).toContain("const amount = derivedBudget() ?? checkoutBudgetUsd;");
  });

  it("opportunistic checkout read tolerates a stale/invalid blob (purge + null, no throw)", () => {
    // readPendingCheckoutLaunchOrNull is a fallback source; a leftover blob from a
    // prior schema must not block a fresh checkout. It must swallow + purge, while
    // the strict readPendingCheckoutLaunch keeps throwing for resume/cancel paths.
    const orNull = src.slice(
      src.indexOf("function readPendingCheckoutLaunchOrNull"),
      src.indexOf("function toStringList"),
    );
    expect(orNull).toContain("try {");
    expect(orNull).toContain("return readPendingCheckoutLaunch();");
    expect(orNull).toContain("window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);");
    expect(orNull).toContain("return null;");
    // strict reader still fail-loud
    expect(src).toContain('throw new Error("Checkout returned with an invalid pending launch state. Campaign was not launched.");');
  });

  it("does not double-resume on a Stripe checkout return (generic resume no-ops)", () => {
    // The dedicated checkout effect owns ?launch_checkout=success|cancelled. The
    // generic resume must NOT also fire (it would re-hydrate the brand and land on
    // "pricing", flashing the budget modal over the real "launching" flow).
    expect(src).toContain('!searchParams.get("launch_checkout") &&');
    // success first-paint goes straight to "launching", never the budget step.
    expect(src).toContain('searchParams.get("launch_checkout") === "success"\n        ? "launching"');
  });

  it("activates the picked audiences as the terminal launch commit", () => {
    // A launched campaign with zero active audiences is a hard dead end (the
    // "No active audience yet" blocker). completeLaunchAfterCheckout activates the
    // selected audiences idempotently before campaign create; fail-loud if none.
    const launch = src.slice(
      src.indexOf("async function completeLaunchAfterCheckout"),
      src.indexOf("async function generateActiveAudienceAvatars"),
    );
    expect(launch).toContain("const launchAudienceIds = pending.onboardingState.selectedAudienceIds ?? [];");
    expect(launch).toContain('await setAudienceStatus(audienceId, "active");');
    expect(launch).toContain("if (launchAudienceIds.length === 0) {");
  });

  it("blocks checkout when no audience is selected (no paid audience-less launch)", () => {
    const begin = src.slice(
      src.indexOf("async function beginCheckoutAndLaunch"),
      src.indexOf("async function resumeCheckoutLaunch"),
    );
    expect(begin).toContain("const launchAudienceIds = selectedAudienceIds.length");
    expect(begin).toContain("if (launchAudienceIds.length === 0) {");
  });

  it("persists pricing and audience display state, not only launch state", () => {
    expect(src).toContain("workflowProjection: projectionRef.current");
    expect(src).toContain("salesInputs: salesInputsRef.current");
    expect(src).toContain("launchFeatureInputs: launchFeatureInputsRef.current");
    expect(src).toContain("audiencePrompt");
    expect(src).toContain("audienceCandidates");
    expect(src).toContain("selectedAudienceIds");
    expect(src).toContain("isWorkflowProjectionResponse");
    expect(src).toContain("isAudienceCandidateList");
  });
});
