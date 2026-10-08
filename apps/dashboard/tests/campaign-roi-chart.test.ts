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
    // Lost = went cold or ruled out (owner 2026-10-08), the same list as Unibox's Lost filter.
    expect(roi).toContain("pipeline?.lostLeads");
    expect(roi).not.toContain("pipeline?.coldLeads");
  });

  it("states only the people we brought, and opens each row in the right panel (owner 2026-10-08)", () => {
    expect(roi).toContain("s.pricedRecipientsReached");
    expect(roi).toContain("s.pricedValueUsd");
    expect(roi).toContain("onOpen={() => onOpenStep(s.step.key)}");
    expect(roi).toContain("{...openable(() => onOpenLead(l), leadName(l))}");
    // The calculation left the table for the panel.
    expect(roi).not.toContain("valueExplanation");
    expect(today).toContain("<TodayPanel brandId={brandId} pipeline={pipeline} target={panel}");
  });

  it("the panel explains the served legs and edits each rate at brand level", () => {
    const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
    expect(panel).toContain("why.legs.map(");
    expect(panel).toContain("legRateFor(rates.data?.legs ?? [], l.legKey)");
    expect(panel).toContain("<InlineRate");
    expect(panel).toContain("await stateBrandLegRates(brandId,");
    expect(panel).toContain("invalidateConversionRates(qc);");
    expect(panel).not.toMatch(/probabilityPct\s*\*|lifetimeRevenueUsd\s*\*|recipientsReached\s*-/);
  });

  it("reads the offer's outcomes and prints the served figures only", () => {
    expect(today).toContain("const outcomesQ = useOfferOutcomes(brandId);");
    expect(today).toContain("<OfferOutcomesTable");
    expect(roi).toContain("s.valuePerOutcomeUsd");
    expect(roi).toContain("s.pricedValueUsd");
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

/**
 * Owner 2026-10-08: a step's panel shows who stands on it in three groups (ours, ours
 * lost, not ours), served by features-service; a lead's panel changes its status with
 * lead-service's per-lead step statements, cost asked, keyed on the campaign row id.
 */
describe("Today panel: people by group and the lead status change", () => {
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  const roi = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi.tsx"), "utf-8");
  it("renders the three served groups, the ours ones as the big cards", () => {
    const ours = panel.slice(panel.indexOf("{people.ours.leads.map("), panel.indexOf("{people.lost.count > 0"));
    expect(ours.length).toBeGreaterThan(0);
    expect(ours).toContain('size="hero"');
    expect(panel).toContain('<LeadCard key={l.leadId} lead={l} size="lost"');
    expect(panel).toContain('<LeadCard key={l.leadId} lead={l} size="compact"');
  });
  it("writes a status through the step statement on the served row id, cost asked", () => {
    expect(panel).toContain("const rowId = lead.campaignLeadId ?? null;");
    expect(panel).toContain("useSetAnyLeadStepStatement()");
    expect(panel).toContain("<StageStatementForm");
    expect(panel).toContain("<CloseWonForm");
  });
  it("reads conversion on the priced basis, beside the priced People count", () => {
    expect(roi).toContain("s.pricedConversionFromPrevious?.ratePct");
    expect(roi).not.toContain("conversionFromPrevious?.ratePct != null ? pct(conv");
  });
});

/**
 * Owner 2026-10-08: "il faut les exclure, pour que la somme des lignes fasse le total
 * pipeline", plus a Total row and a People contacted panel. Every figure is served by
 * features-service's exclusive ladder; the browser sums nothing.
 */
describe("Pipeline by step: one row per person, a served Total", () => {
  const roi = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi.tsx"), "utf-8");
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  it("reads the exclusive rows and the served total", () => {
    expect(roi).toContain("const ex = pipeline?.exclusiveLadder ?? null;");
    expect(roi).toContain("r.pipelineUsd");
    expect(roi).toContain("ex.total.pipelineUsd");
    expect(roi).not.toMatch(/pipelineUsd\s*\+|\.reduce\(/);
    expect(roi).not.toContain('label="Companies contacted"');
  });
  it("the contacted row opens its own panel, priced as served", () => {
    expect(roi).toContain("onOpen={onOpenContacted}");
    expect(panel).toContain("why.routes.map(");
    expect(panel).toContain("r.entryRatePct");
    expect(panel).toContain("const people = slice?.people ?? step.people ?? null;");
  });
});
