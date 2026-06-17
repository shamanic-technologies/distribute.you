import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("OutreachStatCards goal-specific copy", () => {
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const auto = read("../src/components/revenue/outreach-stat-cards-auto.tsx");

  it("accepts the brand optimization goal instead of the old funnel-stage gate", () => {
    expect(cards).toContain("type { BrandOptimizationGoal }");
    expect(cards).toContain("optimizationGoal?: BrandOptimizationGoal");
    expect(cards).toContain('optimizationGoal ?? "sales"');
    expect(cards).not.toContain("funnelStages");
  });

  it("renames the always-visible acquisition cards to Outreach and Opens", () => {
    expect(cards).toContain('label="Outreach"');
    expect(cards).toContain("stats.leadsSent ?? stats.recipientsSent ?? 0");
    expect(cards).toContain('label="Opens"');
    expect(cards).toContain("stats.recipientsOpened ?? 0");
    expect(cards).not.toContain('label="Impressions"');
  });

  it("uses Clicks/CPC with the requested click tooltip for signup-style goals", () => {
    expect(cards).toContain('label: "Clicks"');
    expect(cards).toContain(
      "Number of visits on your website via a click in the link shared in the conversation with the lead.",
    );
    expect(cards).toContain('costLabel: "CPC"');
  });

  it("uses Positive Replies/CPPR for booked-meetings goals", () => {
    expect(cards).toContain('goal === "booked_meetings"');
    expect(cards).toContain('label: "Positive Replies"');
    expect(cards).toContain("stats.leadsRepliesPositive ?? 0");
    expect(cards).toContain('costLabel: "CPPR"');
    expect(cards).toContain("Cost per positive reply.");
  });

  it("shows the goal outcome beta pair for signups, booked meetings, and sales", () => {
    expect(cards).toContain('label: "Sales Meetings"');
    expect(cards).toContain('costLabel: "CPSM"');
    expect(cards).toContain("Cost per Sales Meetings.");
    expect(cards).toContain('label: "Signups"');
    expect(cards).toContain('costLabel: "CPS"');
    expect(cards).toContain('label: "Sales"');
    expect(cards).toContain('costLabel: "CAC"');
  });

  it("formats cost-per metrics with two decimal places", () => {
    expect(cards).toContain("minimumFractionDigits: 2");
    expect(cards).toContain("maximumFractionDigits: 2");
  });

  it("passes optimizationGoal from both overview call sites", () => {
    expect(page).toContain(
      'const optimizationGoal = economicsData?.salesEconomics?.optimizationGoal ?? "sales"',
    );
    expect(page).toContain("optimizationGoal={optimizationGoal}");
    expect(auto).toContain(
      'const optimizationGoal = economicsData?.salesEconomics?.optimizationGoal ?? "sales"',
    );
    expect(auto).toContain("optimizationGoal={optimizationGoal}");
  });
});
