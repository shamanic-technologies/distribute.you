import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const deprecatedStageField = "funnel" + "Stages";

describe("OutreachStatCards copy", () => {
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const auto = read("../src/components/revenue/outreach-stat-cards-auto.tsx");

  it("accepts the brand optimization goal instead of the old funnel-stage gate", () => {
    expect(cards).toContain("type { BrandOptimizationGoal }");
    expect(cards).toContain("optimizationGoal?: BrandOptimizationGoal");
    expect(cards).toContain('optimizationGoal ?? "sales_meetings"');
    expect(cards).not.toContain(deprecatedStageField);
  });

  it("renames the always-visible acquisition card to Outreach (opens removed)", () => {
    expect(cards).toContain('label="Outreach"');
    expect(cards).toContain(
      "stats.leadsContacted ?? stats.recipientsContacted ?? 0",
    );
    expect(cards).not.toContain('label="Opens"');
    expect(cards).not.toContain("recipientsOpened");
    expect(cards).not.toContain('label="Impressions"');
  });

  it("uses Website Visits / Cost per website visit with the requested tooltip", () => {
    expect(cards).toContain('label: "Website Visits"');
    expect(cards).toContain(
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    );
    expect(cards).toContain('costLabel: "Cost per website visit"');
  });

  it("hides the click cards and shows the Positive Replies outcome for positive_replies", () => {
    // Single-step reply→paid goal: Website Visits + CPC cards are hidden, and the outcome
    // pair becomes Positive Replies + Cost per positive reply (GA, no beta badge, no setup CTA).
    expect(cards).toContain('const isPositiveReplies = goal === "positive_replies"');
    expect(cards).toContain("{!isPositiveReplies && (");
    expect(cards).toContain('label: "Positive Replies"');
    expect(cards).toContain('costLabel: "Cost per positive reply"');
    expect(cards).toContain("count: spend?.positiveRepliesCount");
    expect(cards).toContain("formatCostCents(spend?.cpprCents)");
    expect(cards).toContain("isPositiveReplies ? undefined : beta");
    // CPPR abbreviation is not used as a card label here (full phrase instead).
    expect(cards).not.toContain('costLabel: "CPPR"');
  });

  it("drops the borrowed Signups/CPS outcome card when the goal is website_visits", () => {
    expect(cards).toContain('goal !== "website_visits"');
  });

  it("shows the goal outcome beta pair for signups and sales meetings", () => {
    expect(cards).toContain('label: "Sales Meetings"');
    expect(cards).toContain('costLabel: "CPSM"');
    expect(cards).toContain('label: "Signups"');
    expect(cards).toContain('costLabel: "CPS"');
    expect(cards).not.toContain('label: "Sales"');
    expect(cards).not.toContain('costLabel: "CAC"');
  });

  it("shows the Form submissions/CPFS outcome pair for the form_submissions goal", () => {
    expect(cards).toContain('goal === "form_submissions"');
    expect(cards).toContain('label: "Form submissions"');
    expect(cards).toContain('costLabel: "CPFS"');
    expect(cards).toContain("count: spend?.formSubmissionsCount");
    expect(cards).toContain("spend?.cpfsCents");
  });

  it("renders the REAL server-provided tracker count for the outcome card, not a hardcoded dash", () => {
    // Count comes from the features-service /revenue spend block (real, tracker-sourced),
    // not the old hardcoded value="—".
    expect(cards).toContain("count: spend?.signupsCount");
    expect(cards).toContain("count: spend?.salesMeetingsCount");
    expect(cards).toContain("outcomeMetric.count != null");
    expect(cards).toContain("value={outcomeCountValue}");
    // No projection language on the cost tooltips.
    expect(cards).not.toContain("Coming soon");
  });

  it("formats cost-per metrics with two decimal places", () => {
    expect(cards).toContain("minimumFractionDigits: 2");
    expect(cards).toContain("maximumFractionDigits: 2");
  });

  it("passes optimizationGoal from both overview call sites", () => {
    expect(page).toContain(
      'economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings"',
    );
    expect(page).toContain("optimizationGoal={optimizationGoal}");
    expect(auto).toContain(
      'economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings"',
    );
    expect(auto).toContain("optimizationGoal={optimizationGoal}");
  });
});
