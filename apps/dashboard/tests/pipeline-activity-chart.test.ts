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
  const roiTrend = read("components/revenue/roi-trend-card.tsx");
  const revenueView = read("lib/revenue-view.ts");
  const revenueParse = read("lib/revenue-parse.ts");

  // A percentage height resolves against nothing on the first layout pass of a
  // stretched grid item, so the two cards whose chart wrapper is `flex-1` measure 0
  // and recharts logs `width(-1) and height(-1) ... should be greater than 0`. The
  // floor it asks for in that same message is the fix, and it is the wrapper's own
  // `min-h-[180px]`, so the settled layout is unchanged. The outreach-activity chart
  // is deliberately NOT in this list: its wrapper is `h-[300px] lg:h-[200px]`, a
  // definite height, so it never had the problem and needs no floor.
  it("floors the two percentage-height charts so recharts can measure them", () => {
    for (const src of [outcome, roiTrend]) {
      expect(src).toContain('<ResponsiveContainer width="100%" height="100%" minHeight={180}>');
    }
    expect(chart).toContain('<ResponsiveContainer width="100%" height="100%">');
  });

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

  // features-service buckets a day only when a lead first carried the signal on it,
  // so a quiet week is ABSENT from `daily`. On a category x-axis every present day
  // takes the same width, so two consecutive days and a three-week gap render
  // identically and the dates read as unevenly spaced — and the cumulative line
  // climbs diagonally across days on which nothing happened.
  it("fills the missing days at zero so one day is one step on the x-axis", () => {
    expect(outcome).toContain("fillMissingDays");
    expect(outcome).toContain("count: 0");
    const at = outcome.indexOf("function buildCumulative");
    expect(outcome.slice(at, at + 300)).toContain("fillMissingDays(");
    // The quiet stretch between the last outcome and the first forecast day is a gap
    // like any other, so the fill runs up to the day before the dashed segment starts.
    expect(outcome).toContain("previousDay(firstFuture)");
  });

  it("selects the cumulative outcome series by goal (clicks for visit-driven, replies for reply-driven)", () => {
    expect(section).toContain("isVisitDrivenGoal(optimizationGoal)");
    expect(section).toContain("pipelineActualSeries?.clicks");
    expect(section).toContain("pipelineActualSeries?.repliedPositive");
    expect(section).toContain('"Website visits"');
    expect(section).toContain('"Sales interests"');
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

  it("activity bars carry the goal-specific metrics with sales interests for meetings", () => {
    for (const key of ["outreach", "clicks"]) {
      expect(chart).toContain(`key: "${key}"`);
    }
    expect(chart).toContain('key: "repliedPositive"');
    expect(chart).toContain('label: "Sales interests"');
    // Metrics come from the goal-steps single source (sales_meetings shows BOTH
    // clicks and sales interests — its full click→reply→meeting path), keyed on the
    // campaign's own funnel when the surface states one.
    expect(chart).toContain("chartMetricKeysFor(optimizationGoal, funnelKey)");
    expect(chart).toContain("POSITIVE_REPLIES");
    expect(chart).not.toContain("isVisitDrivenGoal");
    // No client-side salesMeetings projection anymore — the series is server-computed.
    expect(chart).not.toContain('label: "Sales meetings"');
    expect(chart).not.toContain("projectedMetric");
  });

  it("the outreach bar is labelled for what it counts: leads launched, not emails sent", () => {
    // The bar counts sequences launched on the day. A brand sending hundreds of
    // emails from its queue while launching no new lead reads 0 here, which under
    // the old "Outreach" label was reported as "no email sent today".
    expect(chart).toContain('label: "New leads contacted"');
    expect(chart).not.toContain('label: "Outreach"');
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

  it("hides tracker-outcome bars (Form submissions) until the conversion tracker is live (#2646)", () => {
    const goalSteps = read("lib/goal-steps.ts");
    // Derived set of chart keys sourced from an outcome step (tracker-dependent).
    expect(goalSteps).toContain("TRACKER_DEPENDENT_CHART_KEYS");
    // Chart filters those keys out unless the tracker is set up.
    expect(chart).toContain("TRACKER_DEPENDENT_CHART_KEYS");
    expect(chart).toContain("trackerSetUp || !TRACKER_DEPENDENT_CHART_KEYS.has(k)");
    // Defaults to hidden so an unresolved query never flashes an empty bar.
    expect(chart).toContain("trackerSetUp = false");
    // Section threads the flag to the chart.
    expect(section).toContain("trackerSetUp={trackerSetUp}");
    // Page derives it from the shared conversion-token query (live / live_waiting).
    expect(page).toContain('["brandConversionToken", brandId]');
    expect(page).toContain('conversionTokenData?.status === "live"');
    expect(page).toContain('conversionTokenData?.status === "live_waiting"');
    expect(page).toContain("trackerSetUp={trackerSetUp}");
  });

  // The brand Overview no longer resolves a workflow at all. That query answered "how
  // many of the GOAL's outcome does this budget buy", and a brand has no goal — it runs
  // several funnels at once, so the objective came off the retired, server-defaulted
  // brand column. Its two consumers are gone with it: the Outcome line's dashed forecast
  // (the Return-on-spend chart replaced that card here) and a spend cap that priced the
  // reassurance banner's learning window in that goal's outcome.
  //
  // The CAMPAIGN Overview still resolves one, correctly: it sells exactly one funnel.
  it("resolves no workflow at brand level, since a brand has no goal to resolve one for", () => {
    expect(page).not.toContain("getWorkflowProjection");
    expect(page).not.toContain('"overview-outcome"');
    expect(page).not.toContain("selectWorkflowForOptimizationGoal");
    expect(page).not.toContain("expectedMonthlyOutcome");
    // The Outcome card itself is unchanged — the campaign Overview still renders it.
    expect(outcome).not.toContain("expected?:");
    expect(outcome).toContain("expected");
  });
});

describe("the campaign Outcome chart reads the brand's tertiary", () => {
  const outcome = read("components/revenue/outcome-trend-card.tsx");
  const css = read("app/globals.css");

  it("draws its line, its fill and its hovered dot in orange, never the primary", () => {
    // This card only ever renders at CAMPAIGN grain (the brand and offer Overviews
    // draw Return-on-spend instead), and a campaign's surfaces read in the charter's
    // tertiary. `text-brand-600` here would put the primary on a page whose tag,
    // band and marks are all tertiary.
    expect(outcome).not.toContain("text-brand-600");
    expect(outcome).toContain("text-orange-600");
  });

  it("opts into the brand-hue rotation, or it stays OUR orange on a tinted brand", () => {
    // An SVG `stroke`/`fill` attribute is not reached by any utility remap, so the
    // colour rides `currentColor` off a class — and that class only rotates under a
    // `tone-tile` ancestor. Scoped to the chart wrapper, not the card, so the white
    // surface and the grey chrome above it are untouched.
    expect(outcome).toContain('className="tone-tile flex-1 min-h-[180px]"');
    expect(outcome).toContain('stroke="currentColor"');
    expect(css).toContain(":root[data-brand-tint] .tone-tile .text-orange-600");
  });
});
