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
    // Single-step reply→paid goal: Website Visits + CPC cards are hidden, and the unified
    // outcome card becomes Positive Replies + Cost per positive reply (GA, no beta badge,
    // no conversion-tracker CTA — reply attribution is inbox-sourced).
    expect(cards).toContain('const isPositiveReplies = goal === "positive_replies"');
    expect(cards).toContain("{!isPositiveReplies && (");
    expect(cards).toContain('label: "Positive Replies"');
    expect(cards).toContain('costLabel: "Cost per positive reply"');
    expect(cards).toContain("formatCount(spend.positiveRepliesCount)");
    expect(cards).toContain("formatCostCents(spend?.cpprCents)");
    // GA outcome — the reply card carries no beta badge and no setup CTA.
    expect(cards).toContain("showAction: false");
    // CPPR abbreviation is not used as a card label here (full phrase instead).
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
    // The multi-step outcome card sources its label/cost-label from the goal-steps step.
    expect(cards).toContain("label: outcomeStep.label");
    expect(cards).toContain("costLabel: outcome.costLabel");
    // The render reads them off the unified outcome card.
    expect(cards).toContain("label={outcomeCard.label}");
    expect(cards).toContain("label={outcomeCard.costLabel}");
    expect(cards).not.toContain('label: "Sales"');
    expect(cards).not.toContain('costLabel: "CAC"');
  });

  it("binds the Form submissions/CPFS outcome for the form_submissions goal via the goal-steps source", () => {
    // The form_submissions outcome (label + count/cost fields) now lives in the
    // goal-steps single source, not a hardcoded branch in the component. The card
    // renders it through goalOutcomeStep like every other goal.
    const steps = read("../src/lib/goal-steps.ts");
    expect(steps).toContain('label: "Form submissions"');
    expect(steps).toContain('countField: "formSubmissionsCount"');
    expect(steps).toContain('costField: "cpfsCents"');
    expect(steps).toContain('costLabel: "CPFS"');
  });

  it("renders the REAL server-provided tracker count for the outcome card, not a hardcoded dash", () => {
    // Count/cost come from the features-service /revenue spend block (real, tracker-sourced)
    // via the step's countField/costField, not the old hardcoded value="—".
    expect(cards).toContain("spend?.[outcome.countField]");
    expect(cards).toContain("spend?.[outcome.costField]");
    expect(cards).toContain("outcomeCount != null");
    expect(cards).toContain("value={outcomeCard.countValue}");
    // No projection language on the cost tooltips.
    expect(cards).not.toContain("Coming soon");
  });

  it("formats cost-per metrics adaptively (<$10 keeps cents, ≥$10 whole)", () => {
    expect(cards).toContain("Math.abs(usd) < 10 ? 2 : 0");
    expect(cards).toContain("minimumFractionDigits: decimals");
    expect(cards).toContain("maximumFractionDigits: decimals");
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
