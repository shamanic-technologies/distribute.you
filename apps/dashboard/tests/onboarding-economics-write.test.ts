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

  it("there is no primary-funnel step to write from: the first pick is the primary", () => {
    // The step that asked "which one first?" is gone with the "How do you sell?"
    // step (both were the Path screen's question twice). The primary is derived in
    // `saveFunnelsAndContinue`, and it still writes no brand-level economics.
    expect(src).not.toContain("savePrimaryFunnelAndContinue");
    const body = sliceFrom("async function saveFunnelsAndContinue()", 900);
    expect(body).toContain("resolvePrimaryKey(selectedFunnelKeys, primaryFunnelKey)");
    expect(body).toContain("setOutcome(nextOutcome)");
    expect(body).not.toContain("buildEconomicsPayload");
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
