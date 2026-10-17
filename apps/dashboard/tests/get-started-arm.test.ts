import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GS_ARM_COPY, GS_ARM_WEIGHTS, decideGsArm, drawGsArm, walkStepNumber, walkSteps } from "../src/lib/v2/get-started-arm";

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
    expect(GS_ARM_COPY.emails.givesButton).toBe("Preview my emails");
  });

  it("the page draws on the server and the walk writes no email in the leads arm", () => {
    expect(page).toContain("gsArm={arm} gsArmFresh={fresh}");
    expect(walk).toContain("posthog.register({ gs_arm: gsArm });");
    const write = walk.slice(walk.indexOf("async function writeEmail("), walk.indexOf("async function writeEmail(") + 400);
    expect(write).toContain("if (!emailsShown) return;");
    const pre = walk.slice(walk.indexOf("function prewrite("), walk.indexOf("function prewrite(") + 200);
    expect(pre).toContain("if (!emailsShown) return;");
    expect(walk).toContain('stagedKey === (emailsShown ? "email" : "companies")');
  });
});
