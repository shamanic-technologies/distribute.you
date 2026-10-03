import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUBSCRIPTION_OUTBOUND_DAILY_USD,
  SUBSCRIPTION_REACTIVE_DAILY_USD,
  isSubscriptionArm,
  monthlyUsd,
  pickedPlanCents,
  planAmountOptions,
  subscriptionBudgets,
  subscriptionCheckoutRefusal,
} from "../src/lib/subscription-plan";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const ONBOARDING = read("src/components/onboarding/onboarding.tsx");
const PLAN = read("src/components/v2/subscription-plan.tsx");
const BILLING = read("src/components/v2/billing-page.tsx");
const API = read("src/lib/api.ts");

describe("who is in the $99/month arm", () => {
  it("is everyone with no lp_variant cookie: the plan is the default offer", () => {
    expect(isSubscriptionArm(null)).toBe(true);
    expect(isSubscriptionArm(undefined)).toBe(true);
    expect(isSubscriptionArm("")).toBe(true);
    expect(isSubscriptionArm("a=1; b=2")).toBe(true);
    expect(isSubscriptionArm("x_lp_variant=control")).toBe(true);
    expect(isSubscriptionArm("lp_variant=")).toBe(true);
    expect(isSubscriptionArm("a=1; lp_variant=subscription; b=2")).toBe(true);
  });

  it("keeps pay-as-you-go only for a cookie that names another variant", () => {
    for (const v of ["control", "instinct", "assistant", "concierge"]) {
      expect(isSubscriptionArm(`lp_variant=${v}`)).toBe(false);
      expect(isSubscriptionArm(`a=1; lp_variant=${v}; b=2`)).toBe(false);
    }
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

describe("the amount picked on the landing", () => {
  it("reads lp_plan when it sits on billing's ladder, else $99", () => {
    expect(pickedPlanCents("lp_plan=49900")).toBe(49900);
    expect(pickedPlanCents("a=1; lp_plan=19900")).toBe(19900);
    expect(pickedPlanCents("lp_plan=12345")).toBe(9900);
    expect(pickedPlanCents("lp_plan=500")).toBe(9900);
    expect(pickedPlanCents(null)).toBe(9900);
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
    expect(arm).toContain("await openTrialCheckout();");
    const open = ONBOARDING.slice(ONBOARDING.indexOf("async function openTrialCheckout("), ONBOARDING.indexOf("async function finishTrialCheckout("));
    // billing#568: the ordinary card form (Revolut widget), the picked amount, then start.
    expect(open).toContain("await declareRevolutDefault();");
    expect(open).toContain("pickedPlanCents(document.cookie)");
    expect(open).toContain('setup.mode === "embedded_widget"');
    expect(open).toContain("onSuccess: () => void finishTrialCheckout()");
    expect(open).toContain("launch_checkout=success");
    expect(open).not.toContain("daily_budget");
    expect(begin).toContain("subscriptionCheckoutRefusal(");
  });

  it("starts the launch by settling the subscription, never by arming a top-up", () => {
    const run = ONBOARDING.slice(ONBOARDING.indexOf("async function runLaunchWork("), ONBOARDING.indexOf("setLaunchStep(1);"));
    const arm = run.slice(run.indexOf("if (subscriptionArm) {"), run.indexOf("} else {"));
    expect(arm).toContain("await ensureSubscriptionStarted();");
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
    expect(BILLING).toContain('id="plan"');
    expect(BILLING).toContain("<SubscriptionPlan />");
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

  // Owner 2026-10-01: a dropdown of several amounts, never a bare "+$100".
  it("lets the customer pick the monthly amount from a dropdown of choices", () => {
    expect(PLAN).toContain('aria-label="Monthly amount"');
    expect(PLAN).toContain("planAmountOptions(sub.monthly_amount_cents).map");
    expect(PLAN).toContain("changeSubscriptionAmount(amount)");
    expect(PLAN).not.toContain("Add $100");
    expect(planAmountOptions(9900)).toEqual([9900, 19900, 29900, 49900, 99900, 199900]);
    expect(planAmountOptions(39900)).toContain(39900);
  });

  // Owner 2026-10-03: a trial is never a lock. Any amount, same or other, can start now,
  // behind a modal saying the card is charged today.
  it("offers to start the plan now during the trial, at any amount, behind a charge modal", () => {
    expect(PLAN).not.toContain("once your free trial ends");
    expect(PLAN).toContain('const startable = trialing && sub.can_start_now === true;');
    expect(PLAN).toContain("onClick={() => setChargeOpen(true)}");
    expect(PLAN).toContain('onConfirm={() => void run("start", () => startSubscriptionNow(amount))}');
    const dialog = PLAN.slice(PLAN.indexOf("export function ChargeNowDialog("), PLAN.indexOf("export function LossDialog("));
    expect(dialog).toContain("We charge {amount} to your card today.");
    expect(dialog).toContain("Your free trial ends now.");
    expect(dialog).toContain("Keep my free trial");
    const start = API.slice(API.indexOf("export async function startSubscriptionNow("), API.indexOf("export async function cancelSubscription("));
    expect(start).toContain('"/billing/accounts/subscription"');
    expect(start).toContain("start_now: true");
    expect(API).toContain("can_start_now: z.boolean().nullish()");
  });

  it("explains a refused start by billing's code, nothing charged", () => {
    expect(PLAN).toContain('code === "first_charge_declined"');
    expect(PLAN).toContain('code === "card_required"');
  });

  it("draws with the v2 primitives, no hand-rolled greys or cards", () => {
    for (const p of ["<Figure", "<StateDot", "k-label", "<EmptyNote"]) expect(PLAN, p).toContain(p);
    expect(PLAN).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|text-\[22px\]/);
  });

  it("never renders a thrown message and carries no em-dash", () => {
    expect(PLAN).not.toContain("err.message");
    // The v2 missing-value glyph (`—` in k-fg4) is the one sanctioned dash.
    const code = PLAN.replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace('<span className="k-fg4">—</span>', "")
      .replace(': "—"', "");
    expect(code).not.toContain("—");
  });

  it("reads the gateway's subscription routes, parsed", () => {
    for (const path of [
      '"/billing/accounts/subscription/checkout_session"',
      '"/billing/accounts/subscription"',
      '"/billing/accounts/subscription/cancel"',
      '"/billing/accounts/subscription/resume"',
      '"/billing/accounts/subscription/start"',
    ]) {
      expect(API, path).toContain(path);
    }
    expect(API).toContain("SubscriptionReadSchema.safeParse(raw)");
  });
});
