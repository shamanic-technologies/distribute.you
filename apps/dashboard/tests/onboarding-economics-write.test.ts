import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * brand-service requires all six core sales-economics metrics on every write, so an
 * onboarding step that edits ONE of them has to restate the other five. Restating
 * them from client state destroyed a brand's confirmed rates in prod (2026-07-29): a
 * checkout return whose snapshot failed to parse was rebuilt from DEFAULT_RATES, and
 * the lifetime-revenue step wrote those placeholders over rates the same user had
 * confirmed minutes earlier (visit-to-signup 8.4% -> 5%, signup-to-paid 16.2% -> 10%).
 *
 * These guards pin the invariant: a metric the current step did not render is read
 * from the wire, never from `rates`. Behavioural import isn't possible (the component
 * pulls Clerk/posthog/api through the `@` alias vitest does not resolve here), so we
 * assert the load-bearing source, matching the repo's other onboarding guards.
 */
describe("Onboarding sales-economics writes", () => {
  const filePath = path.join(__dirname, "../src/components/onboarding/onboarding.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  const sliceFrom = (marker: string, length = 1600) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  it("reads the stored set from the wire and fails loud when it is absent", () => {
    const body = sliceFrom("async function resolveStoredEconomics(");
    expect(body).toContain("getSalesEconomicsEffective(brandId)");
    // No placeholder substitute: an unresolvable read throws instead of defaulting.
    expect(body).toContain("throw new Error(");
    expect(body).not.toContain("DEFAULT_RATES");
  });

  it("sources every metric the step did not render from the stored set", () => {
    const body = sliceFrom("async function buildEconomicsPayload(");
    for (const field of [
      "lifetimeRevenueUsd",
      "replyToMeetingPct",
      "visitToMeetingPct",
      "meetingToClosePct",
      "visitToSignupPct",
      "signupToPaidClientPct",
    ]) {
      expect(body).toContain(field);
    }
    expect(body).toContain("const stored = await resolveStoredEconomics(brandId)");
    expect(body).toContain("rendered.has(key) ? values[key] : storedValue");
    // The four beta rates have no stored counterpart, so they ride along only when the
    // step rendered them - omitting leaves the stored value untouched.
    expect(body).toContain('rendered.has("v2p") ? { visitToPaidClientPct: values.v2p }');
    expect(body).toContain('rendered.has("f2p") ? { formSubmissionToPaidClientPct: values.f2p }');
  });

  it("builds both step payloads through that one helper, never from rates directly", () => {
    expect(src).toContain("await buildEconomicsPayload(id, rateKeys, nextRates)");
    expect(src).toContain('await buildEconomicsPayload(id, ["ltv"], { ...rates, ltv })');
    // The pre-fix payloads restated every metric off the client copy. Scoped to the two
    // save functions: the projection helper legitimately reads the client rates to build
    // its econ overrides, which is a read, not a write.
    for (const marker of ["async function saveRatesAndContinue(", "async function saveLtrAndContinue("]) {
      const body = sliceFrom(marker, 2400);
      expect(body).not.toContain("replyToMeetingPct: nextRates.r2m");
      expect(body).not.toContain("visitToSignupPct: nextRates.v2s");
      expect(body).not.toContain("signupToPaidClientPct: nextRates.s2c");
      expect(body).not.toContain("lifetimeRevenueUsd: nextRates.ltv");
    }
  });

  it("blocks the lifetime-revenue step when the stored set cannot be read", () => {
    const body = sliceFrom("async function saveLtrAndContinue(", 2400);
    const build = body.indexOf("buildEconomicsPayload");
    const advance = body.indexOf('setStep("model")');
    expect(build).toBeGreaterThan(-1);
    expect(advance).toBeGreaterThan(build);
    // The catch bails out before the write and before advancing.
    expect(body).toContain("setBusy(false);\n        return;");
  });

  it("refreshes the cached stored set from what was actually persisted", () => {
    expect(src).toContain("function rememberSavedEconomics(saved: BrandSalesEconomics)");
    expect(src).toContain("rememberSavedEconomics(salesEconomics)");
    // The projection is refreshed against the persisted values, not the client copy.
    expect(src).toContain("fetchFreshWorkflowProjectionForRates(id, savedRates, outcome)");
  });

  it("warms the stored set on the post-payment paths, which never hydrate", () => {
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
