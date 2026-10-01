import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WALL_FREE_CREDIT_USD, wallCopy } from "../src/lib/v2/get-started";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const wall = read("src/components/v2/get-started/account-card-wall.tsx");

describe("wallCopy", () => {
  it("claims the $30 off the subscription arm", () => {
    const c = wallCopy({ subscription: false });
    expect(c.creditUsd).toBe(WALL_FREE_CREDIT_USD);
    expect(c.emailCta).toBe("Claim my $30 and start");
  });

  it("sells the 3-day trial and states the monthly amount the visitor picked", () => {
    const c = wallCopy({ subscription: true, monthlyCents: 19900, creditCents: 9900 });
    expect(c.creditUsd).toBe(99);
    expect(c.formTitle).toBe("Start your 3-day free trial");
    expect(c.cardNote).toContain("$199 a month");
    for (const v of Object.values(c)) expect(String(v)).not.toContain("$30");
  });
});

describe("the wall on the $99/month arm", () => {
  const trial = wall.slice(wall.indexOf("async function openTrialCheckout("), wall.indexOf("async function afterCardSaved("));

  it("opens billing's subscription checkout, not the ordinary card setup", () => {
    expect(wall).toContain("if (subscription) {\n      void openTrialCheckout();");
    expect(trial).toContain("createSubscriptionCheckout({ monthly_amount_cents: monthlyCents");
    expect(trial).not.toContain("createEmbeddedCardSetup(");
  });

  it("starts the plan and checks it before launching, with no payment mode and no top-up", () => {
    expect(trial).toContain("await startSubscription()");
    expect(trial).toContain('read.payment_mode !== "subscription"');
    expect(trial).toContain("void launch(null)");
    const launch = wall.slice(wall.indexOf("async function launch("), wall.indexOf("const proof ="));
    expect(launch.indexOf("if (acct) {")).toBeGreaterThan(-1);
    expect(launch.indexOf("if (acct) {")).toBeLessThan(launch.indexOf("setPaymentMode("));
  });

  it("locks the daily budget to the plan's", () => {
    expect(wall).toContain("subscription ? SUBSCRIPTION_OUTBOUND_DAILY_USD");
    expect(wall).toContain("readOnly={subscription}");
  });
});
