import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Source-substring guards: these modules import through the `@` alias, which vitest
// does not resolve in this repo, so the flow itself is not runtime-importable. The
// pure display adapter it reads (`lib/onboarding-funnel-view.ts`) carries no alias
// import and IS unit-tested, in `onboarding-funnel-view.test.ts`.
const flow = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);
const page = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/onboarding/page.tsx"),
  "utf-8",
);

/** Slice forward from an anchor. Lengths measured against the real file, with headroom. */
function sliceFrom(anchor: string, length: number): string {
  const at = flow.indexOf(anchor);
  expect(at, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  return flow.slice(at, at + length);
}

// Bounded by the NEXT declaration rather than a measured length. A `toContain`
// guard cannot be hurt by a slice that runs long, and a number expires the next
// time anybody adds a line inside the block.
function sliceBetween(anchor: string, endAnchor: string): string {
  const at = flow.indexOf(anchor);
  expect(at, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const end = flow.indexOf(endAnchor, at);
  expect(end, `end anchor not found: ${endAnchor}`).toBeGreaterThan(at);
  return flow.slice(at, end);
}

describe("onboarding — one flow, no gate", () => {
  it("serves the funnels flow to every signup", () => {
    // It ran behind the beta allowlist while brand-service had nowhere to put the
    // per-funnel economics. It does now, so the gate is gone — and with it the
    // `?flow=ga` escape hatch, which existed only to reach the other flow.
    expect(page).toContain("<Onboarding />");
    expect(page).not.toContain("useIsBetaUser");
    expect(page).not.toContain("useIsAdminUser");
    expect(page).not.toContain('searchParams.get("flow")');
    expect(page).not.toContain("variant");
  });

  it("leaves the component no variant to branch on", () => {
    // A variant prop is what let two step orders live in one file. With one flow
    // there is nothing to guard, so a re-added branch would be a second flow
    // nobody asked for.
    expect(flow).toContain("export function Onboarding()");
    expect(flow).not.toContain("OnboardingVariant");
    expect(flow).not.toContain("isV2");
  });
});

describe("onboarding — step order", () => {
  // The funnel set is stated ONCE, on the sell-first Path screen. The wizard's own
  // "How do you sell?" step and the "which one first?" pick asked it again two
  // screens later, so both are gone: services writes the set and goes straight to
  // the audience step. A flow that somehow reaches services with no pick (an old
  // snapshot) is sent back to the Path screen rather than shown a step that no
  // longer exists.
  it("sends services straight to the audience step, writing the picked set", () => {
    expect(flow).toContain('onClick={() => { addService(serviceDraft); if (selectedFunnelKeys.length === 0) setStep("path"); else void saveFunnelsAndContinue(); }}');
    expect(flow).not.toContain('setStep("funnels")');
    expect(flow).not.toContain('setStep("primary")');
  });

  it("renders neither the funnel step nor the primary pick", () => {
    expect(flow).not.toContain('if (step === "funnels") {');
    expect(flow).not.toContain('if (step === "primary") {');
    expect(flow).not.toContain("How do you sell?");
    expect(flow).not.toContain("primary sales funnel goal with us today");
    expect(flow).not.toContain("savePrimaryFunnelAndContinue");
  });

  it("routes the audiences back to services, and consent after the audiences", () => {
    expect(flow).toContain('onBack={() => setStep("services")}');
    expect(flow).toContain('onContinue={() => void saveTargetAudienceAndContinue()}');
    const save = sliceFrom("async function saveTargetAudienceAndContinue()", 900);
    expect(save).toContain('setStep("consent")');
  });

  it("routes consent back to the audiences", () => {
    const consent = sliceFrom('if (step === "consent") {', 600);
    expect(consent).toContain('<BackButton onClick={() => setStep("audiences")} />');
  });

  it("collects the economics per funnel after payment", () => {
    expect(flow).toContain('setStep("funnelStats")');
  });

  it("renders none of the steps the brand-level flow had", () => {
    // `destination`, `objective`, `rates` and `ltr` asked for ONE click
    // destination, ONE goal and ONE set of rates — the brand-level model the
    // funnels replaced. Their render blocks are gone; only the legacy remap and
    // the Step union still name them.
    for (const dead of [
      'if (step === "destination") {',
      'if (step === "objective") {',
      'if (step === "rates") {',
      'if (step === "ltr") {',
    ]) {
      expect(flow, `retired step still renders: ${dead}`).not.toContain(dead);
    }
    for (const dead of [
      "saveRatesAndContinue",
      "saveLtrAndContinue",
      "saveDestinationAndContinue",
    ]) {
      expect(flow, `retired saver still present: ${dead}`).not.toContain(dead);
    }
  });
});

describe("onboarding — persistence", () => {
  it("keeps the retired step names parsable without bumping the snapshot version", () => {
    // Removing a name NARROWS what a snapshot may legally carry, which strands a
    // session that was mid-checkout when this shipped. A bump does the same.
    expect(flow).toContain("ONBOARDING_STATE_VERSION = 8");
    expect(flow).toContain('"destination", "objective", "rates"');
  });

  it("keeps the funnel selection out of the persisted shape", () => {
    // The persisted state is a fixed record; a new field there is what would force
    // the version bump. The picks ride the pending-checkout blob's TOP level
    // instead, which is version-independent.
    const persisted = sliceFrom("type PersistedOnboardingState", 1800);
    expect(persisted).not.toContain("selectedFunnelKeys");
    expect(persisted).not.toContain("primaryFunnelKey");
    expect(persisted).not.toContain("funnelDrafts");
  });

  it("keeps the brand-level click destination in the persisted shape", () => {
    // The flow stopped ASKING for it, but removing the field is a version bump.
    const persisted = sliceFrom("type PersistedOnboardingState", 1800);
    expect(persisted).toContain("clickDestinationUrl");
  });
});

describe("onboarding — what it writes", () => {
  it("states the WHOLE funnel set when the user picks", () => {
    // Distinct from declaring one funnel: this is what flips `declared` and what
    // removes a funnel the user unpicked. features-service reads that set to
    // arbitrate the goal, so it lands before the budget step prices an outcome.
    const save = sliceFrom("async function saveFunnelsAndContinue()", 1600);
    expect(save).toContain("stateBrandSalesFunnels(id, selectedFunnelKeys)");
    expect(save).toContain("setStep(nextStep)");
  });

  it("derives the primary from the picks and persists nothing about it", () => {
    // The first picked funnel is the primary; the outcome it buys prices the
    // budget step. It used to be a radio step, and before that a brand-level
    // `optimizationGoal` write (the retired vocabulary) that restated five other
    // metrics it never showed (the #3039 incident). No brand-level write survives.
    const save = sliceFrom("async function saveFunnelsAndContinue()", 1600);
    expect(save).toContain("const primaryKey = resolvePrimaryKey(selectedFunnelKeys, primaryFunnelKey);");
    expect(save).toContain("outcomeForFunnelGoal(offeredFunnels.find((f) => f.key === primaryKey)?.goal)");
    expect(save).toContain("if (nextOutcome) setOutcome(nextOutcome);");
    expect(save).toContain('const nextStep: Step = "audiences";');
    expect(save).not.toContain("buildEconomicsPayload");
    expect(save).not.toContain("optimizationGoal");
  });

  it("prices each funnel through the same partial patch the settings card uses", () => {
    const save = sliceFrom("async function saveFunnelStatsAndContinue()", 2900);
    // Read what is STORED from the wire on every write: the patch is the DIFF
    // against it, which is what keeps a prefill nobody confirmed from being
    // written and what makes an emptied field really clear.
    expect(save).toContain("await getBrandSalesFunnels(id)");
    expect(save).toContain("buildFunnelPatch(def, draft, storedFunnelValues(stored, funnel.key))");
    expect(save).toContain("declareBrandSalesFunnel(id, funnel.key, patch)");
  });

  it("stops the funnel step on a refusal instead of advancing past it", () => {
    const save = sliceFrom("async function saveFunnelStatsAndContinue()", 2900);
    expect(save).toContain("setError(funnelWriteErrorMessage(err))");
    // `err.message` is the whole downstream body verbatim — a JSON blob in front
    // of a customer, and it destroys the `code` every consumer reads.
    expect(save).not.toContain("err.message");
  });

  it("mirrors the brand-level click destination from the first funnel that has one", () => {
    // The flow no longer asks for it on a screen of its own, but brand-service
    // still serves it on the brand read and consumers link off it. Same value the
    // user just typed, never an invented one, and written once per session.
    const save = sliceFrom("async function saveFunnelStatsAndContinue()", 2900);
    expect(save).toContain("clickDestinationMirroredRef.current");
    expect(save).toContain("saveBrandClickDestination(id, page)");
  });
});

describe("onboarding — the funnel screens no longer disclaim themselves", () => {
  it("drops the preview wording now that the values persist", () => {
    expect(flow).not.toContain("not stored yet");
    expect(flow).not.toContain("Preview — per-path");
  });

  it("carries no beta badge on a flow every customer gets", () => {
    // The badge rides the gate. No gate, no badge — a badge on a GA surface says
    // something about it that is not true.
    expect(flow).not.toContain('MaturityBadge level="beta"');
    expect(flow).not.toContain("maturity-badge");
  });
});

describe("onboarding — copy", () => {
  it("continues the landing's promise instead of re-pitching a converted user", () => {
    // Verbatim from the SERVED landing hero (index-v2.html), so the screen after
    // signup cannot state a promise two generations older than the one that
    // converted the visitor.
    // The welcome is the sell-first screens' own (`start-picks.tsx`), the
    // wizard's first step; its headline is the served landing's.
    const picks = fs.readFileSync(path.resolve(__dirname, "../src/components/start/start-picks.tsx"), "utf8");
    expect(picks).toContain("revenue in 24h");
    expect(picks).toContain("From $1 per day.");
    expect(flow).not.toContain("Sell like crazy, autonomously.");
    expect(flow).not.toContain("Pay per outcome, like Google Ads.");
  });

  it("keeps the model vocabulary off the projection step", () => {
    const model = sliceBetween('if (step === "model")', 'if (step === "offer") {');
    expect(model).toContain("Your most profitable path with us.");
    expect(flow).not.toContain("Your best model.");
  });
});

describe("onboarding — funnel catalogue", () => {
  it("reads the catalogue through the display adapter, never field by field", () => {
    // Mapping over the adapter means a reshaped catalogue lands here with no edit;
    // reaching into `.steps` at a render site would break the day it does.
    expect(flow).toContain("toFunnelViews(SALES_FUNNELS as unknown as FunnelCatalogueEntry[]");
    // Rate labels come from the catalogue's OWN resolver, so a rate reads the same
    // word here as on the settings card instead of drifting into a second wording.
    expect(flow).toContain("funnelRateFields(entry as unknown as SalesFunnelDef)");
    expect(flow).toContain("selectableFunnels(funnelViews, !noWebsiteMode)");
    expect(flow).toContain("orderedForDetail(selectedFunnels, primaryFunnelKey)");
  });

  it("keeps a selection from ever losing its primary", () => {
    // A set of selected funnels with none of them primary has no goal for the
    // budget step to price.
    expect(flow).toContain("resolvePrimaryKey(selectedFunnelKeys, primaryFunnelKey)");
  });

  it("reports an unpriceable pipeline as absent, never as zero", () => {
    const pipeline = sliceFrom("function monthlyPipelineLabel(", 1200);
    expect(pipeline).toContain("return null");
    expect(pipeline).not.toContain('return "$0"');
    // Goes through the shared locale helper, like every other number in the flow.
    expect(pipeline).toContain("formatLocaleInteger");
  });
});

describe("onboarding — resume", () => {
  it("maps a retired step onto the one that asks the same thing now", () => {
    // A resume sets the step DIRECTLY — from a snapshot written before the funnels
    // flow shipped, or an in-flight checkout blob — so without this mapping the
    // user lands on a step that no longer renders.
    const map = sliceBetween("function legacyStepFor(step: Step): Step {", "export function Onboarding()");
    expect(map).toContain('case "destination":');
    expect(map).toContain('return "audiences"');
    expect(map).toContain('case "objective":');
    expect(map).toContain('case "rates":');
    // The two retired wizard steps land on the sell-first picks, where the funnel
    // set is stated now.
    expect(map).toContain('case "funnels":');
    expect(map).toContain('case "primary":');
    expect(map).toContain('return "outcome"');
    expect(map).not.toContain('return "funnels"');
    expect(map).toContain('case "ltr":');
    expect(map).toContain('return "funnelStats"');
  });

  it("routes the cross-session brand resume at the sell-first picks", () => {
    expect(flow).toContain('runResume("outcome", seededUrl)');
    expect(flow).not.toContain('runResume("funnels"');
  });

  it("lands a snapshot naming a retired wizard step on the picks", () => {
    const failsafe = sliceFrom('if (step === "funnels" || step === "primary") {', 120);
    expect(failsafe).toContain("setStep(legacyStepFor(step))");
    expect(failsafe).toContain("return null");
  });

  it("does not re-run the analyze for a brand the picks were resumed on", () => {
    const fn = sliceFrom("function continueAfterPicks()", 400);
    expect(fn).toContain("if (brandIdRef.current && services.length > 0) {");
    expect(fn).toContain('setStep("services")');
  });

  it("self-corrects rather than rendering a step the flow does not have", () => {
    const failsafe = sliceFrom('if (step === "destination" || step === "objective"', 240);
    expect(failsafe).toContain("setStep(legacyStepFor(step))");
    expect(failsafe).toContain("return null");
  });
});

describe("onboarding — the sequencing claims the primary step made stay gone", () => {
  it("never claims we run one funnel first, or that the others can be switched to", () => {
    // The primary step is deleted; the claims it once carried must not resurface
    // on another screen. We do not control which funnel the orchestrator picks up
    // first, so copy that says we do is a promise the product cannot keep.
    for (const claim of [
      "one path to start",
      "switch at any time",
      "Which one first",
      "your first path",
      "calibrate your pricing",
    ]) {
      expect(flow, `sequencing claim still on screen: ${claim}`).not.toContain(claim);
    }
  });

  it("reads the funnel-goal-to-outcome map from ONE home", () => {
    expect(flow).toContain("function outcomeForFunnelGoal(goal: string | null | undefined): Outcome | null");
    expect(flow.split("OUTCOMES.find((o) => o.key === goal)").length - 1).toBe(1);
    expect(flow).not.toContain("skipPrimaryStep");
    expect(flow).not.toContain("soleFunnelOutcome");
  });
});

describe("onboarding pricing step — one picked path reads as one path", () => {
  // Anchored on a string that exists ONLY in the pricing step: `onePath` itself is
  // derived at the top of the flow, so anchoring on that declaration would slice
  // from there and assert against unrelated code. Bounded by the NEXT declaration
  // (the audience component) so the not.toContain below cannot overrun it and the
  // bound moves with the file.
  const pricing = sliceBetween("const underfunded = underfundedFunnels();", "function OnboardingAudiences(");

  it("derives the single-path branch from the picked funnels, not from a separate flag", () => {
    expect(flow).toContain("const onePath = selectedFunnels.length === 1;");
  });

  it("states one budget rather than 'each path' when there is only one", () => {
    expect(pricing).toContain("Set your daily budget.");
    expect(pricing).toContain("We spend up to your ceiling, and never more than that in a day.");
  });

  it("keeps the plural copy byte-identical for a real multi-path selection", () => {
    // The existing post-paid guard (onboarding-flow.test.ts) pins this sentence, and
    // a brand selling through several paths genuinely funds each one separately.
    expect(pricing).toContain("Fund each path.");
    expect(pricing).toContain("Each path spends up to its own ceiling");
  });

  it("never invites leaving the only path at 0, which Continue then refuses", () => {
    // Continue is gated on `underfunded.length === 0` plus a funded path, so on a
    // single-path selection "leave it at 0" describes a state the button rejects.
    // Both skip invitations are therefore multi-path only.
    expect(pricing).toContain('{!onePath && " Leave it at 0 to skip it for now."}');
    expect(pricing).toContain("{onePath ? \"From\" : \"Not funded. From\"}");
  });

  it("drops the total, which on one path restates the number typed above it", () => {
    expect(pricing).toContain("{!onePath && displayBudget != null && (");
    // The count belongs to the card, so hiding the sum loses nothing.
    expect(pricing).toContain("across {fundedFunnelCount}");
  });

  it("counts nothing when there is one thing to count", () => {
    // "Your paths · 1 of 1" reads as a step the flow lost rather than as the only
    // path there is.
    expect(flow).toContain('? "Your path"');
    expect(flow).toContain("`Your paths · ${funnelIndex + 1} of ${detailFunnels.length}`");
  });

  it("ships no em-dash in the copy it rewrote", () => {
    // User-facing onboarding copy: the repo bans U+2014 outright, and both lines
    // touched here carried one.
    expect(pricing).not.toContain("—");
  });
});
