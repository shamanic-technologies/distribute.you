import { describe, it, expect } from "vitest";
import {
  buildBudgetParams,
  deriveBudgetFromCampaign,
} from "../src/components/campaigns/relaunch-campaign-modal";

type BudgetSubset = Parameters<typeof deriveBudgetFromCampaign>[0];

const empty: BudgetSubset = {
  maxBudgetDailyUsd: null,
  maxBudgetWeeklyUsd: null,
  maxBudgetMonthlyUsd: null,
  maxBudgetTotalUsd: null,
};

describe("deriveBudgetFromCampaign", () => {
  it("returns daily when daily is set", () => {
    expect(deriveBudgetFromCampaign({ ...empty, maxBudgetDailyUsd: "10" }))
      .toEqual({ amount: "10", frequency: "daily" });
  });

  it("returns weekly when weekly is set", () => {
    expect(deriveBudgetFromCampaign({ ...empty, maxBudgetWeeklyUsd: "50" }))
      .toEqual({ amount: "50", frequency: "weekly" });
  });

  it("returns monthly when monthly is set", () => {
    expect(deriveBudgetFromCampaign({ ...empty, maxBudgetMonthlyUsd: "200" }))
      .toEqual({ amount: "200", frequency: "monthly" });
  });

  it("returns one-off when only total is set", () => {
    expect(deriveBudgetFromCampaign({ ...empty, maxBudgetTotalUsd: "500" }))
      .toEqual({ amount: "500", frequency: "one-off" });
  });

  it("prefers daily over the others when multiple are set", () => {
    expect(deriveBudgetFromCampaign({
      maxBudgetDailyUsd: "10",
      maxBudgetWeeklyUsd: "50",
      maxBudgetMonthlyUsd: "200",
      maxBudgetTotalUsd: "500",
    })).toEqual({ amount: "10", frequency: "daily" });
  });

  it("returns null when no budget is set", () => {
    expect(deriveBudgetFromCampaign(empty)).toBeNull();
  });
});

describe("buildBudgetParams", () => {
  it("maps one-off to maxBudgetTotalUsd only", () => {
    expect(buildBudgetParams("500", "one-off")).toEqual({ maxBudgetTotalUsd: "500" });
  });

  it("maps daily to maxBudgetDailyUsd only", () => {
    expect(buildBudgetParams("10", "daily")).toEqual({ maxBudgetDailyUsd: "10" });
  });

  it("maps weekly to maxBudgetWeeklyUsd only", () => {
    expect(buildBudgetParams("50", "weekly")).toEqual({ maxBudgetWeeklyUsd: "50" });
  });

  it("maps monthly to maxBudgetMonthlyUsd only", () => {
    expect(buildBudgetParams("200", "monthly")).toEqual({ maxBudgetMonthlyUsd: "200" });
  });

  it("never sets more than one budget field at a time", () => {
    for (const freq of ["one-off", "daily", "weekly", "monthly"] as const) {
      const params = buildBudgetParams("123", freq);
      expect(Object.keys(params)).toHaveLength(1);
    }
  });
});
