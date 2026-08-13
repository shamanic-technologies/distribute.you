import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Conversion rates and lifetime revenue belong to a SALES FUNNEL, not to a brand.
 *
 * The brand-wide `brand_sales_economics` record is what the funnel model replaced:
 * one set of numbers for every path a brand sells through, plus an `optimizationGoal`
 * that could not tell the two meeting funnels apart. features-service no longer reads
 * that goal at all, and prices its pipeline on the declared funnel's own terms — so an
 * onboarding step that wrote the brand-wide record would be writing values nothing
 * reads, and would have to source the ones it did not render from somewhere. That
 * sourcing is what destroyed a brand's confirmed rates in prod (2026-07-29): a checkout
 * return whose snapshot failed to parse was rebuilt from DEFAULT_RATES, and the write
 * put those placeholders over rates the same user had confirmed minutes earlier.
 *
 * The fix is not a better restatement — it is not writing there at all. These guards
 * pin that: the flow states the funnel SET, then prices each funnel, and nothing in it
 * writes a brand-level rate.
 *
 * Behavioural import isn't possible (the component pulls Clerk/posthog/api through the
 * `@` alias vitest does not resolve here), so we assert the load-bearing source,
 * matching the repo's other onboarding guards.
 */
describe("Onboarding sales-economics writes", () => {
  const filePath = path.join(__dirname, "../src/components/onboarding/onboarding.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  const sliceFrom = (marker: string, length: number) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  it("writes no brand-level economics anywhere in the flow", () => {
    // The write itself, the payload builder that fed it, and the cache it refreshed.
    expect(src).not.toContain("saveBrandSalesEconomics");
    expect(src).not.toContain("buildEconomicsPayload");
    expect(src).not.toContain("rememberSavedEconomics");
    // The goal vocabulary is retired: a brand's paths are its declared funnels.
    expect(src).not.toContain("optimizationGoal:");
  });

  it("picking the primary path persists nothing", () => {
    // 1199 chars = the whole body, measured to its closing brace.
    const body = sliceFrom("function savePrimaryFunnelAndContinue()", 1199);
    expect(body).toContain('setStep("consent")');
    // The pick still drives local state — the detail-screen order, the outcome the
    // budget step prices, the funnel the projection resolves against.
    expect(body).toContain("setOutcome(nextOutcome)");
    // ...and writes nothing at all.
    expect(body).not.toContain("await save");
    expect(body).not.toContain("setBusy(true)");
  });

  it("prices the PRIMARY FUNNEL through the shared per-funnel patch path", () => {
    const body = sliceFrom("async function saveModelEconomics(", 2000);
    // Same three calls, in the same order, as the funnel's own detail screen: read
    // what is stored, diff against it, declare. Never a brand-level write.
    const read = body.indexOf("await getBrandSalesFunnels(id)");
    const diff = body.indexOf("buildFunnelPatch(def, draft, storedFunnelValues(stored, funnel.key))");
    const write = body.indexOf("declareBrandSalesFunnel(id, funnel.key, patch)");
    expect(read).toBeGreaterThan(-1);
    expect(diff).toBeGreaterThan(read);
    expect(write).toBeGreaterThan(diff);
    // brand-service's refusal is a sentence written for a person; `err.message` is
    // the whole downstream body verbatim.
    expect(body).toContain("funnelWriteErrorMessage(err)");
    expect(body).not.toContain("setModelEconomicsError(err instanceof Error ? err.message");
  });

  it("shows the primary funnel's OWN chain, not the retired goal's rate set", () => {
    // `RATE_KEYS_FOR_OUTCOME` mixed the entry legs of DIFFERENT funnels (the meeting
    // goal asked for reply-to-meeting AND visit-to-meeting, one from each meeting
    // funnel), so the block asked for numbers belonging to no single path.
    expect(src).not.toContain("RATE_KEYS_FOR_OUTCOME");
    expect(src).not.toContain("modelEconomicsKeys");
    // The fields come from the funnel catalogue, so a rate reads the same words here
    // as on the funnel's own screen.
    expect(src).toContain("const economicsRates = economicsDef ? funnelRateFields(economicsDef) : []");
    expect(src).toContain("editFunnelDraft(economicsFunnel, { rates: { [rate.key]: e.target.value } })");
  });

  it("arms the Update button on a live compare, never a sticky latch", () => {
    expect(src).toContain("economicsSnapshot !== modelEconomicsBaseline");
    // A boolean set true on first edit and never cleared would leave the button armed
    // after a change-then-undo.
    expect(src).not.toContain("setEconomicsDirty(");
  });

  it("warms the stored set on the post-payment paths, which never hydrate", () => {
    // Still needed: it seeds the lifetime revenue the funnel screens prefill from.
    expect(src).toContain("function prewarmStoredEconomics(brandId: string)");
    const resume = sliceFrom("async function resumeCheckoutLaunch(", 1400);
    expect(resume).toContain("prewarmStoredEconomics(prewarmId)");
    const direct = sliceFrom("async function launchDirectlyWithoutCheckout(", 1600);
    expect(direct).toContain("prewarmStoredEconomics(prewarmId)");
    // A user-typed lifetime revenue is never overwritten by the warm-up.
    expect(src).toContain("if (ltvEditedRef.current) return;");
  });

  it("ships no invented lifetime revenue", () => {
    expect(src).toContain('ltv: ""');
    expect(src).not.toContain("ltv: 2500");
    expect(src).not.toContain('ltv: "2,500"');
  });
});
