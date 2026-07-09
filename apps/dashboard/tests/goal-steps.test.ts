import { describe, it, expect } from "vitest";
import {
  goalSteps,
  goalLeadTabs,
  goalChartMetricKeys,
  goalOutcomeStep,
  goalOutcomeTab,
} from "../src/lib/goal-steps";
import type { BrandOptimizationGoal } from "../src/lib/api";

const ALL_GOALS: BrandOptimizationGoal[] = [
  "signups",
  "sales_meetings",
  "website_visits",
  "positive_replies",
  "form_submissions",
  "purchase",
];

describe("goal-steps: Leads tabs (outcome-first, off-path dropped)", () => {
  const cases: Record<BrandOptimizationGoal, string[]> = {
    website_visits: ["clicks", "outreach"],
    signups: ["clicks", "outreach"],
    form_submissions: ["clicks", "outreach"],
    purchase: ["clicks", "outreach"],
    positive_replies: ["positive-replies", "outreach"],
    sales_meetings: ["positive-replies", "clicks", "outreach"],
  };
  for (const goal of ALL_GOALS) {
    it(`${goal} → ${cases[goal].join(" · ")}`, () => {
      expect(goalLeadTabs(goal)).toEqual(cases[goal]);
    });
  }

  it("Outreach is always the last (rightmost) tab", () => {
    for (const goal of ALL_GOALS) {
      const tabs = goalLeadTabs(goal);
      expect(tabs[tabs.length - 1]).toBe("outreach");
    }
  });

  it("never shows an off-funnel signal tab (visit goals hide Positive replies; reply-only goal hides Website Visits)", () => {
    expect(goalLeadTabs("website_visits")).not.toContain("positive-replies");
    expect(goalLeadTabs("signups")).not.toContain("positive-replies");
    expect(goalLeadTabs("positive_replies")).not.toContain("clicks");
  });
});

describe("goal-steps: activity-chart metrics (base→outcome)", () => {
  it("visit-driven goals plot Outreach + Website Visits", () => {
    for (const goal of ["website_visits", "signups", "purchase"] as const) {
      expect(goalChartMetricKeys(goal)).toEqual(["outreach", "clicks"]);
    }
  });
  it("form_submissions also plots its Form-submissions bar (features serves the daily series)", () => {
    expect(goalChartMetricKeys("form_submissions")).toEqual([
      "outreach",
      "clicks",
      "formSubmissions",
    ]);
  });
  it("positive_replies plots Outreach + Positive replies", () => {
    expect(goalChartMetricKeys("positive_replies")).toEqual(["outreach", "repliedPositive"]);
  });
  it("sales_meetings plots BOTH clicks and positive replies (its full path)", () => {
    expect(goalChartMetricKeys("sales_meetings")).toEqual([
      "outreach",
      "clicks",
      "repliedPositive",
    ]);
  });
});

describe("goal-steps: stat-card outcome step", () => {
  it("1-step goals (visit/reply IS the outcome) have no separate outcome card", () => {
    expect(goalOutcomeStep("website_visits")).toBeNull();
    expect(goalOutcomeStep("positive_replies")).toBeNull();
  });
  it("multi-step goals bind the correct aggregate count/cost fields", () => {
    expect(goalOutcomeStep("signups")?.outcome).toMatchObject({
      countField: "signupsCount",
      costField: "cpsCents",
      costLabel: "CPS",
    });
    expect(goalOutcomeStep("sales_meetings")?.outcome).toMatchObject({
      countField: "salesMeetingsCount",
      costField: "cpsmCents",
      costLabel: "CPSM",
    });
    expect(goalOutcomeStep("form_submissions")?.outcome).toMatchObject({
      countField: "formSubmissionsCount",
      costField: "cpfsCents",
      costLabel: "CPFS",
    });
  });
  it("purchase binds its aggregate count/cost (features-service#476)", () => {
    const step = goalOutcomeStep("purchase");
    expect(step?.label).toBe("Purchases");
    expect(step?.outcome?.countField).toBe("purchasesCount");
    expect(step?.outcome?.costField).toBe("cppCents");
  });
});

describe("goal-steps: realized-outcome Leads tab (per-lead #476)", () => {
  it("1-step goals have no separate outcome tab (visit/reply IS the outcome tab)", () => {
    expect(goalOutcomeTab("website_visits")).toBeNull();
    expect(goalOutcomeTab("positive_replies")).toBeNull();
  });
  it("multi-step goals map the outcome tab to the correct per-lead field + timestamp", () => {
    expect(goalOutcomeTab("signups")).toEqual({
      tab: "signups",
      label: "Signups",
      leadField: "signup",
      dateField: "signupAt",
    });
    expect(goalOutcomeTab("sales_meetings")).toEqual({
      tab: "meetings",
      label: "Sales Meetings",
      leadField: "meetingBooked",
      dateField: "meetingBookedAt",
    });
    expect(goalOutcomeTab("form_submissions")).toEqual({
      tab: "form-submissions",
      label: "Form submissions",
      leadField: "formSubmission",
      dateField: "formSubmissionAt",
    });
    expect(goalOutcomeTab("purchase")).toEqual({
      tab: "purchases",
      label: "Purchases",
      leadField: "purchased",
      dateField: "purchasedAt",
    });
  });
});

describe("goal-steps: every goal is exhaustively wired (no half-wired goal)", () => {
  for (const goal of ALL_GOALS) {
    it(`${goal} yields ≥2 ordered steps starting at Outreach`, () => {
      const steps = goalSteps(goal);
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps[0].key).toBe("outreach");
    });
  }
});
