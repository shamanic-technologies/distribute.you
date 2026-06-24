import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Brand overview pipeline activity chart", () => {
  const api = read("lib/api.ts");
  const page = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const section = read("components/revenue/revenue-overview-section.tsx");
  const chart = read("components/revenue/pipeline-activity-chart.tsx");

  it("fetches the locked pipeline-activity forecast endpoint with brand, days, and timezone", () => {
    expect(api).toContain("getFeaturePipelineActivity");
    expect(api).toContain("/pipeline-activity?");
    expect(api).toContain('query.set("days", String(params.days))');
    expect(api).toContain('query.set("timezone", params.timezone)');
    expect(page).toContain('["featurePipelineActivity", brandId, featureSlug, timezone]');
    expect(page).toContain("days: 7");
  });

  it("renders the Google Ads-style activity line chart with history plus forecast", () => {
    expect(section).toContain("Outreach activity");
    expect(section).toContain("PipelineActivityChart");
    expect(section).toContain("pipelineActualSeries");
    expect(section).toContain("expectedOutcome");
    expect(section).toContain("formatOutcomeCount");
    expect(section).not.toContain("expected pipeline</p>");
    expect(section).not.toContain("RevenueChart");
  });

  it("renders selectable metric cards and line/area series instead of stacked bars", () => {
    for (const key of ["outreach", "opens", "clicks", "signups"]) {
      expect(chart).toContain(`key: "${key}"`);
    }
    expect(chart).toContain('key: "salesMeetings"');
    expect(chart).toContain('label: "Sales meetings"');
    expect(chart).toContain("AreaChart");
    expect(chart).toContain("Area");
    expect(chart).toContain("Line");
    expect(chart).toContain("selectedMetrics");
    expect(chart).toContain("toggleMetric");
    expect(chart).toContain("MAX_SELECTED_METRICS");
    expect(chart).toContain('strokeDasharray="4 4"');
    expect(chart).toContain("linearGradient");
    expect(chart).not.toContain("BarChart");
    expect(chart).not.toContain("LabelList");
    expect(chart).not.toContain("stackId={metric.key}");
    expect(chart).toContain("isAnimationActive={false}");
  });

  it("switches the final outcome metric from signups to sales meetings from brand economics", () => {
    expect(page).toContain("DEFAULT_VISIT_TO_MEETING_PCT");
    expect(page).toContain("DEFAULT_VISIT_TO_SIGNUP_PCT");
    expect(page).toContain("economicsData?.salesEconomics?.visitToMeetingPct");
    expect(page).toContain("economicsData?.salesEconomics?.visitToSignupPct");
    expect(page).toContain("pipelineActivity !== undefined");
    expect(page).toContain("economicsData !== undefined");
    expect(section).toContain("optimizationGoal");
    expect(section).toContain("visitToMeetingPct");
    expect(section).toContain("visitToSignupPct");
    expect(chart).toContain("type ChartMetricKey = PipelineActivityMetricKey | \"salesMeetings\"");
    expect(chart).toContain('if (optimizationGoal === "signups") return METRICS');
    expect(chart).toContain("projectedMetric(baseMetrics.clicks, visitToSignupPct)");
    expect(chart).toContain("projectedMetric(baseMetrics.clicks, visitToMeetingPct)");
    expect(chart).toContain("isOutcomeMetric(metric)");
  });

  it("uses metric cards, range controls, and responsive chart dimensions", () => {
    expect(chart).toContain("{metric.label}");
    expect(chart).toContain("RANGES");
    expect(chart).toContain("setRangeDays");
    expect(chart).toContain("Past {days} days");
    expect(chart).toContain('h-[300px]');
    expect(chart).toContain("min-w-[760px]");
    expect(chart).toContain("margin={{ top: 20");
    expect(chart).not.toContain(">Actual<");
    expect(chart).not.toContain(">Expected<");
    expect(chart).not.toContain("Timezone:");
  });

  it("tooltip shows real actuals separately from forecast values", () => {
    expect(chart).toContain("Actual");
    expect(chart).toContain("Forecast");
    expect(chart).toContain("style={{ backgroundColor: color }}");
    expect(chart).toContain("formatValue(actualValue, metric.key)");
    expect(chart).toContain("formatValue(forecastValue, metric.key)");
    expect(chart).not.toContain("`${formatValue(value.actual, metric.key)} / `");
  });

  it("builds actual history from /revenue daily series and forecast from pipeline-activity", () => {
    expect(chart).toContain("pipelineActualSeries");
    expect(chart).toContain("buildDailyCountMap");
    expect(chart).toContain("buildPastDates");
    expect(chart).toContain("phase: \"actual\"");
    expect(chart).toContain("phase: \"forecast\"");
    expect(chart).toContain("forecastStartValue");
  });

  it("shows the goal-specific expected monthly outcome instead of pipeline revenue", () => {
    expect(page).toContain("getBrandDailyBudget");
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain('"overview-outcome"');
    expect(page).toContain('economicsData?.salesEconomics?.updatedAt ?? "no-economics"');
    expect(page).toContain("placeholderData: undefined");
    expect(page).toContain('objective: optimizationGoal === "signups" ? "self-serve" : "meeting-booked"');
    expect(page).toContain("selectWorkflowForOptimizationGoal(outcomeProjection, optimizationGoal");
    expect(page).toContain("workflowOutcomeUnitCost(activeOutcomeWorkflow, optimizationGoal");
    expect(page).toContain("replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct");
    expect(page).toContain("visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct");
    expect(page).toContain("monthlyBudgetUsd / unitCost");
    expect(page).not.toContain("activeOutcomeProjection?.meetings");
    expect(section).toContain("return Math.round(n).toLocaleString");
    expect(page).toContain('"expected signups / month"');
    expect(page).toContain('"expected sales meetings / month"');
  });
});
