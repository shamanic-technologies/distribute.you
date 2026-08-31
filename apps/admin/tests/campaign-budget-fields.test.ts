import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CAMPAIGN_BUDGET_FIELDS,
  budgetFieldsForCampaign,
  budgetFieldsPresent,
  omitBudgetOnSalesCampaign,
  SALES_BUDGET_NOTE,
  statesSalesFunnel,
} from "../src/lib/campaign-budget-fields";

const APP = join(__dirname, "../src/app/(authed)/(dashboard)");
const read = (p: string) => readFileSync(join(APP, p), "utf-8");

const featureNew = read("features/[featureId]/new/page.tsx");
const brandNew = read(
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
);
const campaignDetail = read(
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx",
);
const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf-8");
const modal = readFileSync(
  join(__dirname, "../src/components/campaigns/relaunch-campaign-modal.tsx"),
  "utf-8",
);

describe("which campaigns may state a ceiling", () => {
  it("names the four ceiling fields campaign-service accepts", () => {
    expect([...CAMPAIGN_BUDGET_FIELDS]).toEqual([
      "maxBudgetDailyUsd",
      "maxBudgetWeeklyUsd",
      "maxBudgetMonthlyUsd",
      "maxBudgetTotalUsd",
    ]);
  });

  it("reads a stated funnel as the sales family", () => {
    expect(statesSalesFunnel("sales_meetings_from_conversation")).toBe(true);
    expect(statesSalesFunnel("form_magnet")).toBe(true);
  });

  it("reads null, undefined and an unpicked picker as stating none", () => {
    expect(statesSalesFunnel(null)).toBe(false);
    expect(statesSalesFunnel(undefined)).toBe(false);
    expect(statesSalesFunnel("")).toBe(false);
    expect(statesSalesFunnel("   ")).toBe(false);
  });

  it("keeps no list of sales feature slugs — campaign-service owns that vocabulary", () => {
    const src = readFileSync(
      join(__dirname, "../src/lib/campaign-budget-fields.ts"),
      "utf-8",
    );
    expect(src).not.toContain("sales-cold-email-outreach");
    expect(src).not.toContain("isRevenueFeature");
  });
});

describe("budgetFieldsForCampaign", () => {
  it("passes the ceiling through for a campaign that states no funnel", () => {
    expect(budgetFieldsForCampaign(null, { maxBudgetDailyUsd: "10" })).toEqual({
      maxBudgetDailyUsd: "10",
    });
  });

  it("sends nothing for a campaign that states a funnel", () => {
    expect(
      budgetFieldsForCampaign("website_purchases", { maxBudgetMonthlyUsd: "200" }),
    ).toEqual({});
  });
});

describe("omitBudgetOnSalesCampaign", () => {
  const sales = {
    name: "x",
    funnelKey: "sales_meetings_from_website",
    maxBudgetDailyUsd: "10",
    featureInputs: { a: "b" },
  };

  it("drops every ceiling from a sales payload and keeps the rest", () => {
    expect(omitBudgetOnSalesCampaign(sales)).toEqual({
      name: "x",
      funnelKey: "sales_meetings_from_website",
      featureInputs: { a: "b" },
    });
  });

  it("drops all four at once", () => {
    const out = omitBudgetOnSalesCampaign({
      funnelKey: "form_magnet",
      maxBudgetDailyUsd: "1",
      maxBudgetWeeklyUsd: "2",
      maxBudgetMonthlyUsd: "3",
      maxBudgetTotalUsd: "4",
    });
    expect(out).toEqual({ funnelKey: "form_magnet" });
  });

  it("leaves a non-sales payload untouched, by identity", () => {
    const nonSales = { funnelKey: null, maxBudgetTotalUsd: "500" };
    expect(omitBudgetOnSalesCampaign(nonSales)).toBe(nonSales);
  });

  it("leaves a sales payload that carries no ceiling untouched, by identity", () => {
    const clean = { funnelKey: "form_magnet", name: "x" };
    expect(omitBudgetOnSalesCampaign(clean)).toBe(clean);
  });

  it("reports which ceilings a payload carries", () => {
    expect(budgetFieldsPresent(sales)).toEqual(["maxBudgetDailyUsd"]);
    expect(budgetFieldsPresent({ funnelKey: null })).toEqual([]);
  });

  it("says where a sales campaign's money lives", () => {
    expect(SALES_BUDGET_NOTE).toContain("billing");
    expect(SALES_BUDGET_NOTE).toContain("sales funnel, acquisition channel, offer");
  });
});

describe("createCampaign is the choke point, and it is loud", () => {
  it("strips a ceiling off a sales payload before sending", () => {
    const at = api.indexOf("export async function createCampaign");
    const body = api.slice(at, api.indexOf("enrichCampaignsWithBrandUrls([campaign]", at));
    expect(body).toContain("omitBudgetOnSalesCampaign(");
    expect(body).toContain("console.error(");
    // The body it POSTs is the stripped one, never the raw params.
    expect(body).toContain("body,");
    expect(body).not.toContain("body: params as unknown as Record<string, unknown>");
  });

  it("keeps the four params declared — a non-sales campaign still states one", () => {
    const at = api.indexOf("export async function createCampaign");
    const params = api.slice(at, at + 900);
    for (const field of CAMPAIGN_BUDGET_FIELDS) {
      expect(params).toContain(`${field}?: string;`);
    }
  });
});

describe("every staff create path sends a ceiling only when there is no funnel", () => {
  for (const [name, src] of [
    ["the feature-level create", featureNew],
    ["the brand-level create", brandNew],
  ] as const) {
    it(`${name} routes both its create and its checkout-resume blob through the gate`, () => {
      // Two sites per page: doCreateCampaign and saveCampaignIntent.
      const gated = src.split(
        "budgetFieldsForCampaign(needsSalesFunnel ? funnelKey : null, ceiling)",
      ).length - 1;
      expect(gated).toBe(2);
    });

    it(`${name} no longer assigns a ceiling straight into the payload`, () => {
      expect(src).not.toContain("budgetParams.maxBudget");
    });

    it(`${name} states where a sales campaign's money lives`, () => {
      expect(src).toContain('data-testid="sales-budget-note"');
      expect(src).toContain("{SALES_BUDGET_NOTE}");
    });
  }

  it("the brand-level test run drops its cap when the campaign states a funnel", () => {
    const at = brandNew.indexOf("const runWorkflowTest");
    const body = brandNew.slice(at, brandNew.indexOf("}, [brand, testStarting", at));
    expect(body).toContain(
      "...budgetFieldsForCampaign(testFunnelKey, { maxBudgetTotalUsd: TEST_RUN_BUDGET_USD })",
    );
    expect(body).not.toContain("maxBudgetTotalUsd: TEST_RUN_BUDGET_USD,");
  });
});

describe("a relaunch does not send back the ceiling on the row it copies", () => {
  it("only spreads a budget when the modal handed one back", () => {
    const at = campaignDetail.indexOf("const handleRelaunchSubmit");
    const body = campaignDetail.slice(at, campaignDetail.indexOf("const openRelaunchModal", at));
    expect(body).toContain("budget: RelaunchBudget | null");
    expect(body).toContain("...(budget ? buildBudgetParams(budget.amount, budget.frequency) : {})");
  });

  it("the modal edits a budget only for a campaign that states no funnel", () => {
    expect(modal).toContain("const editsBudget = !statesSalesFunnel(campaign.funnelKey);");
    expect(modal).toContain("onConfirm: (budget: RelaunchBudget | null) => void;");
    expect(modal).toContain("onConfirm(null);");
  });

  it("the modal states where the money lives instead of an inert input", () => {
    expect(modal).toContain('data-testid="sales-budget-note"');
    expect(modal).toContain("{SALES_BUDGET_NOTE}");
  });

  it("the confirm button stays live when there is no amount to type", () => {
    expect(modal).toContain("disabled={submitting || (editsBudget && !amount.trim())}");
  });
});
