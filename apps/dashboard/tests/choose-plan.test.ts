import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { offerHasLivePlan, planStartRefusal } from "../src/lib/subscription-plan";

// Owner 2026-10-03: a plan is per brand x offer. A new brand, org or offer created from
// the dashboard ends on "Choose your plan" (no trial: the 3 days are the first signup's
// only); an offer with no plan carries a banner offering one.

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("offerHasLivePlan", () => {
  const plan = (brand_id: string | null, offer_id: string | null, status = "active") => ({ brand_id, offer_id, status });

  it("finds the plan of this brand x offer, case aside", () => {
    expect(offerHasLivePlan([plan("B1", "O1")], "b1", "o1")).toBe(true);
  });

  it("counts a trial or a failed payment as live, an ended plan as none", () => {
    expect(offerHasLivePlan([plan("b", "o", "trialing")], "b", "o")).toBe(true);
    expect(offerHasLivePlan([plan("b", "o", "past_due")], "b", "o")).toBe(true);
    expect(offerHasLivePlan([plan("b", "o", "canceled")], "b", "o")).toBe(false);
  });

  it("never lends one offer's plan to another, nor an unattributed plan", () => {
    expect(offerHasLivePlan([plan("b", "o1")], "b", "o2")).toBe(false);
    expect(offerHasLivePlan([plan(null, null)], "b", "o")).toBe(false);
  });
});

describe("planStartRefusal", () => {
  it("names each refusal by billing's code", () => {
    expect(planStartRefusal("plan_exists_for_offer")).toBe("This offer already has a plan.");
    expect(planStartRefusal("first_charge_declined")).toContain("not charged");
    expect(planStartRefusal("whatever")).toContain("nothing was charged");
  });
});

describe("where a plan is chosen", () => {
  const panel = read("src/components/v2/choose-plan.tsx");

  it("starts the plan on billing's per offer route, with no trial", () => {
    expect(panel).toContain("await startPlan({ brand_id: brandId, offer_id: offerId, monthly_amount_cents: cents });");
    expect(panel).not.toContain("createSubscriptionCheckout(");
    expect(panel).toContain('if (code === "card_required") return "card_required";');
  });

  it("the offer page and Today carry the banner", () => {
    expect(read("src/components/v2/setup-pages.tsx")).toContain("<OfferPlanBanner brandId={brandId} offerId={offerId} missions={missions} />");
    expect(read("src/components/v2/today-page.tsx")).toContain("<OfferPlanBanner brandId={brandId} offerId={selectedOfferId} missions={missions} />");
  });

  it("Add mission sells the plan first on an offer with none", () => {
    const add = read("src/components/v2/add-mission-modal.tsx");
    expect(add).toContain("const needsPlan = useOfferNeedsPlan(brandId, offerId);");
    expect(add).toContain("<ChoosePlanPanel brandId={brandId} offerId={offerId} onStarted={() => mutation.mutate()} />");
  });

  it("Add a brand ends on the plan and never flips a plan org back to pay-as-you-go", () => {
    const modal = read("src/components/v2/new-org-modal.tsx");
    expect(modal).toContain('{step === "plan" && brandId && offerId && (');
    expect(modal).toContain("if (!planFlow) await setPaymentMode(");
    expect(modal).toContain("const dailyUsd = planFlow ? SUBSCRIPTION_OUTBOUND_DAILY_USD : budgetUsd;");
  });
});
