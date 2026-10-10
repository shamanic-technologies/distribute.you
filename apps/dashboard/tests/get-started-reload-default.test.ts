import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creditRunwayDays, RELOAD_OFF_WARNING_DAYS } from "../src/lib/v2/get-started";
import { dailyPaceUsd } from "../src/lib/v2/signup-campaign";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("onboarding credit step: automatic reload on by default, a warning before turning it off (owner 2026-10-06)", () => {
  it("counts the outreach max budget at its daily pace (the meeting budget only spends on replies)", () => {
    expect(dailyPaceUsd({ budget: "24", budgetPeriod: "daily" })).toBe(24);
    expect(dailyPaceUsd({ budget: "168", budgetPeriod: "weekly" })).toBe(24);
  });

  it("says how many whole days the credit lasts, null when nothing spends daily", () => {
    expect(creditRunwayDays(100, 24)).toBe(4);
    expect(creditRunwayDays(100, 0)).toBeNull();
    expect(creditRunwayDays(1000, 24)).toBe(41);
    expect(creditRunwayDays(100, 24)! < RELOAD_OFF_WARNING_DAYS).toBe(true);
  });

  it("starts with the reload ticked and asks before unticking it when the credit runs out soon", () => {
    const src = read("src/components/v2/get-started/prepaid-topup.tsx");
    expect(src).toContain("useState(true)");
    expect(src).not.toContain("const [reloadOn, setReloadOn] = useState(false)");
    expect(src).toContain("RELOAD_OFF_WARNING_DAYS");
    expect(src).toContain("Keep automatic reload");
    expect(src).toContain("Turn off anyway");
  });

  it("both callers pass the daily spend the visitor set", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const src = read(f);
      const at = src.indexOf("<PrepaidTopup");
      expect(at).toBeGreaterThan(-1);
      expect(src.slice(at, src.indexOf("/>", at))).toContain("dailyUsd={dailyUsd}");
    }
    const gs = read("src/components/v2/get-started/get-started.tsx");
    expect(gs.match(/dailyUsd=\{dailyPaceUsd\(campaignDraft\)\}/g)?.length).toBe(2);
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
