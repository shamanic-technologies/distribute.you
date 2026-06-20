import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Cost summary card on feature Overview (actual spend)", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  // Feature flattened into the brand level — the brand root page IS the overview.
  const overview =
    read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");

  it("renders Total spent without Cost of acquisition or ROI cards", () => {
    expect(card).toContain("Total spent");
    expect(card).toContain("Budget spent today");
    expect(card).not.toContain("Cost of acquisition");
    expect(card).not.toContain("Share of expected pipeline revenue");
    expect(card).not.toContain("ROI");
    expect(card).not.toContain("Return multiple on spend");
  });

  it("top cost sources show provider logo + share, no $ amounts", () => {
    expect(card).toContain("Top cost sources");
    expect(card).toContain("ProviderLogo");
    expect(card).toContain("{Math.round(s.pct)}%");
    // The provider rows must not print a dollar figure.
    expect(card).not.toContain("formatUsd(s.cents");
  });

  it("Overview wires the cost breakdown through the revenue section into the summary card", () => {
    expect(overview).toContain("getBrandCostBreakdown");
    expect(overview).toContain("costBreakdown={costData?.costs ?? []}");
    expect(overview).toContain("todayCostBreakdown={todayCostData?.costs ?? []}");
    expect(overview).toContain("dailyBudgetCents={budgetData?.dailyBudgetCents ?? null}");
    const section = read("components/revenue/revenue-overview-section.tsx");
    // The cost summary lives in the right-of-chart column, replacing the old
    // org/lead/event counters.
    expect(section).toContain("RevenueCostSummary");
    expect(section).toContain("todayCostBreakdown={todayCostBreakdown}");
    expect(section).toContain("dailyBudgetCents={dailyBudgetCents}");
    expect(section).not.toContain("costEconomics={data?.costEconomics}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("Total spent and provider shares use actual costs only", () => {
    expect(card).toContain("parseFloat(c.actualCostInUsdCents)");
    expect(card).toContain("actualCents(todayCostBreakdown)");
    expect(card).not.toContain("parseFloat(c.totalCostInUsdCents)");
  });

  it("Budget spent today fetches a local-day actual-cost window", () => {
    expect(overview).toContain("brandCostBreakdownToday");
    expect(overview).toContain("startedAfter.setHours(0, 0, 0, 0)");
    expect(overview).toContain("startedBefore.setDate(startedAfter.getDate() + 1)");
    expect(overview).toContain("getBrandCostBreakdown(brandId, { featureSlug, ...todayCostWindow })");
  });

  it("Total spent only keeps cents below ten dollars", () => {
    expect(card).toContain("const fractionDigits = usd < 10 ? 2 : 0");
    expect(card).toContain("minimumFractionDigits: fractionDigits");
    expect(card).toContain("maximumFractionDigits: fractionDigits");
  });

  it("Overview replaces the bottom cost-source card with real top audiences", () => {
    const api = read("lib/api.ts");
    const audiencesCard = read("components/revenue/top-audiences-card.tsx");
    expect(overview).toContain("fetchFeatureAudienceStats");
    expect(overview).toContain("listAudiences(brandId)");
    expect(overview).toContain("featureAudienceStats");
    expect(overview).toContain("<TopAudiencesCard");
    expect(overview).toContain("audiences={audienceStatsRevealed ? activeAudiences : undefined}");
    expect(overview).toContain("costBottomCard=");
    // The bottom card no longer reads brand-service personas.
    expect(overview).not.toContain("listPersonas");
    // audience-stats is a features-service contract (stat evidence).
    expect(api).toContain("export async function fetchFeatureAudienceStats");
    expect(api).toContain("`/features/${featureSlug}/audience-stats?");
    expect(audiencesCard).toContain("Top 3 audiences");
    expect(audiencesCard).toContain("fallbackRows");
    expect(audiencesCard).toContain("row.metrics.cpcCents");
    expect(audiencesCard).toContain("row.metrics.cpprCents");
    expect(audiencesCard).toContain('if (cents == null) return "-";');
  });

  it("does not derive hidden cost efficiency ratios in the browser", () => {
    expect(card).not.toContain("costEconomics?.costOfAcquisitionPct");
    expect(card).not.toContain("costEconomics?.roiMultiple");
    expect(card).not.toContain("cacPct");
    expect(card).not.toContain("roiMultiple");
    expect(card).not.toContain("totalPipelineUsd");
  });

  it("the /revenue parser threads costEconomics through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    expect(parser).toContain("costEconomics: d.costEconomics");
  });
});
