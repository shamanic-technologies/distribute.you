import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Source-substring guard for the beta guided onboarding. Pins the load-bearing
// wiring (live endpoints, services step, goal-driven rate, outcome-count budget,
// wallet setup, draft-only onboarding personas, agency consent) so a refactor that
// silently drops a real fetch / the launch is caught. Beta-gated via isBetaEmail.
describe("Beta onboarding guided flow", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx"),
    "utf-8",
  );

  it("fetches real data during the loading step (no fake)", () => {
    expect(src).toContain("getBrandProfile");
    expect(src).toContain("getSalesEconomicsEffective");
    expect(src).toContain("suggestPersonas");
    expect(src).toContain("getWorkflowProjection");
  });

  it("shows sequential setup milestones instead of double-active loading steps", () => {
    expect(src).toContain("Preparing your workspace");
    expect(src).toContain("Adding your brand");
    expect(src).toContain("Extracting your services");
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

  it("persists rates, personas, profile and launches a real campaign", () => {
    expect(src).toContain("saveBrandSalesEconomics");
    expect(src).toContain("createPersona");
    expect(src).toContain("saveBrandProfileVersion");
    expect(src).toContain("createCampaign");
  });

  it("replaces the persona step with a natural-language audience step (human-service /suggest)", () => {
    // The audience step calls human-service `/suggest` (via the gateway), shows
    // candidate audiences, and persists the user's picks via createAudience.
    expect(src).toContain("suggestAudiences");
    expect(src).toContain("createAudience");
    expect(src).toContain('step === "audiences"');
    expect(src).toContain("Who do you want to reach?");
    expect(src).toContain("Suggest audiences");
    // The visible persona step is gone (audiences replaced it).
    expect(src).not.toContain('step === "personas"');
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

  it("starts persona drafting independently from full profile hydration", () => {
    expect(src).toContain("const personaSeed = seedOnboardingPersonaFromBrandInfo(id);");
    expect(src.indexOf("const personaSeed = seedOnboardingPersonaFromBrandInfo(id);")).toBeLessThan(
      src.indexOf("extractBrandFields([id], SALES_PROFILE_FIELDS)"),
    );
    expect(src).not.toContain("async function hydrateOnboardingInBackground(id: string): Promise<void> {\n    setPersonaSeeding(true);");
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

  it("keeps onboarding audiences draft-only until launch", () => {
    expect(src).toContain("Who do you want to sell to?");
    expect(src).toContain("onboarding-only drafts");
    expect(src).toContain("setPersonaDrafts");
    expect(src).toContain("persistPersonaDraftsForLaunch");
    expect(src).toContain("personas:");
    expect(src).toContain("onChange={(name, filters) => updateDraft(persona.id, name, filters)}");
    expect(src).toContain("showLifecycleActions={false}");
    expect(src).not.toContain("EditWithAIChat");
    expect(src).not.toContain("listPersonas");
    expect(src).not.toContain("setPersonaStatus");
    expect(src).not.toContain('configKey="persona-editor"');
    expect(src).not.toContain("suppressPaymentRequired: true");
    expect(src).not.toContain("pause, resume and archive your audiences");
  });

  it("does not fail the whole onboarding when optional AI suggestions 502", () => {
    expect(src).toContain("seedOnboardingPersonaFromBrandInfo");
    expect(src).toContain("suggest/create persona (onboarding seed) failed");
    expect(src).toContain("hydrateOnboardingInBackground");
    expect(src).toContain("extractBrandFields failed");
    expect(src).toContain("GENERIC_AI_SETUP_ERROR");
    expect(src).toContain("displaySetupError");
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
    expect(src).toContain("Checkout $");
    expect(src).toContain("const checkoutAmountCents = Math.round(budget * 100)");
    expect(src).toContain("topupAmountCents: checkoutAmountCents");
    expect(src).toContain("topupThresholdCents: AUTO_TOPUP_THRESHOLD_CENTS");
    expect(src).not.toContain("Set up your org wallet.");
  });

  it("lets a filled Other budget card be reselected after choosing another tier", () => {
    expect(src).toContain("const selectCustomCount = () =>");
    expect(src).toContain("if (isCustom) setSelectedCount(customN)");
    expect(src).toContain("onClick={selectCustomCount}");
  });
});
