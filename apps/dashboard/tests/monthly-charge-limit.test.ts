import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_LIMIT_USD, firstChargeUsd, monthlyLimitToSave, parseMonthlyLimitUsd } from "../src/lib/v2/monthly-limit";
import { DEFAULT_SIGNUP_DRAFT, parseSignupDraft } from "../src/lib/v2/signup-campaign";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("monthly charge limit (owner 2026-10-12: never charge me more than $X a month)", () => {
  it("prefills $9,000 a month (owner 2026-10-12)", () => {
    expect(DEFAULT_MONTHLY_LIMIT_USD).toBe(9000);
    expect(monthlyLimitToSave(null, { kind: "prepaid", topupUsd: 100 })).toEqual({ usd: 9000 });
  });

  it("refuses a typed limit under the first charge, whole dollars only", () => {
    expect(firstChargeUsd({ kind: "prepaid", topupUsd: 99 })).toBe(99);
    expect(parseMonthlyLimitUsd("$1,000", 99)).toEqual({ usd: 1000 });
    expect(parseMonthlyLimitUsd("50", 99)).toEqual({ problem: "Your monthly limit starts at $99." });
    expect(parseMonthlyLimitUsd("12.5", 1)).toEqual({ problem: "Set your monthly limit in whole dollars." });
  });

  it("untouched = $9,000; typed wins; both checked against the first charge", () => {
    expect(monthlyLimitToSave(null, { kind: "prepaid", topupUsd: 250 })).toEqual({ usd: 9000 });
    expect(monthlyLimitToSave("400", { kind: "prepaid", topupUsd: 250 })).toEqual({ usd: 400 });
    expect(monthlyLimitToSave("200", { kind: "prepaid", topupUsd: 250 })).toEqual({ problem: "Your monthly limit starts at $250." });
  });

  it("the draft carries the typed limit across a reload, null while untouched", () => {
    expect(DEFAULT_SIGNUP_DRAFT.monthlyLimit).toBeNull();
    expect(parseSignupDraft({ monthlyLimit: "500" })?.monthlyLimit).toBe("500");
    expect(parseSignupDraft({})?.monthlyLimit).toBeNull();
  });

  it("the campaign step shows the line on signup only, right after the budgets", () => {
    const gs = read("src/components/v2/get-started/get-started.tsx");
    expect(gs).toContain("limitPrefillUsd={org ? null : DEFAULT_MONTHLY_LIMIT_USD}");
    const stage = gs.slice(gs.indexOf("export function CampaignStage("), gs.indexOf("function ValueStage("));
    expect(stage).toContain(">Never spend more than</span>");
    expect(stage).toContain(">per month</span>");
    expect(stage.indexOf(">Never spend more than</span>")).toBeGreaterThan(stage.indexOf('label="Max budget in dollars"'));
    expect(gs).toContain("monthlyLimit={campaignDraft.monthlyLimit}");
    // Onboarding shows the ONE line: no meter, no "Remove limit" (Billing only, owner 2026-10-12).
    expect(stage).not.toContain("Remove limit");
    expect(stage).not.toContain("<Meter");
    expect(stage).not.toContain("MonthlyLimitCard");
  });

  it("the wall saves the limit to billing before any charge", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const pay = wall.slice(wall.indexOf("async function pay(choice: TopupChoice)"), wall.indexOf("async function afterPaid("));
    expect(pay.indexOf("await saveMonthlyLimit(limit.usd);")).toBeGreaterThan(-1);
    expect(pay.indexOf("await saveMonthlyLimit(limit.usd);")).toBeLessThan(pay.indexOf("await payTopup("));
    expect(wall).toContain("await setMonthlyChargeLimit(usd * 100);");
  });

  it("Billing's card states a SPEND cap and its bar reads the month's spend, never card charges (owner 2026-10-21)", () => {
    const card = read("src/components/v2/monthly-limit-card.tsx");
    expect(card).toContain(">Never spend more than</span>");
    expect(card).toContain(">per month</span>");
    expect(card).not.toContain("spend at most");
    expect(card).toContain(">No monthly spend limit.</span>");
    expect(card).toContain("const spentRaw = data.spent_this_period_cents;");
    expect(card).toContain("<Meter value={spent} max={limitCents} />");
    // The month is NAMED: "this month" read as a third figure beside the Balance card's
    // since-last-charge one (2026-11-02).
    expect(card).toContain("spent in {periodMonth(data.period_start)}, provisioned included");
    expect(card).not.toContain("charged_this_period_cents");
    expect(card).not.toContain("charged this month");
    expect(card).not.toContain("Never charge me");
    const api = read("src/lib/api.ts");
    expect(api).toContain("spent_this_period_cents: z.union([z.number(), z.string()]).nullable().optional(),");
  });

  it("Billing shows and edits it, through the gateway route", () => {
    expect(read("src/components/v2/billing-page.tsx")).toContain("<MonthlyLimitCard />");
    expect(read("src/components/v2/billing-page.tsx")).toContain('description="Your campaigns stop once they spend this much in a calendar month."');
    const api = read("src/lib/api.ts");
    expect(api).toContain('"/billing/accounts/monthly_charge_limit", { token, method: "PUT", body: { monthly_charge_limit_cents: cents } }');
  });
});
