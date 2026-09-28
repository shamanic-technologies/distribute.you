import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// An Indian card cannot be charged off-session (RBI mandate), and billing-service
// refuses to arm auto-reload on it with a 400. The onboarding launch used to arm
// auto-reload unconditionally, so that 400 failed the whole launch AFTER the customer
// had saved their card ("Launch couldn't finish. Add a card from another country").
// The launch now reads the account first and runs such an org prepaid instead.
const SRC = readFileSync(resolve(__dirname, "../src/components/onboarding/onboarding.tsx"), "utf8");
const body = SRC.slice(
  SRC.indexOf("async function runLaunchWork("),
  SRC.indexOf("async function resolveLaunchCampaigns("),
);

describe("onboarding launch on a card that cannot auto-reload", () => {
  it("reads the account before deciding how the org is funded", () => {
    expect(body).toContain("const account = await getBillingAccount();");
    expect(body.indexOf("getBillingAccount()")).toBeLessThan(body.indexOf("configureAutoTopup("));
  });

  it("switches the org to prepaid instead of arming auto-reload", () => {
    expect(body).toContain('if (account.auto_reload_supported === false) {');
    expect(body).toContain('await setPaymentMode("prepaid");');
  });

  it("never arms auto-reload unconditionally", () => {
    const arm = body.indexOf("await configureAutoTopup(");
    const gate = body.indexOf("auto_reload_supported === false");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(arm);
  });
});
