import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner 2026-10-05: a subscriber's $99 plan reads "$90/month" + "Up to $9/month" (how the
// $99 is shared), never its /30 daily pace "$3/day". The Budget cell prints billing's
// budget in the unit it was stated in.
const src = readFileSync(join(__dirname, "../src/components/v2/offer-campaigns.tsx"), "utf8");
const cell = src.slice(src.indexOf("function CampaignBudget("), src.indexOf("function parseWholeUsd("));

describe("offer Campaigns Budget cell unit", () => {
  it("labels the stated budget with its own period, not the daily pace", () => {
    expect(src).toContain("`${fmtDailyBudgetUsd(cents)}/${period}`");
    expect(cell).toContain("budget?.budgetCents");
    expect(cell).not.toContain("dailyBudgetCents");
  });

  it("the modal speaks the same unit", () => {
    expect(src).toContain('<span className="k-fg2">/ {unit}</span>');
    expect(src).toContain('"Monthly budget"');
  });
});
