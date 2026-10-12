import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { topupCta } from "../src/lib/v2/get-started";
import { consentRecord, spendConsentLines, statementAsShown, TERMS_URL, TERMS_VERSION, CATALOG_URL } from "../src/lib/v2/spend-consent";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("three statements ticked before the first payment, both A/B arms (owner 2026-10-11, reworded 2026-10-12)", () => {
  const COVERS =
    "I understand that my credit covers my campaigns and what I use myself, as well as everything done on my account on my behalf to get me the best results: brand setup, onboarding, A/B testing and more, as detailed in your public prices.";
  const TERMS = "I have read and accept the terms and conditions.";

  it("the plan: what the credit covers, the ladder built from the plan amount, the terms", () => {
    const lines = spendConsentLines({ arm: { kind: "plan", monthlyUsd: 99 } });
    expect(lines.map(statementAsShown)).toEqual([
      COVERS,
      "I understand that each time my credit runs out, my plan upgrades automatically ($199, then $299, and so on) and my card is charged accordingly, so my campaigns keep running as I set them.",
      TERMS,
    ]);
    expect(lines[0].link?.href).toBe(CATALOG_URL);
    expect(lines[2].link?.href).toBe(TERMS_URL);
    // Never a hardcoded ladder: a $199 plan climbs from $299.
    expect(spendConsentLines({ arm: { kind: "plan", monthlyUsd: 199 } })[1].text).toContain("($299, then $399, and so on)");
  });

  it("prepaid: boxes 1 and 3 identical to the plan's, box 2 keeps its own reload sentence", () => {
    const [covers, runsOut, terms] = spendConsentLines({ arm: { kind: "prepaid", topupUsd: 250 } });
    expect(statementAsShown(covers)).toBe(COVERS);
    expect(statementAsShown(terms)).toBe(TERMS);
    expect(runsOut.text).toBe("When my credit runs out, $250 is added again automatically. Credit stays valid for 12 months.");
    expect(runsOut.link).toBeNull();
  });

  it("no campaign cap, no refund wording, no em-dash in the boxes", () => {
    for (const arm of [{ kind: "prepaid", topupUsd: 100 }, { kind: "plan", monthlyUsd: 99 }] as const) {
      for (const l of spendConsentLines({ arm })) {
        const t = statementAsShown(l);
        expect(t.toLowerCase()).not.toContain("refund");
        expect(t).not.toContain("My campaigns spend up to");
        expect(t).not.toMatch(/[\u2013\u2014]/);
      }
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

  it("both prepaid callers pass the match CTA", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const src = read(f);
      const at = src.indexOf("<PrepaidTopup");
      expect(at).toBeGreaterThan(-1);
      const tag = src.slice(at, src.indexOf("/>", at));
      expect(tag).toContain("topupCta(usd, matchNote(account))");
    }
  });

  it("the plan's trial button stays off until its three boxes are ticked", () => {
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    const card = wall.slice(wall.indexOf('{stage === "card" && !cardSecret && ('), wall.indexOf('{stage === "card" && cardSecret && ('));
    expect(card).toContain("<SpendConsent lines={planConsent}");
    expect(card).toContain("disabled={busy || !allTicked(planTicked)}");
    expect(wall).toContain('spendConsentLines({ arm: { kind: "plan", monthlyUsd: Math.round(arm.monthlyCents / 100) } })');
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
    const lines = spendConsentLines({ arm: { kind: "plan", monthlyUsd: 99 } });
    const r = consentRecord(lines, new Date("2026-10-11T07:00:00Z"), "UA");
    expect(r.statements).toHaveLength(3);
    expect(r.statements[0].endsWith("as detailed in your public prices.")).toBe(true);
    expect(r.statements[1]).toContain("($199, then $299, and so on)");
    expect(r.statements[2]).toBe("I have read and accept the terms and conditions.");
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

