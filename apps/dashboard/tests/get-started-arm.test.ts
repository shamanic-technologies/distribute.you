import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GS_ARM_COPY, GS_ARM_WEIGHTS, adaptiveGsArmWeights, decideGsArm, drawGsArm, walkStepNumber, walkSteps } from "../src/lib/v2/get-started-arm";
import { rowsToGsArmStats } from "../src/lib/v2/get-started-arm-split";

const walk = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
const page = readFileSync(join(__dirname, "../src/app/(authed)/get-started/page.tsx"), "utf8");

describe("get-started A/B: 50% emails, 50% leads (owner 2026-10-17)", () => {
  it("draws 50 / 50", () => {
    expect(GS_ARM_WEIGHTS).toEqual({ emails: 0.5, leads: 0.5 });
    expect(drawGsArm(0)).toBe("emails");
    expect(drawGsArm(0.49)).toBe("emails");
    expect(drawGsArm(0.5)).toBe("leads");
    expect(drawGsArm(0.99)).toBe("leads");
  });

  it("keeps the cookie, lets ?gs_arm= force one, draws otherwise", () => {
    expect(decideGsArm({ query: null, cookie: "emails", random: 0.9 })).toEqual({ arm: "emails", fresh: false });
    expect(decideGsArm({ query: "leads", cookie: "emails", random: 0 })).toEqual({ arm: "leads", fresh: true });
    expect(decideGsArm({ query: null, cookie: "junk", random: 0.5 })).toEqual({ arm: "leads", fresh: true });
    expect(decideGsArm({ query: null, cookie: undefined, random: 0.1 })).toEqual({ arm: "emails", fresh: true });
  });

  it("the leads arm walks no email step and numbers the campaign one earlier", () => {
    expect(walkSteps("leads").some((s) => s.key === "email")).toBe(false);
    expect(walkSteps("emails").some((s) => s.key === "email")).toBe(true);
    expect(walkStepNumber("campaign", "leads")).toBe((walkStepNumber("campaign", "emails") ?? 0) - 1);
    expect(walkStepNumber("email", "leads")).toBeNull();
  });

  it("the leads arm says leads, never emails, on the preview", () => {
    expect(GS_ARM_COPY.leads.givesNext).toBe("Next, a preview of your first leads.");
    expect(GS_ARM_COPY.leads.givesButton).toBe("Preview my leads");
    for (const line of [...GS_ARM_COPY.leads.promise, GS_ARM_COPY.leads.givesNext, GS_ARM_COPY.leads.givesButton]) expect(line).not.toMatch(/email/i);
    expect(GS_ARM_COPY.emails.givesButton).toBe("Preview my leads");
  });

  it("the page draws on the server and the walk writes no email in the leads arm", () => {
    expect(page).toContain("gsArm={arm} gsArmFresh={fresh}");
    expect(walk).toContain("posthog.register({ gs_arm: gsArm });");
    const open = walk.slice(walk.indexOf("function openEmailStyle("), walk.indexOf("function openEmailStyle(") + 200);
    expect(open).toContain("if (!emailsShown) return;");
    expect(walk).toContain('stagedKey === (emailsShown ? "email" : "companies")');
  });
});

/** A seeded uniform generator (mulberry32) so the adaptive split is reproducible in tests. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("get-started A/B: adaptive split on cards saved (owner 2026-10-22)", () => {
  it("stays 50 / 50 until every arm has 5 cards", () => {
    expect(adaptiveGsArmWeights({ emails: { visitors: 0, cards: 0 }, leads: { visitors: 0, cards: 0 } })).toEqual({ emails: 0.5, leads: 0.5 });
    expect(adaptiveGsArmWeights({ emails: { visitors: 5, cards: 1 }, leads: { visitors: 6, cards: 1 } })).toEqual({ emails: 0.5, leads: 0.5 });
    expect(adaptiveGsArmWeights({ emails: { visitors: 30, cards: 20 }, leads: { visitors: 30, cards: 4 } })).toEqual({ emails: 0.5, leads: 0.5 });
  });

  it("a clear winner gets 80%, never more", () => {
    const w = adaptiveGsArmWeights({ emails: { visitors: 30, cards: 20 }, leads: { visitors: 30, cards: 5 } }, seeded(1));
    expect(w).toEqual({ emails: 0.8, leads: 0.2 });
  });

  it("two equal arms stay near 50 / 50", () => {
    const w = adaptiveGsArmWeights({ emails: { visitors: 100, cards: 10 }, leads: { visitors: 100, cards: 10 } }, seeded(2));
    expect(w.emails).toBeGreaterThan(0.4);
    expect(w.emails).toBeLessThan(0.6);
    expect(w.emails + w.leads).toBeCloseTo(1, 5);
  });

  it("a lead between the floors follows the chance of being better", () => {
    const w = adaptiveGsArmWeights({ emails: { visitors: 100, cards: 11 }, leads: { visitors: 100, cards: 9 } }, seeded(3));
    expect(w.emails).toBeGreaterThan(0.6);
    expect(w.emails).toBeLessThan(0.8);
  });

  it("the draw uses the weights it is given", () => {
    expect(decideGsArm({ query: null, cookie: undefined, random: 0.7, weights: { emails: 0.8, leads: 0.2 } })).toEqual({ arm: "emails", fresh: true });
    expect(decideGsArm({ query: null, cookie: undefined, random: 0.85, weights: { emails: 0.8, leads: 0.2 } })).toEqual({ arm: "leads", fresh: true });
  });

  it("reads PostHog rows per arm and refuses an unknown arm", () => {
    expect(rowsToGsArmStats([["emails", 5, 1], ["leads", "6", "1"]])).toEqual({ emails: { visitors: 5, cards: 1 }, leads: { visitors: 6, cards: 1 } });
    expect(rowsToGsArmStats([])).toEqual({ emails: { visitors: 0, cards: 0 }, leads: { visitors: 0, cards: 0 } });
    expect(() => rowsToGsArmStats([["other", 1, 0]])).toThrow(/unknown arm/);
  });

  it("the page draws new visitors with the adaptive split", () => {
    expect(page).toContain("weights: gsArmWeights(),");
  });
});
