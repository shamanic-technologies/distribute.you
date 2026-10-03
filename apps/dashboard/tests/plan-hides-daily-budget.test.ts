import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyBudgetHidden } from "../src/lib/payment-mode";
import {
  planMissionBudgetUsd,
  SUBSCRIPTION_OUTBOUND_DAILY_USD,
  SUBSCRIPTION_REACTIVE_DAILY_USD,
} from "../src/lib/subscription-plan";

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

describe("planMissionBudgetUsd", () => {
  it("starts the first outbound mission of an offer at the plan's $50", () => {
    expect(planMissionBudgetUsd({ fromKey: null }, [])).toBe(SUBSCRIPTION_OUTBOUND_DAILY_USD);
  });

  it("starts the first reply mission at the plan's $25", () => {
    expect(planMissionBudgetUsd({ fromKey: "positive_reply" }, [{ fromKey: null }])).toBe(SUBSCRIPTION_REACTIVE_DAILY_USD);
  });

  it("funds no second mission of a kind the plan already funds on that offer", () => {
    expect(planMissionBudgetUsd({ fromKey: null }, [{ fromKey: null }])).toBeNull();
    expect(planMissionBudgetUsd({ fromKey: "positive_reply" }, [{ fromKey: "positive_reply" }])).toBeNull();
  });
});

describe("every dashboard surface that states a daily budget asks whether to hide it", () => {
  const surfaces = [
    "src/components/campaigns/campaign-controls-trigger.tsx",
    "src/components/settings/campaign-settings-card.tsx",
    "src/components/v2/mission-page.tsx",
    "src/components/v2/missions-page.tsx",
    "src/components/v2/crew-page.tsx",
    "src/components/v2/setup-pages.tsx",
    "src/components/v2/work-page.tsx",
    "src/components/v2/add-mission-modal.tsx",
    "src/components/v2/offer-sales-path-page.tsx",
  ];
  for (const f of surfaces) {
    it(f, () => {
      expect(read(f)).toContain("const budgetHidden = useDailyBudgetHidden();");
    });
  }

  it("the controls keep Pause/Activate and drop the budget figure", () => {
    const trigger = read("src/components/campaigns/campaign-controls-trigger.tsx");
    expect(trigger).toContain("{!budgetHidden && (\n          <span className=\"k-fg2 text-[13px] tabular-nums\">");
  });

  it("a subscriber's new mission writes the plan's figure, never a typed one", () => {
    const add = read("src/components/v2/add-mission-modal.tsx");
    expect(add).toContain("const typed = budgetHidden ? planUsd : budget.trim()");
  });

  it("the billing modal drops its budget words and presets for a plan", () => {
    const guard = read("src/lib/billing-guard.tsx");
    expect(guard).toContain('const onPlan = paymentModeOf(account) === "subscription";');
    expect(guard).toContain("const brandDailyBudgetCents = onPlan ? null :");
  });
});

describe("onboarding asks no budget of a subscriber", () => {
  it("the /get-started wall shows no budget row and no margin box on the plan", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).toContain('{!subscription && <div className="k-inset rounded-lg p-3">{budgetRow}</div>}');
    // No margin box anywhere since the one pot (owner 2026-10-03).
    expect(wall).not.toContain("marginOk");
  });

  it("v1 /onboarding writes the plan's money and skips the budget step", () => {
    const flow = read("src/components/onboarding/onboarding.tsx");
    expect(flow).toContain('setCampaignBudgets(subscriptionBudgets(launchPairs));\n      setStep("bonus");');
    expect(flow).toContain("if (subscriptionArm) return null;\n  const displayBudget = budgetForCharge();");
  });
});
