import { describe, it, expect } from "vitest";
import {
  campaignDailyBudgetCents,
  isActiveDailyBudgetCampaign,
  computeRunway,
  runwaySeverity,
} from "../src/lib/campaign-runway";
import type { Campaign } from "../src/lib/api";

// Minimal Campaign-shaped factory — the runway logic only reads status + budgets.
function camp(over: Partial<Campaign> = {}): Campaign {
  return {
    id: over.id ?? "c1",
    name: over.name ?? "Campaign",
    status: over.status ?? "running",
    workflowSlug: null,
    featureSlug: null,
    brandIds: [],
    brandUrls: [],
    featureInputs: null,
    maxBudgetDailyUsd: over.maxBudgetDailyUsd ?? null,
    maxBudgetWeeklyUsd: over.maxBudgetWeeklyUsd ?? null,
    maxBudgetMonthlyUsd: over.maxBudgetMonthlyUsd ?? null,
    maxBudgetTotalUsd: over.maxBudgetTotalUsd ?? null,
    endDate: null,
    toResumeAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("campaignDailyBudgetCents", () => {
  it("daily budget → value in cents", () => {
    expect(campaignDailyBudgetCents(camp({ maxBudgetDailyUsd: "25" }))).toBe(2500);
  });
  it("weekly budget → value / 7", () => {
    expect(campaignDailyBudgetCents(camp({ maxBudgetWeeklyUsd: "70" }))).toBe(1000);
  });
  it("monthly budget → value / 30", () => {
    expect(campaignDailyBudgetCents(camp({ maxBudgetMonthlyUsd: "30" }))).toBe(100);
  });
  it("one-off (total only) → null", () => {
    expect(campaignDailyBudgetCents(camp({ maxBudgetTotalUsd: "100" }))).toBeNull();
  });
  it("no budget → null", () => {
    expect(campaignDailyBudgetCents(camp())).toBeNull();
  });
});

describe("isActiveDailyBudgetCampaign", () => {
  it("stopped daily-budget campaign → false", () => {
    expect(isActiveDailyBudgetCampaign(camp({ status: "stopped", maxBudgetDailyUsd: "25" }))).toBe(false);
  });
  it("running + daily → true", () => {
    expect(isActiveDailyBudgetCampaign(camp({ status: "running", maxBudgetDailyUsd: "25" }))).toBe(true);
  });
  it("running + one-off only → false", () => {
    expect(isActiveDailyBudgetCampaign(camp({ status: "running", maxBudgetTotalUsd: "100" }))).toBe(false);
  });
});

describe("computeRunway", () => {
  it("$25 balance at $25/day → 1 day, not depleted", () => {
    const r = computeRunway([camp({ maxBudgetDailyUsd: "25" })], { balance_cents: "2500" });
    expect(r.runwayDays).toBe(1);
    expect(r.dailyBurnCents).toBe(2500);
    expect(r.activeDailyBudgetCount).toBe(1);
    expect(r.depleted).toBe(false);
  });
  it("sums burn across multiple active daily-budget campaigns", () => {
    const r = computeRunway(
      [camp({ id: "a", maxBudgetDailyUsd: "10" }), camp({ id: "b", maxBudgetDailyUsd: "15" })],
      { balance_cents: "10000" },
    );
    expect(r.dailyBurnCents).toBe(2500);
    expect(r.runwayDays).toBe(4);
    expect(r.activeDailyBudgetCount).toBe(2);
  });
  it("ignores stopped + one-off campaigns in the burn", () => {
    const r = computeRunway(
      [
        camp({ id: "a", status: "stopped", maxBudgetDailyUsd: "100" }),
        camp({ id: "b", maxBudgetTotalUsd: "100" }),
        camp({ id: "c", maxBudgetDailyUsd: "25" }),
      ],
      { balance_cents: "5000" },
    );
    expect(r.dailyBurnCents).toBe(2500);
    expect(r.activeDailyBudgetCount).toBe(1);
  });
  it("balance 0 → depleted, runwayDays 0", () => {
    const r = computeRunway([camp({ maxBudgetDailyUsd: "25" })], { balance_cents: "0" });
    expect(r.depleted).toBe(true);
    expect(r.runwayDays).toBe(0);
  });
  it("no active daily-budget campaign → burn 0, runwayDays null", () => {
    const r = computeRunway([camp({ maxBudgetTotalUsd: "100" })], { balance_cents: "5000" });
    expect(r.dailyBurnCents).toBe(0);
    expect(r.runwayDays).toBeNull();
  });
});

describe("runwaySeverity", () => {
  const base = { dailyBurnCents: 2500, activeDailyBudgetCount: 1, depleted: false };
  it("auto-topup on → null (safety net in place)", () => {
    expect(runwaySeverity({ ...base, runwayDays: 0 }, true)).toBeNull();
  });
  it("runway 1 day, no auto-topup → urgent", () => {
    expect(runwaySeverity({ ...base, runwayDays: 1 }, false)).toBe("urgent");
  });
  it("runway 3 days → warning", () => {
    expect(runwaySeverity({ ...base, runwayDays: 3 }, false)).toBe("warning");
  });
  it("runway 10 days → null", () => {
    expect(runwaySeverity({ ...base, runwayDays: 10 }, false)).toBeNull();
  });
  it("no active daily-budget campaign → null", () => {
    expect(runwaySeverity({ ...base, activeDailyBudgetCount: 0, runwayDays: null }, false)).toBeNull();
  });
  it("depleted (0 days) → urgent", () => {
    expect(runwaySeverity({ ...base, runwayDays: 0, depleted: true }, false)).toBe("urgent");
  });
});
