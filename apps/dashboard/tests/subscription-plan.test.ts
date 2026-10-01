import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUBSCRIPTION_OUTBOUND_DAILY_USD,
  SUBSCRIPTION_REACTIVE_DAILY_USD,
  isSubscriptionArm,
  monthlyUsd,
  subscriptionBudgets,
  subscriptionCheckoutRefusal,
} from "../src/lib/subscription-plan";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const ONBOARDING = read("src/components/onboarding/onboarding.tsx");
const PLAN = read("src/components/v2/subscription-plan.tsx");
const BILLING = read("src/components/v2/billing-page.tsx");
const API = read("src/lib/api.ts");

describe("who is in the $99/month arm", () => {
  it("reads the landing's lp_variant cookie, and nothing else", () => {
    expect(isSubscriptionArm("a=1; lp_variant=subscription; b=2")).toBe(true);
    expect(isSubscriptionArm("lp_variant=control")).toBe(false);
    expect(isSubscriptionArm("lp_variant=instinct")).toBe(false);
    expect(isSubscriptionArm("x_lp_variant=subscription")).toBe(false);
    expect(isSubscriptionArm("")).toBe(false);
    expect(isSubscriptionArm(null)).toBe(false);
  });
});

describe("the plan's daily money", () => {
  it("is $50 of outreach plus a +50% ceiling for replies", () => {
    expect(SUBSCRIPTION_OUTBOUND_DAILY_USD).toBe(50);
    expect(SUBSCRIPTION_REACTIVE_DAILY_USD).toBe(25);
  });

  it("puts the $50 on the first outbound campaign and the ceiling on the first reactive one", () => {
    const pairs = [
      { key: "start_to_reply::cold-email", fromKey: null },
      { key: "reply_to_meeting::ai-booking", fromKey: "positive_reply" },
      { key: "start_to_visit::cold-email", fromKey: null },
    ];
    expect(subscriptionBudgets(pairs)).toEqual({
      "start_to_reply::cold-email": "50",
      "reply_to_meeting::ai-booking": "25",
      "start_to_visit::cold-email": "0",
    });
  });

  it("funds only the outreach when there is nothing reactive", () => {
    expect(subscriptionBudgets([{ key: "a", fromKey: null }])).toEqual({ a: "50" });
  });
});

describe("words", () => {
  it("states a monthly amount in whole dollars", () => {
    expect(monthlyUsd(9900)).toBe("$99");
    expect(monthlyUsd(109900)).toBe("$1,099");
  });

  it("explains each checkout refusal by billing's code, with a generic line for the rest", () => {
    expect(subscriptionCheckoutRefusal("subscription_exists")).toMatch(/already has a subscription/);
    expect(subscriptionCheckoutRefusal("existing_paying_org")).toMatch(/Write to us/);
    expect(subscriptionCheckoutRefusal("acquirer_not_supported")).toMatch(/Write to us/);
    expect(subscriptionCheckoutRefusal(undefined)).toMatch(/Nothing was charged/);
  });
});

describe("the onboarding sells the plan to its arm", () => {
  it("never puts an added brand into the arm", () => {
    expect(ONBOARDING).toContain("() => !fromAdd && typeof document !== \"undefined\" && isSubscriptionArm(document.cookie)");
  });

  it("writes the plan's money on the budget step and locks the inputs", () => {
    const seed = ONBOARDING.slice(ONBOARDING.indexOf("// The plan sets the money"), ONBOARDING.indexOf("const recommended = budgetForCount(RECOMMENDED_OUTCOME_COUNT)"));
    expect(seed).toContain("setCampaignBudgets(subscriptionBudgets(launchPairs))");
    expect(ONBOARDING).toContain("readOnly={subscriptionArm}");
  });

  it("opens the $99/month trial checkout, with no Ads purchase value", () => {
    const begin = ONBOARDING.slice(ONBOARDING.indexOf("async function beginCheckoutAndLaunch("), ONBOARDING.indexOf("async function resumeCheckoutLaunch("));
    const arm = begin.slice(begin.indexOf("if (subscriptionArm) {"), begin.indexOf("const prepared = preparedCheckoutRef.current;"));
    expect(arm).toContain("createSubscriptionCheckout(");
    expect(arm).toContain("launch_checkout=success");
    expect(arm).not.toContain("daily_budget");
    expect(begin).toContain("subscriptionCheckoutRefusal(");
  });

  it("starts the launch by settling the subscription, never by arming a top-up", () => {
    const run = ONBOARDING.slice(ONBOARDING.indexOf("async function runLaunchWork("), ONBOARDING.indexOf("setLaunchStep(1);"));
    const arm = run.slice(run.indexOf("if (subscriptionArm) {"), run.indexOf("} else {"));
    expect(arm).toContain("await getSubscription()");
    expect(arm).toContain('read.payment_mode !== "subscription"');
    expect(arm).not.toContain("configureAutoTopup");
    expect(arm).not.toContain("setPaymentMode");
  });

  it("states the trial on the payment screen", () => {
    const bonus = ONBOARDING.slice(ONBOARDING.indexOf('if (step === "bonus" && subscriptionArm) {'), ONBOARDING.indexOf('if (step === "bonus") {'));
    expect(bonus).toContain("Your first 3 days are free.");
    expect(bonus).toContain("Start my free trial");
    expect(bonus).not.toContain("—");
  });
});

describe("the plan on the Billing page", () => {
  it("shows the plan for a subscription org, and no top-up or auto top-up", () => {
    expect(BILLING).toContain('{mode === "subscription" && <SubscriptionPlan />}');
    expect(BILLING).toContain('mode !== "subscription" && account?.has_payment_method && c.autoReloadSupported');
    expect(BILLING).toContain('!c.accountPending && !c.hasAutoTopup && mode !== "subscription"');
  });

  it("lists what stops before a cancel, and before a plan's card is removed", () => {
    for (const loss of ["outreach stops", "Follow-ups stop", "Replies from your leads", "contact list", "history of every email"]) {
      expect(PLAN, loss).toContain(loss);
    }
    expect(PLAN).toContain('onClick={() => setLossOpen(true)}');
    expect(PLAN).toContain("onConfirm={() => void run(\"cancel\", () => cancelSubscription())}");
    expect(BILLING).toContain('mode === "subscription" ? setCardLossOpen(true) : c.setRemoveConfirmOpen(true)');
  });

  it("offers +$100 a month only when billing says the plan can rise", () => {
    expect(PLAN).toContain("sub.can_raise && sub.next_raise_monthly_amount_cents != null");
    expect(PLAN).toContain("raiseSubscription(sub.next_raise_monthly_amount_cents!)");
  });

  it("never renders a thrown message and carries no em-dash", () => {
    expect(PLAN).not.toContain("err.message");
    const code = PLAN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("—");
  });

  it("reads the gateway's subscription routes, parsed", () => {
    for (const path of [
      '"/billing/accounts/subscription/checkout_session"',
      '"/billing/accounts/subscription"',
      '"/billing/accounts/subscription/cancel"',
      '"/billing/accounts/subscription/resume"',
    ]) {
      expect(API, path).toContain(path);
    }
    expect(API).toContain("SubscriptionReadSchema.safeParse(raw)");
  });
});
