import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guard for the beta guided onboarding. Pins the load-bearing
// wiring (live endpoints, services step, goal-driven rate, outcome-count budget,
// wallet setup, natural-language audience step, agency consent) so a refactor that
// silently drops a real fetch / the launch is caught. Beta-gated via isBetaEmail.
describe("Beta onboarding guided flow", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
    "utf-8",
  );

  it("fetches real data during the loading step (no fake)", () => {
    expect(src).toContain("getBrandProfile");
    expect(src).toContain("getSalesEconomicsEffective");
    expect(src).toContain("getWorkflowProjection");
  });

  it("shows sequential setup milestones instead of double-active loading steps", () => {
    expect(src).toContain("Setting up your account");
    expect(src).toContain("Looking up your company");
    expect(src).toContain("Finding what you offer");
    expect(src).toContain("setLoadStep(1)");
    expect(src).toContain("setLoadStep(2)");
    expect(src).toContain("const isActive = !isDone && i === loadStep");
    expect(src).not.toContain("loadStep === 1 && i === 2");
  });

  it("welcome step shows value propositions instead of indicative price cards", () => {
    for (const copy of [
      "Drop your URL",
      "We run outreach",
      "You get outcomes",
      "Finds leads and contacts buyers across the best channels.",
    ]) {
      expect(src).toContain(copy);
    }
    expect(src).not.toContain('v: "~$15"');
    expect(src).not.toContain('v: "~$90"');
  });

  it("persists rates and profile and launches a real campaign", () => {
    expect(src).toContain("saveBrandSalesEconomics");
    expect(src).toContain("saveBrandProfileVersion");
    expect(src).toContain("createCampaign");
    // Audiences are NOT persisted at launch (activated at the audience step via
    // setAudienceStatus); no brand-service persona create at launch.
    expect(src).not.toContain("createPersona");
    expect(src).not.toContain("persistPersonaDraftsForLaunch");
  });

  it("replaces the persona step with a natural-language audience step (human-service /suggest)", () => {
    // The audience step calls human-service `/suggest` (via the gateway) and shows
    // ONE candidate per audience; each candidate is already persisted at status
    // "suggested", so selecting a pick ACTIVATES it via setAudienceStatus — NOT a
    // re-save via createAudience.
    expect(src).toContain("suggestAudiences");
    expect(src).toContain('setAudienceStatus(c.audienceId, "active")');
    expect(src).not.toContain("createAudience");
    expect(src).toContain('step === "audiences"');
    expect(src).toContain("Who do you want to reach?");
    expect(src).toContain("Suggest audiences");
    // The visible persona step is gone (audiences replaced it).
    expect(src).not.toContain('step === "personas"');
  });

  it("pre-fills the audience prompt with a real brand ICP (brand-service /icp/suggest)", () => {
    expect(src).toContain("suggestBrandIcp");
    expect(src).toContain("Drafting your ideal customer profile");
  });

  it("pre-warms the audience step during the loading screen (ICP + suggest in background)", () => {
    // During hydrateOnboardingInBackground (loading screen) we draft the ICP AND
    // fire the audience suggest, stash it in state, and feed it to the step as a
    // `prefetch` prop so candidates are ready on arrival.
    expect(src).toContain("setAudiencePrefetch");
    expect(src).toContain("audience prewarm (ICP + suggest)");
    expect(src).toContain("prefetch={audiencePrefetch}");
    // The prewarm chains ICP -> suggestAudiences in the parent (background).
    expect(src).toMatch(/suggestBrandIcp\(id\)[\s\S]{0,400}suggestAudiences\(id, prompt\)/);
    // Fallback path (no prewarm) still auto-fires the suggest — zero click.
    expect(src).toContain("void runSuggest(nl)");
  });

  it("asks which services to promote and persists them on the brand profile", () => {
    expect(src).toContain("What services do you want to promote with us?");
    expect(src).toContain("services");
    expect(src).toContain("normalizeServices");
    expect(src).toContain("NON_SERVICE_LABELS");
    expect(src).toContain('"unknown"');
  });

  it("uses landing-only extraction for the blocking services step", () => {
    expect(src).toContain('extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing" })');
    expect(src).toContain("hydrateOnboardingInBackground");
    expect(src).toContain("extractBrandFields([id], SALES_PROFILE_FIELDS)");
  });

  it("offers the two sales goals and prices in the chosen unit", () => {
    expect(src).toContain("What is your primary sales goal?");
    for (const unit of ["signups", "meetings"]) {
      expect(src).toContain(unit);
    }
    expect(src).toContain("outcomeUnitCost");
    expect(src).toContain("optimizationGoalForOutcome");
    // Collapsed away from the old six-outcome list.
    expect(src).not.toContain("sales-revenue");
    expect(src).not.toContain("conversations");
  });

  it("uses the selected goal for workflow projection and persisted economics", () => {
    expect(src).toContain("salesObjectiveForOptimizationGoal(optimizationGoalForOutcome(outcome))");
    expect(src).toContain("optimizationGoal: optimizationGoalForOutcome(outcome)");
    expect(src).toContain("fetchFreshWorkflowProjectionForRates(id, nextRates, outcome)");
    expect(src).toContain("workflowProjectionMatchesOutcomeRates(proj, goal");
    expect(src).toContain("PRICING_REFRESH_RETRIES");
    expect(src).toContain("Pricing is still refreshing from your new rates");
    expect(src).toContain("workflowOutcomeUnitCost(w, goal");
    expect(src).toContain("replyToMeetingPct: nextRates.r2m");
    expect(src).toContain("visitToMeetingPct: nextRates.v2m");
    expect(src).not.toContain("projection refresh after rates failed");
    expect(src).not.toContain('objective: "self-serve"');
  });

  it("chooses and launches the workflow with the best cost for the selected outcome", () => {
    expect(src).toContain("selectWorkflowForOptimizationGoal");
    expect(src).toContain("function activeWorkflow()");
    expect(src).toContain("replyToMeetingPct: rates.r2m");
    expect(src).toContain("visitToMeetingPct: rates.v2m");
    expect(src).toContain("activeWorkflow()?.workflowDynastySlug");
    expect(src).not.toContain("projectionRef.current?.recommendedWorkflowDynastySlug");
  });

  it("asks the conversion rates that feed the selected goal", () => {
    expect(src).toContain("RATE_KEYS_FOR_OUTCOME");
    expect(src).toContain("Website visits to signup rate");
    expect(src).toContain("Positive reply → sales meeting");
    expect(src).toContain("Website visit → sales meeting");
    expect(src).toContain("Only set this above 0 if prospects can book a meeting directly from your website");
  });

  it("keeps rate inputs editable as text and validates decimals on continue", () => {
    expect(src).toContain("parseRateTextInput");
    expect(src).toContain("nextRates[key] = parseRateTextInput(rateText[key], key)");
    expect(src).toContain("setRateText((t) => ({ ...t, [k]: e.target.value }))");
    expect(src).not.toContain("formatRateInput(e.target.value)");
  });

  it("onboarding has no brand-service persona path (audiences only)", () => {
    // The whole brand-service persona path is gone — onboarding creates audiences
    // via human-service /suggest + setAudienceStatus, nothing else.
    expect(src).not.toContain("setPersonaDrafts");
    expect(src).not.toContain("persistPersonaDraftsForLaunch");
    expect(src).not.toContain("seedOnboardingPersonaFromBrandInfo");
    expect(src).not.toContain("OnboardingPersonas");
    expect(src).not.toContain("listPersonas");
    expect(src).not.toContain("createPersona");
    expect(src).not.toContain("setPersonaStatus");
    expect(src).not.toContain("suggestPersonas");
    expect(src).not.toContain('configKey="persona-editor"');
    expect(src).not.toContain("/brands/${id}/personas");
  });

  it("does not fail the whole onboarding when optional AI suggestions 502", () => {
    expect(src).toContain("audience prewarm (ICP + suggest)");
    expect(src).toContain("hydrateOnboardingInBackground");
    expect(src).toContain("extractBrandFields failed");
    expect(src).toContain("displaySetupError");
    // A failed/empty service extraction shows NO error banner — the user just fills
    // the services in by hand and assumes it is normal (reassurance, not debug).
    expect(src).not.toContain("GENERIC_AI_SETUP_ERROR");
    expect(src).not.toContain("SetupWarning");
  });

  it("agency consent with no channel checkboxes", () => {
    expect(src).toContain("on your behalf");
    expect(src).toContain("consentedChannels");
    expect(src).toContain("agencyConsentAt");
    // The channels checkbox grid was removed.
    expect(src).not.toContain("Coming soon");
    expect(src).not.toContain("Always on");
  });

  it("budget is picked as outcome-count tiers before direct checkout", () => {
    expect(src).toContain("COUNT_TIERS");
    expect(src).toContain("budgetForCount");
    expect(src).toContain("Continue to checkout");
    expect(src).toContain("const checkoutAmountCents = Math.round(budget * 100)");
    expect(src).toContain("topupAmountCents: checkoutAmountCents");
    expect(src).toContain("topupThresholdCents: AUTO_TOPUP_THRESHOLD_CENTS");
    // Brand daily budget note preserved
    expect(src).toContain("brand daily budget cap");
    expect(src).toContain("Checkout loads credits first");
    expect(src).toContain("auto-topup reloads the same daily amount whenever the balance drops below $5");
    expect(src).not.toContain("Set up your org wallet.");
  });

  it("lets a filled Other budget card be reselected after choosing another tier", () => {
    expect(src).toContain("const selectCustomCount = () =>");
    expect(src).toContain("if (isCustom) setSelectedCount(customN)");
    expect(src).toContain("onClick={selectCustomCount}");
  });
});
