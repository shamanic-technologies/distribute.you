import { describe, it, expect } from "vitest";
import {
  WELCOME_STEPS,
  REMINDER_COPY,
  NO_AUDIENCE_BANNER_COPY,
} from "../src/lib/onboarding-content";

const allCopy = [
  ...WELCOME_STEPS.flatMap((s) => [s.title, s.description]),
  ...Object.values(REMINDER_COPY).flatMap((c) => [c.title, c.body, c.cta]),
  NO_AUDIENCE_BANNER_COPY.message,
  NO_AUDIENCE_BANNER_COPY.cta,
];

describe("onboarding copy", () => {
  it("ships the five first-visit welcome steps", () => {
    expect(WELCOME_STEPS).toHaveLength(5);
  });

  it("never ships an em-dash (project copy discipline)", () => {
    for (const text of allCopy) {
      expect(text.includes("—")).toBe(false);
    }
  });

  it("covers the welcome topics: why, credits, on-behalf, timeline, audiences", () => {
    const joined = WELCOME_STEPS.map((s) => `${s.title} ${s.description}`).join(" ");
    expect(joined).toMatch(/Welcome to distribute/);
    expect(joined).toMatch(/\$25/);
    expect(joined).toMatch(/on your behalf/);
    expect(joined).toMatch(/Within 1 hour/);
    expect(joined).toMatch(/Within 2 to 3 days/);
    expect(joined).toMatch(/recap email/i);
    expect(joined).toMatch(/audience/i);
  });

  it("shows the example outreach email with its caption", () => {
    const onBehalf = WELCOME_STEPS.find((s) => s.title === "We email on your behalf");
    expect(onBehalf?.description).toMatch(/Hey Sophie/);
    expect(onBehalf?.description).toMatch(/will not read exactly like this/);
  });

  it("reminder copy names both blockers with a CTA", () => {
    expect(REMINDER_COPY.topup.cta).toMatch(/auto top-up/i);
    expect(REMINDER_COPY.audience.cta).toMatch(/audience/i);
  });

  it("recharge reminder (auto-reload-blocked card) asks for credits, not auto-topup", () => {
    expect(REMINDER_COPY.topupRecharge.cta).toMatch(/add credits/i);
    expect(REMINDER_COPY.topupRecharge.cta).not.toMatch(/auto top-up/i);
    expect(REMINDER_COPY.topupRecharge.body).toMatch(/isn't available/i);
  });
});
