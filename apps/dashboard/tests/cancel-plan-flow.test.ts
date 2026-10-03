import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANCEL_REASONS,
  CANCEL_STEPS,
  LOWEST_PLAN_CENTS,
  nextCancelStep,
  saveOfferFor,
  talkHref,
} from "../src/lib/cancel-plan";

const FLOW = readFileSync(join(__dirname, "..", "src/components/v2/cancel-plan-flow.tsx"), "utf8");
const PLAN = readFileSync(join(__dirname, "..", "src/components/v2/subscription-plan.tsx"), "utf8");

// Owner 2026-10-03: cancelling walks four screens built to make the customer stay,
// and the way out stays one click away on each (online-cancel laws, Stripe disputes).
describe("the cancel-plan flow", () => {
  it("walks loss, reason, offer, confirm, and stops at confirm", () => {
    expect(CANCEL_STEPS).toEqual(["loss", "reason", "offer", "confirm"]);
    expect(nextCancelStep("loss")).toBe("reason");
    expect(nextCancelStep("reason")).toBe("offer");
    expect(nextCancelStep("offer")).toBe("confirm");
    expect(nextCancelStep("confirm")).toBe("confirm");
  });

  it("offers the lowest plan only when price is the reason and the amount can move", () => {
    const plan = { monthlyAmountCents: 29900, canChangeAmount: true };
    expect(saveOfferFor("too_expensive", plan)).toBe("lower_plan");
    expect(saveOfferFor("too_expensive", { ...plan, canChangeAmount: false })).toBe("talk");
    expect(saveOfferFor("too_expensive", { ...plan, monthlyAmountCents: LOWEST_PLAN_CENTS })).toBe("talk");
    for (const r of ["no_results", "need_a_break", "other"] as const) expect(saveOfferFor(r, plan)).toBe("talk");
    expect(saveOfferFor(null, plan)).toBe("talk");
  });

  it("writes to Kevin with the reason in the mail", () => {
    const href = talkHref("no_results");
    expect(href.startsWith("mailto:kevin@distribute.you?")).toBe(true);
    expect(decodeURIComponent(href)).toContain("I am not getting results.");
    expect(decodeURIComponent(talkHref(null))).toContain("I was about to cancel.");
    expect(CANCEL_REASONS.map((r) => r.id)).toEqual(["too_expensive", "no_results", "need_a_break", "other"]);
  });

  it("keeps the way out visible on every screen, and keeping the plan always one click away", () => {
    expect(FLOW).toContain("Continue to cancel");
    // The ghost link renders on every screen but confirm, where the cancel button takes its place.
    expect(FLOW).toContain(') : (\n              continueToCancel\n            )}');
    expect(FLOW).toContain("{keepButton}");
    expect(FLOW).toContain("Cancel my plan");
    // The reason is optional: Continue never waits for a pick.
    expect(FLOW).not.toMatch(/disabled=\{[^}]*reason/);
  });

  it("shows the customer's own served counts, never a computed figure", () => {
    expect(FLOW).toContain("useBucketCounts(brandId)");
    for (const f of ["counts?.contacted", "counts?.positive_reply", "counts?.meeting_booked"]) expect(FLOW).toContain(f);
  });

  it("lowers through billing's own amount change, and cancels through billing's cancel", () => {
    expect(PLAN).toContain('onLowerPlan={() => void run("amount", () => changeSubscriptionAmount(LOWEST_PLAN_CENTS))}');
    expect(PLAN).toContain('onCancel={() => void run("cancel", () => cancelSubscription())}');
    expect(PLAN).toContain("canChangeAmount={!locked}");
  });

  it("draws in v2 tokens, no em-dash in copy, no side accent", () => {
    expect(FLOW).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|border-l-|border-t-\[|border-r-/);
    const code = FLOW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace('<span className="k-fg4">—</span>', "");
    expect(code).not.toContain("—");
    expect(FLOW).toContain('getElementById("v2-portal")');
    expect(FLOW).toContain('e.key === "Escape"');
  });
});
