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

  it("uses Website Visits / Cost per website visit with the requested tooltip for every goal", () => {
    expect(cards).toContain('label: "Website Visits"');
    expect(cards).toContain(
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    );
    expect(cards).toContain('costLabel: "Cost per website visit"');
    expect(cards).not.toContain('label: "Positive Replies"');
    expect(cards).not.toContain('costLabel: "CPPR"');
  });

  it("derives the outcome card from the goal-steps single source (no borrowed card for 1-step goals)", () => {
    // The per-goal outcome (Signups / Sales Meetings / Form submissions / Purchases, or
    // NONE for website_visits/positive_replies) comes from goalOutcomeStep — the component
    // no longer hardcodes a visit-vs-reply binary that mislabelled the newer goals.
    expect(cards).toContain("goalOutcomeStep");
    expect(cards).toContain("const outcomeStep = goalOutcomeStep(goal)");
    expect(cards).not.toContain("isVisitDrivenGoal");
  });

  it("renders the goal's outcome label + cost label from the step (not a hardcoded binary)", () => {
    expect(cards).toContain("label={outcomeStep.label}");
    expect(cards).toContain("label={outcome.costLabel}");
    expect(cards).not.toContain('label: "Sales"');
    expect(cards).not.toContain('costLabel: "CAC"');
  });

  it("renders the REAL server-provided tracker count for the outcome card, not a hardcoded dash", () => {
    // Count/cost come from the features-service /revenue spend block (real, tracker-sourced)
    // via the step's countField/costField, not the old hardcoded value="—".
    expect(cards).toContain("spend?.[outcome.countField]");
    expect(cards).toContain("spend?.[outcome.costField]");
    expect(cards).toContain("outcomeCount != null");
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
