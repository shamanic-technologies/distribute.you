import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyBudgetHidden } from "../src/lib/payment-mode";

// Owner 2026-10-03: a plan ($99/month and up) runs each brand x offer at a fixed
// $50/day (+$25/day on replies). Not a choice: never shown, never editable, and no
// "confirm your budget" step in onboarding.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("dailyBudgetHidden", () => {
  it("hides the budget from a subscriber", () => {
    expect(dailyBudgetHidden({ payment_mode: "subscription", has_payment_method: true }, true)).toBe(true);
  });

  it("shows it to a prepaid or postpaid org once billing answered", () => {
    expect(dailyBudgetHidden({ payment_mode: "prepaid", has_payment_method: false }, true)).toBe(false);
    expect(dailyBudgetHidden({ payment_mode: "postpaid", has_payment_method: true }, true)).toBe(false);
  });

  it("hides it until billing answered, so a subscriber never sees one flash in", () => {
    expect(dailyBudgetHidden(undefined, false)).toBe(true);
    expect(dailyBudgetHidden({ payment_mode: "prepaid", has_payment_method: false }, false)).toBe(true);
  });

  it("shows it when billing could not be read (an errored read is not a plan)", () => {
    expect(dailyBudgetHidden(undefined, true)).toBe(false);
  });
});

describe("every dashboard surface that states a daily budget asks whether to hide it", () => {
  it("the controls state Pause/Activate alone: no per-campaign budget figure for anyone", () => {
    const trigger = read("src/components/campaigns/campaign-controls-trigger.tsx");
    expect(trigger).not.toContain("fmtDailyBudgetUsd");
  });

  it("the billing modal drops its budget words and presets for a plan", () => {
    const guard = read("src/lib/billing-guard.tsx");
    expect(guard).toContain('const onPlan = paymentModeOf(account) === "subscription";');
    expect(guard).toContain("const brandDailyBudgetCents = onPlan ? null :");
  });
});

describe("the onboarding wall asks no daily budget", () => {
  it("budgets are set per campaign at the campaigns step; the wall asks credit or a card only", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).not.toContain("budgetRow");
    expect(wall).not.toContain("marginOk");
    // The plan is sold only to its homepage A/B arm (owner 2026-10-10, three arms 2026-10-13), never by default.
    expect(wall).toContain("offer: offerArm(cookie)");
    expect(wall).toContain('const isPlan = sold === "subscription";');
  });
});
