import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Owner 2026-10-07: every campaign page shows a line chart of the campaign's ROI since
 * inception, ABOVE the outcome steps chart. The curve is features-service's `roiHistory`
 * on the campaign-scoped `/revenue`; nothing is divided in the browser.
 */
const page = fs.readFileSync(path.join(__dirname, "../src/components/v2/campaign-page.tsx"), "utf-8");
const chart = fs.readFileSync(path.join(__dirname, "../src/components/v2/campaign-roi-chart.tsx"), "utf-8");

function slice(anchor: string, next: string): string {
  const at = page.indexOf(anchor);
  expect(at, anchor).toBeGreaterThan(-1);
  return page.slice(at, page.indexOf(next, at + anchor.length));
}

describe("campaign ROI chart", () => {
  it("sits above the steps on the cold-email overview", () => {
    const body = slice("function CampaignOverview(", "function ConversationOverview(");
    const at = body.indexOf("<CampaignRoiChart");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(body.indexOf("<LegSteps"));
  });

  it("sits above the steps on the conversation overview", () => {
    const at = page.indexOf("function ConversationOverview(");
    const body = page.slice(at);
    const chartAt = body.indexOf("<CampaignRoiChart");
    expect(chartAt).toBeGreaterThan(-1);
    expect(chartAt).toBeLessThan(body.indexOf("<StepBar"));
  });

  it("plots the served roiMultiple and computes no ratio", () => {
    expect(chart).toContain("getCampaignRoiHistory(");
    expect(chart).toContain("d.roiMultiple");
    expect(chart).not.toMatch(/cumulativePipelineUsd\s*\//);
  });
});

/**
 * Owner 2026-10-08: Today is the offer's ROI page. It draws the offer's own served
 * `roiHistory` with the same card as the campaign page, and the offer's pipeline by step
 * from features-service `/offers/:offerId/outcomes` (never summed or divided here).
 */
describe("Today's return and pipeline by step", () => {
  const today = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-page.tsx"), "utf-8");
  const roi = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi.tsx"), "utf-8");

  it("draws the offer's served curve on the shared card, on the headline's basis", () => {
    expect(today).toContain("<RoiHistoryCard");
    expect(today).toContain("history={roiCurve}");
    expect(today).toContain("const roiHalf = shownReturnHalf(data?.costEconomics.maturity, basis);");
    expect(today).toContain('roiHalf === "flash" ? data.roiHistory.flash ?? null : data.roiHistory');
  });

  it("states customers won on our outreach, hot and lost leads, from the served pipeline", () => {
    expect(today).toContain("const pipeline = outcomesQ.data?.pipeline ?? null;");
    expect(today).toContain("<EarnedStrip pipeline={pipeline}");
    expect(today).toContain("<HotLeads pipeline={pipeline}");
    expect(today).toContain("<LostLeads pipeline={pipeline}");
    expect(roi).toContain("pipeline?.customersWon");
    expect(roi).toContain("pipeline?.hotLeads");
    expect(roi).toContain("pipeline?.coldLeads");
  });

  it("explains each step's value with the served legs and prints the served totals", () => {
    expect(roi).toContain("<ValueWhy why={s.valueExplanation} />");
    expect(roi).toContain("s.pricedValueUsd");
    expect(roi).toContain("conv?.ratePct");
    expect(roi).not.toMatch(/probabilityPct\s*\*|lifetimeRevenueUsd\s*\*/);
  });

  it("reads the offer's outcomes and prints the served figures only", () => {
    expect(today).toContain("const outcomesQ = useOfferOutcomes(brandId);");
    expect(today).toContain("<OfferOutcomesTable");
    expect(roi).toContain("row.valuePerOutcomeUsd");
    expect(roi).toContain("row.valueUsd");
    expect(roi).not.toMatch(/recipientsReached\s*\*|valueUsd\s*\//);
    expect(roi).not.toContain("reduce(");
  });

  it("links the rates to where the customer changes them", () => {
    expect(roi).toContain('v2OfferHref(orgId, brandId, offerId, "sales-path")');
    expect(roi).toContain("Wrong number? Change it");
  });
});

describe("Today's budget totals are billing's", () => {
  const today = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-page.tsx"), "utf-8");
  it("renders the served proactive and reactive totals, sums nothing", () => {
    expect(today).toContain("<BudgetTotals totals={budgetsQ.data.totals} />");
    expect(today).toContain("totals.proactive.budgetCents");
    expect(today).toContain("totals.reactive.maxBudgetCents");
    expect(today).toContain("totals.reactive.byTrigger.map(");
    expect(today).not.toMatch(/items\.reduce\(/);
  });
});
