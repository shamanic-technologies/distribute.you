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

  it("fetches the locked pipeline-activity endpoint with brand, days, and timezone", () => {
    expect(api).toContain("getFeaturePipelineActivity");
    expect(api).toContain("/pipeline-activity?");
    expect(api).toContain('query.set("days", String(params.days))');
    expect(api).toContain('query.set("timezone", params.timezone)');
    expect(page).toContain('["featurePipelineActivity", brandId, featureSlug, timezone]');
    expect(page).toContain("days: 7");
  });

  it("replaces the revenue area chart with the 7-day activity bar chart", () => {
    expect(section).toContain("Pipeline activity next 7 days");
    expect(section).toContain("PipelineActivityChart");
    expect(section).toContain("expectedOutcome");
    expect(section).toContain("formatOutcomeCount");
    expect(section).not.toContain("expected pipeline</p>");
    expect(section).not.toContain("RevenueChart");
  });

  it("renders four metric bars and stacks actual with expected on the same metric bar", () => {
    for (const key of ["outreach", "opens", "clicks", "signups"]) {
      expect(chart).toContain(`key: "${key}"`);
      expect(chart).toContain(`stackId={metric.key}`);
    }
    expect(chart).toContain('key: "salesMeetings"');
    expect(chart).toContain('label: "Sales meetings"');
    expect(chart).toContain("Record<`${ChartMetricKey}Actual`, number>");
    expect(chart).toContain("Record<`${ChartMetricKey}ExpectedRemaining`, number>");
    expect(chart).toContain("dataKey={`${metric.key}Actual`}");
    expect(chart).toContain("dataKey={`${metric.key}ExpectedRemaining`}");
    expect(chart).toContain("Math.max(expected - actual, 0)");
    expect(chart).toContain("function visiblePointSize");
    expect(chart).toContain("minPointSize={visiblePointSize}");
    expect(chart).toContain("LabelList");
    expect(chart).toContain("renderBarLabel");
    expect(chart).toContain("value.conversionPct");
    expect(chart).toContain('stroke="#ffffff"');
    expect(chart).toContain('paintOrder="stroke"');
    expect(chart).toContain("isAnimationActive={false}");
  });

  it("switches the final outcome metric from signups to sales meetings from brand economics", () => {
    expect(page).toContain("DEFAULT_VISIT_TO_MEETING_PCT");
    expect(page).toContain("economicsData?.salesEconomics?.visitToMeetingPct");
    expect(page).toContain("pipelineActivity !== undefined");
    expect(page).toContain("economicsData !== undefined");
    expect(section).toContain("optimizationGoal");
    expect(section).toContain("visitToMeetingPct");
    expect(chart).toContain("type ChartMetricKey = PipelineActivityMetricKey | \"salesMeetings\"");
    expect(chart).toContain('if (optimizationGoal === "signups") return METRICS');
    expect(chart).toContain("projectedMetric(day.metrics.clicks, visitToMeetingPct)");
    expect(chart).toContain("source.actual * rate");
    expect(chart).toContain("source.expected * rate");
    expect(chart).toContain("isOutcomeMetric(metric.key)");
  });

  it("uses metric-color legend labels and reserves room for visible bar values", () => {
    expect(chart).toContain("{metric.label}");
    expect(chart).toContain('min-w-[1120px]');
    expect(chart).toContain('h-[300px]');
    expect(chart).toContain("maxBarSize={28}");
    expect(chart).toContain('barCategoryGap="18%"');
    expect(chart).toContain("margin={{ top: 36");
    expect(chart).not.toContain(">Actual<");
    expect(chart).not.toContain(">Expected<");
    expect(chart).not.toContain("Timezone:");
  });

  it("colors tooltip values by the rendered graph segment and shows today actuals only", () => {
    expect(chart).toContain("const color = day.isToday ? metric.actual : metric.expected;");
    expect(chart).toContain("const displayedValue = day.isToday ? value.actual : value.expected;");
    expect(chart).toContain("style={{ backgroundColor: color }}");
    expect(chart).toContain("{formatValue(displayedValue, metric.key)}");
    expect(chart).toContain("!day.isToday && isOutcomeMetric(metric.key)");
    expect(chart).not.toContain("`${formatValue(value.actual, metric.key)} / `");
  });

  it("labels today's stacked bars with actual values and future bars with expected values", () => {
    expect(chart).toContain("if (day.isToday)");
    expect(chart).toContain("if (renderedValue <= 0) return null;");
    expect(chart).toContain("{formatValue(actual, metricKey)}");
    expect(chart).toContain("if (!day.isToday || actual <= 0 || expectedRemaining > 0) return null;");
    expect(chart).toContain("{formatValue(expected, metricKey)}");
  });

  it("shows the goal-specific expected monthly outcome instead of pipeline revenue", () => {
    expect(page).toContain("getBrandDailyBudget");
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain('"overview-outcome"');
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
