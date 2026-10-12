import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_LIMIT_USD, firstChargeUsd, monthlyLimitToSave, parseMonthlyLimitUsd } from "../src/lib/v2/monthly-limit";
import { spendConsentLines } from "../src/lib/v2/spend-consent";
import { DEFAULT_SIGNUP_DRAFT, parseSignupDraft } from "../src/lib/v2/signup-campaign";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("monthly charge limit (owner 2026-10-12: never charge me more than $X a month)", () => {
  it("prefills $2,000 a month on both arms (owner 2026-10-12)", () => {
    expect(DEFAULT_MONTHLY_LIMIT_USD).toBe(2000);
    expect(monthlyLimitToSave(null, { kind: "plan", monthlyUsd: 99 })).toEqual({ usd: 2000 });
    expect(monthlyLimitToSave(null, { kind: "prepaid", topupUsd: 100 })).toEqual({ usd: 2000 });
  });

  it("refuses a typed limit under the first charge, whole dollars only", () => {
    expect(firstChargeUsd({ kind: "plan", monthlyUsd: 99 })).toBe(99);
    expect(parseMonthlyLimitUsd("$1,000", 99)).toEqual({ usd: 1000 });
    expect(parseMonthlyLimitUsd("50", 99)).toEqual({ problem: "Your monthly limit starts at $99." });
    expect(parseMonthlyLimitUsd("12.5", 1)).toEqual({ problem: "Set your monthly limit in whole dollars." });
  });

  it("untouched = $2,000; typed wins; both checked against the first charge", () => {
    expect(monthlyLimitToSave(null, { kind: "prepaid", topupUsd: 250 })).toEqual({ usd: 2000 });
    expect(monthlyLimitToSave("400", { kind: "prepaid", topupUsd: 250 })).toEqual({ usd: 400 });
    expect(monthlyLimitToSave("200", { kind: "prepaid", topupUsd: 250 })).toEqual({ problem: "Your monthly limit starts at $250." });
  });

  it("box 2 of the plan names the limit", () => {
    const [, ladder] = spendConsentLines({ arm: { kind: "plan", monthlyUsd: 99, limitUsd: 299 } });
    expect(ladder.text).toBe(
      "I understand that each time my credit runs out, my plan upgrades automatically ($199, then $299, and so on, up to my $299 monthly limit) and my card is charged accordingly, so my campaigns keep running as I set them.",
    );
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
    expect(stage).toContain(">Never charge me more than</span>");
    expect(stage).toContain(">a month</span>");
    expect(stage.indexOf(">Never charge me more than</span>")).toBeGreaterThan(stage.indexOf('label="Max budget in dollars"'));
    expect(gs).toContain("monthlyLimit={campaignDraft.monthlyLimit}");
    // Onboarding shows the ONE line: no meter, no "Remove limit" (Billing only, owner 2026-10-12).
    expect(stage).not.toContain("Remove limit");
    expect(stage).not.toContain("<Meter");
    expect(stage).not.toContain("MonthlyLimitCard");
  });

  it("the wall saves the limit to billing before any charge, on both arms", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const pay = wall.slice(wall.indexOf("async function pay(choice: TopupChoice)"), wall.indexOf("async function afterPaid("));
    expect(pay.indexOf("await saveMonthlyLimit(limit.usd);")).toBeGreaterThan(-1);
    expect(pay.indexOf("await saveMonthlyLimit(limit.usd);")).toBeLessThan(pay.indexOf("await payTopup("));
    const trial = wall.slice(wall.indexOf("async function openTrialCheckout()"), wall.indexOf("async function afterTrialCardSaved()"));
    expect(trial.indexOf("await saveMonthlyLimit(planLimit.usd);")).toBeGreaterThan(-1);
    expect(trial.indexOf("await saveMonthlyLimit(planLimit.usd);")).toBeLessThan(trial.indexOf("createSubscriptionCheckout("));
    expect(wall).toContain("await setMonthlyChargeLimit(usd * 100);");
  });

  it("Billing shows and edits it, through the gateway route", () => {
    expect(read("src/components/v2/billing-page.tsx")).toContain("<MonthlyLimitCard />");
    const api = read("src/lib/api.ts");
    expect(api).toContain('"/billing/accounts/monthly_charge_limit", { token, method: "PUT", body: { monthly_charge_limit_cents: cents } }');
  });
});
