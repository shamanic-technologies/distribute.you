import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { topupCta } from "../src/lib/v2/get-started";
import { capWords, consentRecord, spendConsentLines, TERMS_URL, TERMS_VERSION, CATALOG_URL } from "../src/lib/v2/spend-consent";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const day = (usd: number) => ({ amountCents: usd * 100, period: "daily" as const });

describe("three statements ticked before the first payment, both A/B arms (owner 2026-10-11)", () => {
  it("states each cap in the period the customer typed it, never a /30 pace", () => {
    expect(capWords(day(20))).toBe("$20 a day");
    expect(capWords({ amountCents: 9000, period: "monthly" })).toBe("$90 a month");
    expect(capWords({ amountCents: 1000, period: "weekly" })).toBe("$10 a week");
  });

  it("prepaid: the spend, the on-top costs, the same top-up added again with 12-month credit", () => {
    const [spend, onTop, runsOut] = spendConsentLines({
      proactive: day(24),
      reactive: { amountCents: 1200, period: "daily" },
      arm: { kind: "prepaid", topupUsd: 250 },
    });
    expect(spend.text).toBe("My campaigns spend up to $24 a day to find clients, and up to $12 a day more when prospects reply.");
    expect(spend.link).toBeNull();
    expect(onTop.text).toContain("AI chat, extra lead sourcing, new campaigns and payment fees");
    expect(onTop.link?.href).toBe(CATALOG_URL);
    expect(runsOut.text).toContain("$250 is added again automatically");
    expect(runsOut.text).toContain("valid for 12 months");
    expect(runsOut.link?.href).toBe(TERMS_URL);
  });

  it("the plan: moves up one $100 step, no 12-month line (plan credit lasts its month)", () => {
    const [spend, , runsOut] = spendConsentLines({ proactive: day(50), reactive: null, arm: { kind: "plan", monthlyUsd: 99 } });
    expect(spend.text).toBe("My campaigns spend up to $50 a day to find clients.");
    expect(runsOut.text).toContain("my plan moves up to $199 a month");
    expect(runsOut.text).not.toContain("12 months");
  });

  it("no refund wording in the boxes (the Terms carry it)", () => {
    for (const arm of [{ kind: "prepaid", topupUsd: 100 }, { kind: "plan", monthlyUsd: 99 }] as const) {
      for (const l of spendConsentLines({ proactive: day(20), reactive: null, arm })) expect(l.text.toLowerCase()).not.toContain("refund");
    }
  });

  it("the pay button names the match while it can be claimed", () => {
    expect(topupCta(100, "We match your first $100.")).toBe("Pay $100 + get $100 free");
    expect(topupCta(1000, "We match your first $100.")).toBe("Pay $1,000 + get $100 free");
    expect(topupCta(250, "")).toBe("Pay $250 and launch");
  });

  it("prepaid: the reload is required, same amount as the top-up, no switch and no warning dialog", () => {
    const src = read("src/components/v2/get-started/prepaid-topup.tsx");
    expect(src).toContain("reload: { thresholdUsd: DEFAULT_RELOAD_THRESHOLD_USD, amountUsd: firstParsed.usd }");
    expect(src).not.toContain("setReloadOn");
    expect(src).not.toContain("Turn off anyway");
    expect(src).toContain("disabled={off || !allTicked(ticked)}");
  });

  it("both prepaid callers pass the launch plan and the match CTA", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const src = read(f);
      const at = src.indexOf("<PrepaidTopup");
      expect(at).toBeGreaterThan(-1);
      const tag = src.slice(at, src.indexOf("/>", at));
      expect(tag).toContain("plan={plan}");
      expect(tag).toContain("topupCta(usd, matchNote(account))");
    }
  });

  it("the plan's trial button stays off until its three boxes are ticked", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const card = wall.slice(wall.indexOf('{stage === "card" && !cardSecret && ('), wall.indexOf('{stage === "card" && cardSecret && ('));
    expect(card).toContain("<SpendConsent lines={planConsent}");
    expect(card).toContain("disabled={busy || !allTicked(planTicked)}");
    expect(wall).toContain('arm: { kind: "plan", monthlyUsd: Math.round(arm.monthlyCents / 100) }');
  });

  it("asks the email consent once: remembered across the Google round trip, not asked again at the credit step", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).toContain("localStorage.getItem(consentKey)");
    expect(wall).toContain('localStorage.setItem(consentKey, "1")');
    const card = wall.slice(wall.indexOf('{stage === "card" && !cardSecret && ('), wall.indexOf('{stage === "card" && cardSecret && ('));
    expect(card).toContain("{!consentGiven.current && <Consent");
  });

  it("back from Google, a veil covers the page until the wall can open: never the email preview", () => {
    const gs = read("src/components/v2/get-started/get-started.tsx");
    const veil = gs.indexOf("!launchPlan && funnelsState !== \"failed\"");
    expect(veil).toBeGreaterThan(-1);
    expect(veil).toBeLessThan(gs.indexOf("<AccountCardWall"));
    expect(gs.slice(veil, gs.indexOf("<AccountCardWall"))).toContain("Setting up your account...");
  });
});

describe("the ticked statements reach billing with the payment (billing PaymentConsent, owner 2026-10-11)", () => {
  it("records the statements as read, link words included, with the terms version and time", () => {
    const lines = spendConsentLines({ proactive: day(20), reactive: null, arm: { kind: "prepaid", topupUsd: 100 } });
    const r = consentRecord(lines, new Date("2026-10-11T07:00:00Z"), "UA");
    expect(r.statements).toHaveLength(3);
    expect(r.statements[1].endsWith("at our public prices.")).toBe(true);
    expect(r.statements[2].endsWith("See the terms.")).toBe(true);
    expect(r).toMatchObject({ terms_version: TERMS_VERSION, accepted_at: "2026-10-11T07:00:00.000Z", user_agent: "UA" });
    expect(TERMS_VERSION).toBe("2026-10-11");
  });

  it("sends it on the top-up checkout, the plan's card form and the plan start", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain('body: { ui_mode: "embedded", topup_amount_cents, ...(consent ? { consent } : {}) },');
    expect(api).toContain("body: consent ? { consent } : {}");
    expect(read("src/components/v2/get-started/pay-topup.ts")).toContain("createEmbeddedCheckoutSession(params.amountUsd * 100, undefined, params.consent)");
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      expect(read(f)).toContain("consent: choice.consent,");
    }
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    expect(wall).toContain("consent: planConsentRecord.current ?? undefined");
    expect(wall).toContain("await startSubscription(planConsentRecord.current ?? undefined);");
  });
});

