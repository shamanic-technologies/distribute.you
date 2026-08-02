import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { outcomeNounPlural } from "../src/lib/strategy-model";

/**
 * Three onboarding surfaces that each reported something other than what they did.
 *
 * 1. A successful audience suggest APPENDS below the already-picked cards, so a user
 *    holding a full selection saw nothing move and read the click as a no-op. Worse, a
 *    run where every generated audience collided with one already stored produced NO
 *    message at all — one brand's user clicked "Find new audiences" five times against
 *    that silence (2026-07-29).
 * 2. The budget modal called the positive-replies outcome "contacts", naming the people
 *    emailed rather than what the budget buys, and contradicting its own goal label.
 * 3. The pricing summary, the checkout CTA and the Stripe amount each carried their own
 *    copy of the budget expression, and the custom card mirrored the typed amount into a
 *    second state — the shape that lets a charged amount lag a displayed one.
 * 4. The best-model step showed an ROI multiple while showing neither number it is
 *    computed from, so a return under 1x was unexplainable.
 *
 * Behavioural import isn't possible for onboarding.tsx (it pulls Clerk/posthog/api
 * through the `@` alias vitest does not resolve here), so these assert the load-bearing
 * source, matching the repo's other onboarding guards. strategy-model.ts carries no
 * runtime `@` import, so it gets a real call.
 */
describe("Onboarding audience feedback, outcome noun, budget source and ROI inputs", () => {
  const filePath = path.join(__dirname, "../src/components/onboarding/onboarding.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  const sliceFrom = (marker: string, length = 2000) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  describe("audience suggest reports what the run produced", () => {
    it("counts the candidates that are actually new, not the whole merged list", () => {
      const body = sliceFrom("async function runSuggest(");
      expect(body).toContain("const added = merged.length - keep.length;");
      expect(body).toContain('setNotice(`${added} new ${added === 1 ? "audience" : "audiences"} generated`)');
    });

    it("surfaces the zero-new run that used to be silent", () => {
      const body = sliceFrom("async function runSuggest(");
      expect(body).toContain("No new audiences this time.");
      // The pre-existing empty-result message survives for the no-keeps case.
      expect(body).toContain("No audiences matched that description.");
    });

    it("clears the notice on every run and on failure", () => {
      const body = sliceFrom("async function runSuggest(");
      const start = body.indexOf("setNotice(null)");
      expect(start).toBeGreaterThan(-1);
      // A second clear lives in the catch, so a failed retry cannot leave the previous
      // run's success line sitting next to an error.
      expect(body.indexOf("setNotice(null)", start + 1)).toBeGreaterThan(start);
      expect(body).toContain("We couldn't generate audiences right now.");
    });

    it("renders the notice beside the button, not below the fold", () => {
      const row = sliceFrom('<div className="mt-3 flex flex-wrap items-center gap-3">', 1400);
      expect(row).toContain("onClick={() => runSuggest()}");
      expect(row).toContain("{notice && (");
      expect(row).toContain("text-emerald-700");
    });
  });

  describe("outcome noun", () => {
    it("names what the budget buys for positive replies", () => {
      const outcomes = sliceFrom("const OUTCOMES:", 1800);
      expect(outcomes).toContain('key: "positive_replies"');
      expect(outcomes).toContain('unit: "positive replies"');
      expect(outcomes).not.toContain('unit: "contacts"');
    });

    it("agrees with the sibling noun map", () => {
      expect(outcomeNounPlural("positive_replies")).toBe("positive replies");
    });
  });

  describe("one budget source", () => {
    it("gives the displayed and the charged amount a single helper", () => {
      expect(src).toContain("function budgetForCharge(): number | null {");
      // Summary callout, checkout CTA, and the Stripe amount.
      expect(src).toContain("const displayBudget = budgetForCharge();");
      expect(src).toContain("const amount = budgetForCharge();");
      expect(src).toContain("const budget = budgetForCharge() ?? storedPending?.budgetUsd;");
      // No surface may rebuild the expression by hand.
      expect(src).not.toContain("derivedBudget() ?? checkoutBudgetUsd ??");
    });

    it("charges the SUM of what each path is funded with", () => {
      // Reading the typed field per funnel, never a mirrored copy — the same
      // reason the custom tier used to read its text: a keystroke-lagging number
      // must not be what reaches Stripe.
      const body = sliceFrom("function derivedBudget(): number | null {", 400);
      expect(body).toContain("selectedFunnels.reduce");
      expect(body).toContain("funnelBudgetUsd(f.key)");
      // Null, never zero, when nothing is funded: "we could not price this" and
      // "it costs nothing" are different statements, and only the first holds the
      // Continue button.
      expect(body).toContain("total > 0 ? total : null");
    });

    it("holds Continue until one path is funded and none is under its floor", () => {
      expect(src).toContain("displayBudget == null || underfunded.length > 0 || busy");
      expect(src).toContain("funnelBudgetBelowMinimum(f.key as SalesFunnelKey, funnelBudgetUsd(f.key))");
    });

    it("carries the funding across the Stripe round-trip, without a version bump", () => {
      // The post-payment steps run on a FRESH page load, so state that only lives
      // in React is gone by the time they render. The funding rides the TOP level
      // of the pending blob — version-independent — exactly like the selection it
      // belongs to. A field on the snapshot instead would force a bump, and a bump
      // strands an in-flight checkout.
      expect(src).toContain("funnelBudgets: Record<string, number>");
      expect(src).toContain("funnelBudgets: launchFunnelBudgets");
      expect(src).toContain("isFunnelBudgetMap(parsed.funnelBudgets)");
      expect(src).toContain("ONBOARDING_STATE_VERSION = 8");
      // Read tolerantly: a blob written before per-funnel funding shipped carries
      // none, and it must still LAUNCH — falling back to the single brand write.
      expect(src).toContain("stateBrandFunnelBudgets(pending.brandId, funnelBudgetRows)");
      expect(src).toContain("saveBrandDailyBudget(pending.brandId");
    });
  });

  describe("best-model step explains its ROI", () => {
    it("renders the economics the ROI is computed from above the stats", () => {
      const step = src.indexOf('if (step === "model") {');
      const inputs = src.indexOf("Your numbers", step);
      const stats = src.indexOf("<BestModelStats", step);
      expect(step).toBeGreaterThan(-1);
      expect(inputs).toBeGreaterThan(step);
      expect(stats).toBeGreaterThan(inputs);
    });

    it("edits lifetime revenue alongside the goal's own rate keys", () => {
      const body = sliceFrom("function modelEconomicsKeys(): RateKey[] {", 300);
      expect(body).toContain('return ["ltv", ...RATE_KEYS_FOR_OUTCOME[outcome]];');
    });

    it("arms the button off a live compare, never a sticky edited flag", () => {
      const body = sliceFrom("const economicsDirty = economicsKeys.some(", 400);
      expect(body).toContain("parsed !== rates[k]");
      expect(src).toContain("disabled={!economicsDirty || modelEconomicsBusy}");
    });

    it("writes through the shared payload builder and refreshes the projection", () => {
      const body = sliceFrom("async function saveModelEconomics() {", 2600);
      expect(body).toContain("await buildEconomicsPayload(id, keys, next)");
      expect(body).toContain("rememberSavedEconomics(salesEconomics)");
      // A stale ROI must not sit beside freshly typed inputs.
      const drop = body.indexOf("setBestModelLadder(null)");
      const refetch = body.indexOf("fetchBestModelLadder(id, outcome)");
      expect(drop).toBeGreaterThan(-1);
      expect(refetch).toBeGreaterThan(drop);
      // The stored set is unreadable -> stop, never persist a placeholder over it.
      expect(body).toContain("setModelEconomicsBusy(false);\n      return;");
      for (const restated of [
        "replyToMeetingPct: next.r2m",
        "visitToSignupPct: next.v2s",
        "signupToPaidClientPct: next.s2c",
        "lifetimeRevenueUsd: next.ltv",
      ]) {
        expect(body).not.toContain(restated);
      }
    });
  });
});
