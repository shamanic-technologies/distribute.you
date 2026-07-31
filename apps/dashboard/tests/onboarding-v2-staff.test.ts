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

describe("v2 onboarding — gating", () => {
  it("gates on the BETA allowlist, never the staff one", () => {
    // The two are not interchangeable. `isAdminEmail` is the primary security
    // boundary on `/api/admin/*` in the dashboard (the god-mode org switcher, which
    // enumerates and joins every tenant), so gating a preview on it means anyone
    // added for the preview also gets cross-tenant god-mode. This flow touches only
    // the viewer's own brand, so it belongs behind the gate that grants nothing else.
    expect(page).toContain("useIsBetaUser");
    expect(page).not.toContain("useIsAdminUser");
  });

  it("leaves a beta user a way back to the customer flow", () => {
    // Without this a beta user can never again see what a real customer sees,
    // which is the thing they most need to be able to check.
    expect(page).toContain('searchParams.get("flow") === "ga"');
    expect(page).toContain('variant={canPreview && !forceGa ? "v2" : "ga"}');
  });

  it("defaults the component to the customer flow", () => {
    // Every call site that says nothing gets GA, so the customer path cannot change
    // shape because a new mount forgot the prop.
    expect(flow).toContain('function Onboarding({ variant = "ga" }');
    expect(flow).toContain('const isV2 = variant === "v2";');
  });
});

describe("v2 staff onboarding — step order", () => {
  it("sends services straight to audiences, skipping click-destination", () => {
    expect(flow).toContain('setStep(isV2 ? "audiences" : noWebsiteMode ? "objective" : "destination")');
  });

  it("puts the sales funnels AFTER audiences", () => {
    expect(flow).toContain('onBack={() => setStep(isV2 ? "services" : "rates")}');
    expect(flow).toContain('onContinue={() => setStep(isV2 ? "funnels" : "consent")}');
  });

  it("routes consent back to the primary-funnel pick", () => {
    expect(flow).toContain('setStep(isV2 ? "primary" : "audiences")');
  });

  it("replaces the single lifetime-revenue screen with the per-funnel screens", () => {
    expect(flow).toContain('setStep(isV2 ? "funnelStats" : "ltr")');
  });

  it("keeps every GA-only step reachable only on the GA branch", () => {
    // `destination`, `objective` and `rates` still exist for GA; no v2 branch may
    // route into them, or the flow would ask twice for what the funnels already say.
    for (const dead of ['isV2 ? "destination"', 'isV2 ? "objective"', 'isV2 ? "rates"']) {
      expect(flow).not.toContain(dead);
    }
  });
});

describe("v2 staff onboarding — persistence", () => {
  it("widens the resumable step list without bumping the snapshot version", () => {
    // A bump strands an in-flight checkout. Adding step NAMES only widens what a
    // snapshot may legally carry, so old snapshots keep parsing.
    expect(flow).toContain("ONBOARDING_STATE_VERSION = 8");
    expect(flow).toContain('"audiences", "funnels", "primary", "consent"');
  });

  it("keeps the v2 selection out of the persisted shape", () => {
    // The persisted state is a fixed record; a new field there is what would force
    // the version bump. The funnel picks are deliberately ephemeral.
    const persisted = sliceFrom("type PersistedOnboardingState", 1800);
    expect(persisted).not.toContain("selectedFunnelKeys");
    expect(persisted).not.toContain("primaryFunnelKey");
    expect(persisted).not.toContain("funnelDrafts");
  });
});

describe("v2 staff onboarding — what it writes", () => {
  it("writes the primary funnel's goal, restating every other metric from the wire", () => {
    const save = sliceFrom("async function savePrimaryFunnelAndContinue()", 1400);
    // Rendered keys = none: this step shows no rate, so it has no business
    // overwriting one from client state (the #3039 incident).
    expect(save).toContain("buildEconomicsPayload(id, [], rates)");
    expect(save).toContain("optimizationGoal: nextOutcome");
    expect(save).toContain("rememberSavedEconomics(salesEconomics)");
  });

  it("persists nothing on the per-funnel detail screens", () => {
    // brand-service stores ONE lifetime revenue and ONE click destination per brand
    // and has no booking-link field, so a save here would drop most of what was typed.
    // 188 chars is the measured length of the function body; a longer slice runs
    // into the NEXT function's doc comment (which legitimately says "Saved via
    // sales-economics") and the guard then fails on correct code.
    const advance = sliceFrom("function continueFunnelStats()", 188);
    expect(advance).not.toContain("save");
    expect(advance).toContain('setStep("model")');
  });

  it("says on screen that the per-funnel numbers are a preview", () => {
    const stats = sliceFrom('if (step === "funnelStats")', 6000);
    expect(stats).toContain("Preview");
    expect(stats).toContain("not stored yet");
  });
});

describe("v2 staff onboarding — copy", () => {
  it("continues the landing's promise instead of re-pitching a converted user", () => {
    expect(flow).toContain("Sell like crazy, autonomously.");
  });

  it("drops the model vocabulary from the projection step", () => {
    const model = sliceFrom('if (step === "model")', 3000);
    expect(model).toContain("Your most profitable path with us.");
    // The GA headline stays for the customer flow, behind the variant check.
    expect(model).toContain('isV2 ? "Your most profitable path with us." : "Your best model."');
  });

  it("badges every gated step so a staff member knows it is not GA", () => {
    for (const [anchor, length] of [
      ['if (step === "funnels")', 1200],
      ['if (step === "primary")', 1400],
      ['if (step === "funnelStats")', 2000],
    ] as const) {
      expect(sliceFrom(anchor, length)).toContain('MaturityBadge level="beta"');
    }
  });
});

describe("v2 staff onboarding — funnel catalogue", () => {
  it("reads the catalogue through the display adapter, never field by field", () => {
    // The catalogue is being reshaped in parallel (a name per funnel, a fourth
    // funnel, richer legs). Mapping over the adapter means that lands here with no
    // edit; reaching into `.steps` at a render site would break the day it does.
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
    expect(flow).toContain("resolvePrimaryKey(next, current)");
    expect(flow).toContain("resolvePrimaryKey(selectedFunnelKeys, current)");
  });

  it("reports an unpriceable pipeline as absent, never as zero", () => {
    const pipeline = sliceFrom("function monthlyPipelineLabel(", 1200);
    expect(pipeline).toContain("return null");
    expect(pipeline).not.toContain('return "$0"');
    // Goes through the shared locale helper, like every other number in the flow.
    expect(pipeline).toContain("formatLocaleInteger");
  });
});

describe("v2 onboarding — resume", () => {
  it("maps a customer-flow-only step onto its v2 equivalent", () => {
    // The v2 branches guard TRANSITIONS, but a RESUME sets the step directly — from
    // a snapshot written before this flow existed, one written under `?flow=ga`, or
    // the cross-session `?brandId=` resume. Without this a beta user lands on a step
    // their flow never routes into and reads it as the preview not being live.
    const map = sliceFrom("function v2StepFor(step: Step): Step {", 400);
    expect(map).toContain('case "destination":');
    expect(map).toContain('return "audiences"');
    expect(map).toContain('case "objective":');
    expect(map).toContain('case "rates":');
    expect(map).toContain('return "funnels"');
  });

  it("threads the variant through every resume entry point", () => {
    // A call that drops the variant silently resumes a v2 session into the GA flow.
    const calls = flow.match(/resolveResumeStep\([^)]*\)/g) ?? [];
    const usages = calls.filter((c) => !c.startsWith("resolveResumeStep(step,"));
    expect(usages.length).toBeGreaterThan(0);
    for (const call of usages) {
      expect(call, `resume call missing the variant: ${call}`).toContain("variant");
    }
    // The cross-session brand resume hardcoded the GA goal step.
    expect(flow).toContain('runResume(isV2 ? "funnels" : "objective", seededUrl)');
  });

  it("self-corrects rather than rendering a step the flow does not have", () => {
    const failsafe = sliceFrom('if (isV2 && (step === "destination"', 260);
    expect(failsafe).toContain("setStep(v2StepFor(step))");
    expect(failsafe).toContain("return null");
  });
});

describe("v2 onboarding — the primary step promises nothing about orchestration", () => {
  const primary = sliceFrom('if (step === "primary")', 1600);

  it("asks for the primary goal in the words the product uses", () => {
    expect(primary).toContain("primary sales funnel goal with us today");
  });

  it("states the one true consequence: it calibrates the pricing", () => {
    expect(primary).toContain("calibrate your pricing");
  });

  it("never claims we run that funnel first, or that the others can be switched to", () => {
    // We do not control which funnel the orchestrator picks up first, so copy that
    // says we do is a promise the product cannot keep — the same class as a status
    // label stating what we ATTEMPTED rather than what HAPPENED.
    for (const claim of [
      "one path to start",
      "switch at any time",
      "Which one first",
      "your first path",
    ]) {
      expect(flow, `sequencing claim still on screen: ${claim}`).not.toContain(claim);
    }
  });
});
