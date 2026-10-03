import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANCEL_REASONS,
  CANCEL_LOSS_STEPS,
  CANCEL_STEPS,
  lossStep,
  LOWEST_PLAN_CENTS,
  PAUSE_MONTHS,
  STAY_MIN_USD,
  nextCancelStep,
  stayAmountCents,
  saveOfferFor,
  talkHref,
} from "../src/lib/cancel-plan";

const FLOW = readFileSync(join(__dirname, "..", "src/components/v2/cancel-plan-flow.tsx"), "utf8");
const PLAN = readFileSync(join(__dirname, "..", "src/components/v2/subscription-plan.tsx"), "utf8");

// Owner 2026-10-03: cancelling walks four screens built to make the customer stay,
// and the way out stays one click away on each (online-cancel laws, Stripe disputes).
describe("the cancel-plan flow", () => {
  // Owner 2026-10-03: one screen per loss, each a red cross, what stops now, and what staying keeps.
  it("walks one screen per loss, then reason, offer, confirm, and stops at confirm", () => {
    expect(CANCEL_STEPS).toEqual([
      "loss_outreach",
      "loss_follow_ups",
      "loss_replies",
      "loss_contacts",
      "loss_history",
      "reason",
      "offer",
      "confirm",
    ]);
    expect(nextCancelStep("loss_outreach")).toBe("loss_follow_ups");
    expect(nextCancelStep("loss_history")).toBe("reason");
    expect(nextCancelStep("reason")).toBe("offer");
    expect(nextCancelStep("offer")).toBe("confirm");
    expect(nextCancelStep("confirm")).toBe("confirm");
    for (const l of CANCEL_LOSS_STEPS) {
      expect(l.loss, l.id).toMatch(/now|from now on|every email/);
      expect(l.keep.startsWith("Stay, and"), l.id).toBe(true);
      expect(lossStep(l.id)).toBe(l);
    }
    expect(lossStep("reason")).toBeNull();
    expect(FLOW).toContain("<LossMark />");
    expect(FLOW).toContain("<KeepMark />");
    expect(FLOW).toContain("Everything stops the moment you cancel.");
  });

  // Owner 2026-10-03: even at $99, price is answered with "stay for less" from $29.
  it("offers to stay for less whenever price is the reason and the amount can move", () => {
    const plan = { monthlyAmountCents: 29900, canChangeAmount: true, canPause: false };
    expect(saveOfferFor("too_expensive", plan)).toBe("lower_plan");
    expect(saveOfferFor("too_expensive", { ...plan, monthlyAmountCents: LOWEST_PLAN_CENTS })).toBe("lower_plan");
    expect(saveOfferFor("too_expensive", { ...plan, canChangeAmount: false })).toBe("talk");
    for (const r of ["no_results", "need_a_break", "other"] as const) expect(saveOfferFor(r, plan)).toBe("talk");
    expect(saveOfferFor(null, plan)).toBe("talk");
  });

  it("offers a pause for a break, and for price when the amount cannot move", () => {
    const plan = { monthlyAmountCents: LOWEST_PLAN_CENTS, canChangeAmount: false, canPause: true };
    expect(saveOfferFor("need_a_break", plan)).toBe("pause");
    expect(saveOfferFor("too_expensive", plan)).toBe("pause");
    expect(saveOfferFor("too_expensive", { ...plan, canChangeAmount: true })).toBe("lower_plan");
    expect(saveOfferFor("need_a_break", { ...plan, canPause: false })).toBe("talk");
    expect(saveOfferFor("no_results", plan)).toBe("talk");
    expect(PAUSE_MONTHS).toEqual([1, 2, 3]);
  });

  // Owner 2026-10-03: a stepper makes reaching the end feel like the goal.
  it("shows no step counter and no progress bar", () => {
    expect(FLOW).not.toMatch(/Step \{|of \{CANCEL_STEPS|stepIndex/);
  });

  it("pauses through billing, and shows a paused plan with a way to restart", () => {
    expect(PLAN).toContain('onPause={(months) => void run("pause", () => pauseSubscription(months))}');
    expect(PLAN).toContain("canPause={sub.can_pause === true}");
    expect(PLAN).toContain('run("unpause", () => unpauseSubscription())');
    expect(PLAN).toContain('label: "Paused"');
  });

  it("takes any whole-dollar amount from $29, prefilled with $99", () => {
    expect(stayAmountCents("99")).toBe(9900);
    expect(stayAmountCents("$47")).toBe(4700);
    expect(stayAmountCents(" 29 ")).toBe(2900);
    for (const bad of ["28", "0", "", "29.5", "abc", "-40"]) expect(stayAmountCents(bad), bad).toBeNull();
    expect(STAY_MIN_USD).toBe(29);
    expect(FLOW).toContain("useState(String(LOWEST_PLAN_CENTS / 100))");
  });

  // Owner 2026-10-03: a trial that accepts is charged now, then the flow celebrates.
  it("charges a trial now, changes a paid plan from the next charge, then celebrates", () => {
    expect(PLAN).toContain('run("amount", () => startSubscriptionNow(cents), { keepFlowOpen: true })');
    expect(PLAN).toContain('run("amount", () => changeSubscriptionAmount(cents), { keepFlowOpen: true })');
    expect(FLOW).toContain("<ConfettiBurst />");
    expect(FLOW).toContain("void onStay(stayCents).then((ok) => ok && setStayedCents(stayCents))");
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

  // billing#589: a cancel stops every send at once, and the read says so.
  it("says sending has stopped after a cancel, from billing's own flag", () => {
    expect(PLAN).toContain("data.sending_stopped");
    expect(PLAN).toContain("Cancelled. All sending has stopped.");
    expect(PLAN).not.toContain("Sending stops on");
    expect(PLAN).toContain('code === "amount_below_minimum"');
  });

  it("cancels through billing's cancel", () => {
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
