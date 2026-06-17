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
    expect(chart).toContain("Record<`${PipelineActivityMetricKey}Actual`, number>");
    expect(chart).toContain("Record<`${PipelineActivityMetricKey}ExpectedRemaining`, number>");
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

  it("shows the goal-specific expected monthly outcome instead of pipeline revenue", () => {
    expect(page).toContain("getBrandDailyBudget");
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain('"overview-outcome"');
    expect(page).toContain('objective: optimizationGoal === "signups" ? "self-serve" : "meeting-booked"');
    expect(page).toContain("visits * (visitToSignupPct / 100)");
    expect(page).toContain("activeOutcomeProjection?.meetings");
    expect(page).toContain('"expected signups / month"');
    expect(page).toContain('"expected sales meetings / month"');
  });
});
