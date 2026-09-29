import { describe, expect, it } from "vitest";
import { splitDailyBudget } from "../src/lib/v2/budget-split";

describe("splitDailyBudget", () => {
  const spendable = {
    runningDailyBudgetCents: 7000,
    campaigns: [
      { campaignId: "herald", runningDailyBudgetCents: 5000 },
      { campaignId: "pilot", runningDailyBudgetCents: 2000 },
      { campaignId: "old-pilot", runningDailyBudgetCents: 0 },
    ],
  };
  it("takes an event crew's cap out of the daily figure", () => {
    expect(splitDailyBudget(spendable, (id) => id.includes("pilot"))).toEqual({ dailyCents: 5000, eventCapCents: 2000 });
  });
  it("leaves the served total alone when nothing is event-triggered", () => {
    expect(splitDailyBudget(spendable, () => false)).toEqual({ dailyCents: 7000, eventCapCents: 0 });
  });
});
