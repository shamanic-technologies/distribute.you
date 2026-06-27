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

  it("Overview wires the server-computed spend block into the summary card", () => {
    // Total spent / today / top sources now come VERBATIM from the
    // features-service /revenue `spend` block — no client cost-breakdown fetch.
    expect(overview).not.toContain("getBrandCostBreakdown");
    expect(overview).not.toContain("costBreakdown={costData?.costs ?? []}");
    expect(overview).toContain("dailyBudgetCents={budgetData?.dailyBudgetCents ?? null}");
    const section = read("components/revenue/revenue-overview-section.tsx");
    // The cost summary lives in the right-of-chart column, replacing the old
    // org/lead/event counters, fed by the revenue payload's spend block.
    expect(section).toContain("RevenueCostSummary");
    expect(section).toContain("spend={data?.spend}");
    expect(section).toContain("dailyBudgetCents={dailyBudgetCents}");
    expect(section).not.toContain("costEconomics={data?.costEconomics}");
    expect(section).not.toContain("costBreakdown={costBreakdown}");
    expect(section).not.toContain("Converting organizations");
    expect(section).not.toContain("Lead conversions");
  });

  it("Total spent and provider shares render the server spend block verbatim", () => {
    // No client reduce / share-% math: the figures come straight off `spend`.
    expect(card).toContain("spend?.totalSpentCents");
    expect(card).toContain("spend?.todaySpentCents");
    expect(card).toContain("spend?.sources");
    expect(card).not.toContain("parseFloat(c.actualCostInUsdCents)");
    expect(card).not.toContain("reduce(");
  });

  it("Budget spent today reads the server-computed todaySpentCents", () => {
    // The local-day cost-window fetch is gone — the server computes today's spend.
    expect(overview).not.toContain("brandCostBreakdownToday");
    expect(card).toContain("spend?.todaySpentCents ?? 0");
  });

  it("shows COMMITTED spend (= actual + provisioned), preferring the new total* fields over legacy, with no client sum", () => {
    const stats = read("components/revenue/outreach-stat-cards.tsx");
    // Budget spent today prefers the committed `totalSpentTodayCents`, falls back to legacy.
    expect(card).toContain("spend?.totalSpentTodayCents ?? spend?.todaySpentCents");
    // CPC prefers the committed `totalCpcCents`, falls back to legacy `cpcCents`.
    expect(stats).toContain("spend?.totalCpcCents ?? spend?.cpcCents");
    // Total spent keeps the `totalSpentCents` name (features-service flips its value to committed).
    expect(card).toContain("spend?.totalSpentCents");
    // No client-side actual+provisioned arithmetic (the committed figure is server-provided).
    expect(card).not.toContain("actualSpentCents +");
    expect(card).not.toContain("+ spend?.provisioned");
    expect(stats).not.toContain("provisionedCpcCents +");
  });

  it("explains why committed spend dips via (i) tooltips on Budget spent today + Total spent", () => {
    expect(card).toContain("InfoTooltip");
    expect(card).toContain("TODAY_SPENT_TIP");
    expect(card).toContain("TOTAL_SPENT_TIP");
    // The copy names the mechanism (reserved follow-ups) and the dip, no em-dash.
    expect(card).toContain("reserved for follow-up");
    expect(card).toContain("It can dip when a reserved follow-up sends or gets cancelled");
    // The tooltip COPY strings (TIP constants) carry no em-dash (code comments are exempt).
    expect(card).not.toMatch(/_TIP =\s*\n?\s*"[^"]*—/);
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

  it("the /revenue parser threads costEconomics + the spend block through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    expect(parser).toContain("costEconomics: d.costEconomics");
    // The canonical spend block is parsed (nullable + optional) and flattened.
    expect(parser).toContain("spend: SpendSchema.nullable().optional()");
    expect(parser).toContain("spend: d.spend");
  });
});
