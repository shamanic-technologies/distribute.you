import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Brand overview outcome + outreach-activity charts", () => {
  const api = read("lib/api.ts");
  const page = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const section = read("components/revenue/revenue-overview-section.tsx");
  const chart = read("components/revenue/pipeline-activity-chart.tsx");
  const outcome = read("components/revenue/outcome-trend-card.tsx");
  const revenueView = read("lib/revenue-view.ts");
  const revenueParse = read("lib/revenue-parse.ts");

  it("fetches the locked pipeline-activity forecast endpoint with brand, days, and timezone", () => {
    expect(api).toContain("getFeaturePipelineActivity");
    expect(api).toContain("/pipeline-activity?");
    expect(api).toContain('query.set("days", String(params.days))');
    expect(api).toContain('query.set("timezone", params.timezone)');
    expect(page).toContain('["featurePipelineActivity", brandId, featureSlug, timezone]');
    expect(page).toContain("days: 7");
  });

  it("top row pairs the Outcome card with the cost summary, full-width activity below", () => {
    expect(section).toContain("OutcomeTrendCard");
    expect(section).toContain("Outreach activity");
    expect(section).toContain("PipelineActivityChart");
    expect(section).toContain("pipelineActualSeries");
    expect(section).toContain("items-stretch");
    // The old single-card headline projection helper is gone — the Outcome card owns its headline.
    expect(section).not.toContain("formatOutcomeCount");
    expect(section).not.toContain("RevenueChart");
  });

  it("Outcome card is a single all-time cumulative line with no window picker", () => {
    expect(outcome).toContain("OutcomeTrendCard");
    expect(outcome).toContain("buildCumulative");
    expect(outcome).toContain("since launch");
    expect(outcome).toContain("AreaChart");
    // No range selector on the Outcome card — cumulative from the very beginning.
    expect(outcome).not.toContain("RANGES");
    expect(outcome).not.toContain("setRangeDays");
    expect(outcome).not.toContain("BarChart");
  });

  it("selects the cumulative outcome series by goal (clicks for visit-driven, replies for reply-driven)", () => {
    expect(section).toContain("isVisitDrivenGoal(optimizationGoal)");
    expect(section).toContain("pipelineActualSeries?.clicks");
    expect(section).toContain("pipelineActualSeries?.repliedPositive");
    expect(section).toContain('"Website clicks"');
    expect(section).toContain('"Positive replies"');
  });

  it("Outreach activity renders per-day stacked BARS, not an area/line chart", () => {
    expect(chart).toContain("BarChart");
    expect(chart).toContain("stackId={metric.key}");
    expect(chart).toContain("ExpectedRemaining");
    expect(chart).toContain("isAnimationActive={false}");
    // The #2121/#2124 line+cumulative version is fully replaced.
    expect(chart).not.toContain("AreaChart");
    expect(chart).not.toContain("selectedMetrics");
    expect(chart).not.toContain("toggleMetric");
    expect(chart).not.toContain("MAX_SELECTED_METRICS");
    expect(chart).not.toContain("cumulativeActuals");
  });

  it("activity bars carry the goal-specific metrics with positive replies for meetings", () => {
    for (const key of ["outreach", "clicks"]) {
      expect(chart).toContain(`key: "${key}"`);
    }
    expect(chart).toContain('key: "repliedPositive"');
    expect(chart).toContain('label: "Positive replies"');
    expect(chart).toContain("isVisitDrivenGoal(optimizationGoal)");
    expect(chart).toContain("POSITIVE_REPLIES");
    // No client-side salesMeetings projection anymore — the series is server-computed.
    expect(chart).not.toContain('label: "Sales meetings"');
    expect(chart).not.toContain("projectedMetric");
  });

  it("activity chart keeps the 7/30/90-day window toggle and forecast bars", () => {
    expect(chart).toContain("RANGES");
    expect(chart).toContain("setRangeDays");
    expect(chart).toContain("Past {days} days");
    expect(chart).toContain("h-[300px]");
    expect(chart).toContain("buildDailyCountMap");
    expect(chart).toContain("buildWindowDates");
    expect(chart).toContain("forecastExpected");
  });

  it("activity window clamps to the first data day and today reads as actual, not expected", () => {
    // New brand → no empty leading days; window left-edge clamps to firstDataDate.
    expect(chart).toContain("firstDataDate");
    expect(chart).toContain("buildWindowDates");
    // Hovering today shows ACTUAL so far (only future days read as "expected").
    expect(chart).toContain("const showActual = !day.isFuture");
    // Wider windows auto-scroll so today + forecast stay in view.
    expect(chart).toContain("el.scrollLeft = el.scrollWidth");
  });

  it("Outcome line extends past today with a dashed expected projection", () => {
    expect(outcome).toContain("projectedValue");
    expect(outcome).toContain('strokeDasharray="4 4"');
    expect(outcome).toContain("buildChartPoints");
    expect(section).toContain("outcomeFuture");
    expect(section).toContain("future={outcomeFuture}");
  });

  it("wires the repliedPositive series through view-model, parser, and page", () => {
    expect(revenueView).toContain("repliedPositive?: SignalSeries");
    expect(revenueParse).toContain("repliedPositive: SignalSeriesSchema.optional()");
    // features-service#416 rename: flatten prefers the new name, falls back to legacy.
    expect(revenueParse).toContain("repliedPositive: d.recipientsRepliesPositive ?? d.repliedPositive");
    expect(page).toContain("repliedPositive: data?.repliedPositive");
    expect(api).toContain('"repliedPositive"');
  });

  it("still computes the goal-specific expected monthly outcome for projections without showing it in the footer", () => {
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain('"overview-outcome"');
    expect(page).toContain("selectWorkflowForOptimizationGoal(outcomeProjection, optimizationGoal");
    expect(page).toContain("workflowOutcomeUnitCost(activeOutcomeWorkflow, optimizationGoal");
    expect(page).toContain("monthlyBudgetUsd / unitCost");
    expect(page).toContain("expectedMonthlyOutcome");
    expect(outcome).not.toContain("expected?:");
    expect(outcome).toContain("expected");
  });
});
