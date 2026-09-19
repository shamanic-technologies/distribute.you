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
    expect(src).toContain("getBrandUserFields");
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

  it("welcome step answers the objections between it and the URL field", () => {
    // Not a feature tour (NN/g: "skip onboarding when possible"), and not a price
    // card — the visitor already converted on the landing.
    // The welcome is the sell-first screens' own now (`start-picks.tsx`),
    // rendered by the wizard as its first step.
    const picks = fs.readFileSync(path.resolve(__dirname, "../src/components/start/start-picks.tsx"), "utf8");
    for (const copy of [
      "revenue in 24h",
      "We run it for you",
      "You set the daily budget",
      "You see the real cost",
    ]) {
      expect(picks).toContain(copy);
    }
    expect(src).not.toContain('v: "~$15"');
    expect(src).not.toContain('v: "~$90"');
  });

  it("persists rates and profile and launches a real campaign", () => {
    // Economics are stated PER SALES FUNNEL now — the brand-wide record is the model
    // the funnels replaced, and features-service prices on the declared funnel.
    expect(src).not.toContain("saveBrandSalesEconomics");
    expect(src).toContain("stateBrandSalesFunnels");
    expect(src).toContain("declareBrandSalesFunnel");
    expect(src).toContain("saveBrandUserFields");
    expect(src).toContain("createCampaign");
    // NO audience is activated at launch: onboarding collects the customer's
    // target audience in their own words, and the audiences are built by hand
    // after payment.
    expect(src).not.toContain("listAudiences(");
    expect(src).not.toContain("setAudienceStatus(");
    // No brand-service persona create at launch.
    expect(src).not.toContain("createPersona");
    expect(src).not.toContain("persistPersonaDraftsForLaunch");
  });

  it("replaces the persona step with ONE target-audience box, and searches nothing", () => {
    // The audience step is a single textarea saved on the brand as the
    // `targetAudience` user-field. No suggest, no candidates, no picks: the
    // audiences are built by hand after payment, from this text.
    expect(src).not.toContain("suggestAudiences");
    expect(src).not.toContain("createAudience");
    expect(src).toContain('step === "audiences"');
    expect(src).toContain("Who do you sell to?");
    expect(src).toContain("saveBrandTargetAudience(id, text)");
    // The visible persona step is gone (audiences replaced it).
    expect(src).not.toContain('step === "personas"');
  });

  it("pre-fills the audience prompt with a real brand ICP (brand-service /icp/suggest)", () => {
    expect(src).toContain("suggestBrandIcp");
    expect(src).toContain("Drafting your ideal customer profile");
  });

  it("pre-warms the audience step during the loading screen (ICP draft ONLY)", () => {
    // During hydrateOnboardingInBackground (loading screen) we draft the ICP,
    // stash it in state, and feed it to the step as a `prefetch` prop so the box
    // is filled on arrival. No suggest runs: its result was never read before
    // payment and it was ~35 s of billed LLM + people-search per signup.
    expect(src).toContain("setAudiencePrefetch");
    expect(src).toContain("audience prewarm (ICP draft)");
    expect(src).toContain("prefetch={audiencePrefetch}");
    expect(src).toContain("suggestBrandIcp(id)");
    expect(src).not.toContain("runSuggest");
  });

  it("asks which services to promote and persists them on the brand profile", () => {
    expect(src).toContain("What services do you want to promote with us?");
    expect(src).toContain("services");
    expect(src).toContain("normalizeServices");
    expect(src).toContain("NON_SERVICE_LABELS");
    expect(src).toContain('"unknown"');
  });

  it("uses landing-only suggest extraction for the blocking services step", () => {
    expect(src).toContain('extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing", mode: "suggest" })');
    expect(src).toContain("hydrateOnboardingInBackground");
    // Background hydrate warms ONLY the 7 user-facing fields in suggest mode (services +
    // the 6 offer levers), never the backend-only SALES_PROFILE_FIELDS the flow never reads.
    expect(src).toContain('extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest" })');
  });

  it("takes the goal from the primary funnel and prices in that unit", () => {
    // The standalone goal picker is gone: the funnel the brand picks as primary IS
    // the optimization goal, so the question is asked once, in the words the brand
    // already used to describe how it sells.
    // The primary IS the first path picked on the sell-first screens; the radio
    // step that re-asked it is gone with the funnel step.
    expect(src).not.toContain("primary sales funnel goal with us today");
    expect(src).not.toContain("What is your primary sales goal?");
    expect(src).toContain("resolvePrimaryKey(selectedFunnelKeys, primaryFunnelKey)");
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
    // The goal still resolves the PROJECTION (features-service routes on it), but it
    // is no longer persisted on the brand: nothing reads that column any more.
    expect(src).not.toContain("optimizationGoal: optimizationGoalForOutcome(outcome)");
    // The rates step that owned the stale-projection retry is gone with the
    // brand-level model; the projection is now resolved per goal at the primary
    // step and refreshed by the budget step itself.
    expect(src).not.toContain("fetchFreshWorkflowProjectionForRates");
    expect(src).not.toContain("PRICING_REFRESH_RETRIES");
    expect(src).toContain("workflowOutcomeUnitCost");
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

  it("asks the conversion rates the funnel catalogue defines, not the goal's", () => {
    // The per-goal rate list held the entry legs of DIFFERENT funnels, so it asked for
    // numbers belonging to no single path. Each funnel's own steps are the question now.
    expect(src).not.toContain("RATE_KEYS_FOR_OUTCOME");
    expect(src).toContain("funnelRateFields");
    expect(src).toContain("Website visits to signup rate");
    expect(src).toContain("Positive reply → sales meeting");
    expect(src).toContain("Website visit → sales meeting");
    expect(src).toContain("Only set this above 0 if prospects can book a meeting directly from your website");
  });

  it("keeps rate inputs editable as text and validates decimals on continue", () => {
    expect(src).toContain("parseRateTextInput");
    // Funnel rates are typed into the funnel's own draft, keyed by the catalogue's
    // rate name rather than the retired goal's short key.
    expect(src).toContain("editFunnelDraft(economicsFunnel, { rates: { [rate.key]: next } })");
    expect(src).not.toContain("formatRateInput(e.target.value)");
  });

  it("onboarding has no brand-service persona path (audiences only)", () => {
    // The whole brand-service persona path is gone — onboarding creates NO
    // audience at all now; it saves the target audience text on the brand.
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
    expect(src).toContain("audience prewarm (ICP draft)");
    expect(src).toContain("hydrateOnboardingInBackground");
    expect(src).toContain("extractBrandFields (landing) failed");
    expect(src).toContain("extractBrandFields (url_map) failed");
    expect(src).toContain("displaySetupError");
    // A failed/empty service extraction shows NO error banner — the user just fills
    // the services in by hand and assumes it is normal (reassurance, not debug).
    expect(src).not.toContain("GENERIC_AI_SETUP_ERROR");
    expect(src).not.toContain("SetupWarning");
  });

  it("agency consent with no channel checkboxes", () => {
    expect(src).toContain("on your behalf");
    // Agency consent is ASKED on the consent step ("on your behalf" copy) but by
    // decision is NOT persisted — no consentedChannels / agencyConsentAt write, no
    // backend consent endpoint (nothing reads it). The consent STEP UI still renders.
    expect(src).not.toContain("consentedChannels");
    expect(src).not.toContain("agencyConsentAt");
    // The channels checkbox grid was removed.
    expect(src).not.toContain("Coming soon");
    expect(src).not.toContain("Always on");
  });

  it("funds each picked funnel before direct checkout", () => {
    expect(src).toContain("funnelBudgetUsd");
    expect(src).toContain("budgetForCount");
    expect(src).toContain("Continue to checkout");
    expect(src).toContain("const checkoutAmountCents = firstCharge.chargeCents;");
    // The reload is the FULL budget; only the FIRST charge carries the welcome discount.
    expect(src).toContain("topupAmountCents: Math.round(budget * 100),");
    expect(src).toContain("topupThresholdCents: AUTO_TOPUP_THRESHOLD_CENTS");
    expect(src).not.toContain("Set up your org wallet.");
  });

  it("shows $/day per path as the primary value, outcomes/mo secondary", () => {
    // One ceiling per funnel, typed. There is no tier list any more: the tiers
    // priced ONE pot, which is the thing per-funnel funding replaced.
    expect(src).toContain("setFunnelBudgets");
    expect(src).toContain("countForBudget");
    expect(src).not.toContain("COUNT_TIERS");
    expect(src).not.toContain("customBudgetSelected");
  });
});
