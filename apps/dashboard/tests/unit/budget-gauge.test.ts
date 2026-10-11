import { describe, expect, it } from "vitest";
import { budgetGaugeView } from "../../src/lib/budget-gauge";

const base = { balance_cents: "14230.0000", has_auto_topup: false, has_payment_method: false, topup_threshold_cents: null };

describe("budgetGaugeView", () => {
  it("prepaid: the balance, no bar, pauses at $0", () => {
    expect(budgetGaugeView({ ...base, payment_mode: "prepaid" }, undefined)).toEqual({
      label: "Balance", figure: "$142.30", meter: null, line: "Campaigns pause at $0.", tone: "ok",
    });
  });

  it("prepaid at $0 without auto top-up: stopped", () => {
    const v = budgetGaugeView({ ...base, payment_mode: "prepaid", balance_cents: "-3" }, undefined);
    expect(v).toMatchObject({ figure: "$0.00", tone: "stopped", line: "Add credit to resume." });
  });

  it("postpaid: spent since last charge out of the credit line", () => {
    const v = budgetGaugeView(
      { ...base, payment_mode: "postpaid", balance_cents: "-3800", has_auto_topup: true, has_payment_method: true, topup_threshold_cents: -10000 },
      undefined,
    );
    expect(v).toMatchObject({ label: "Spent since last charge", figure: "$38.00", meter: { value: 3800, max: 10000 }, tone: "ok" });
  });

  it("postpaid with no card: stopped", () => {
    expect(budgetGaugeView({ ...base, payment_mode: "postpaid" }, undefined)).toMatchObject({ tone: "stopped" });
  });

  it("subscription: the month's credit left out of the plan amount", () => {
    const v = budgetGaugeView({ ...base, payment_mode: "subscription" }, {
      credits_remaining_cents: "6100",
      trial_grant_cents: null,
      sending_stopped: false,
      subscription: { status: "active", monthly_amount_cents: 9900, next_charge_at: "2026-11-03T12:00:00Z", trial_end: null, current_period_end: null, cancel_at_period_end: false },
    });
    expect(v).toMatchObject({ label: "Credit left this month", figure: "$61.00", meter: { value: 6100, max: 9900 }, tone: "ok" });
    expect((v as { line: string }).line).toMatch(/^of \$99 · Renews Nov 3$/);
  });

  it("subscription in trial: out of the trial grant", () => {
    const v = budgetGaugeView({ ...base, payment_mode: "subscription" }, {
      credits_remaining_cents: "1000",
      trial_grant_cents: 3000,
      sending_stopped: false,
      subscription: { status: "trialing", monthly_amount_cents: 9900, next_charge_at: null, trial_end: "2026-10-14T12:00:00Z", current_period_end: null, cancel_at_period_end: false },
    });
    expect(v).toMatchObject({ label: "Trial credit left", meter: { value: 1000, max: 3000 } });
  });

  it("subscription not loaded yet: nothing to draw", () => {
    expect(budgetGaugeView({ ...base, payment_mode: "subscription" }, undefined)).toBeNull();
  });

  it("unknown mode is an error, never a figure", () => {
    expect(budgetGaugeView({ ...base, payment_mode: undefined }, undefined)).toHaveProperty("error");
  });
});
