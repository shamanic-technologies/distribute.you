import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchMetricsPath = path.resolve(
  __dirname,
  "../../src/lib/investors/fetch-metrics.ts"
);
const fetchMetrics = fs.readFileSync(fetchMetricsPath, "utf-8");

const pagePath = path.resolve(
  __dirname,
  "../../src/app/investors/page.tsx"
);
const page = fs.readFileSync(pagePath, "utf-8");

describe("Investor metrics: billing + runs aggregates", () => {
  describe("fetch-metrics.ts", () => {
    it("BillingStatsResponse includes monthlyGrowth array", () => {
      expect(fetchMetrics).toMatch(/interface BillingStatsResponse[\s\S]*?monthlyGrowth:/);
    });

    it("BillingStatsResponse includes weeklyGrowth array", () => {
      expect(fetchMetrics).toMatch(/interface BillingStatsResponse[\s\S]*?weeklyGrowth:/);
    });

    it("BillingStatsResponse includes snake_case total_revenue_cents", () => {
      expect(fetchMetrics).toMatch(/total_revenue_cents:\s*string/);
    });

    it("BillingStatsResponse does NOT reference dropped totalConsumedCents or totalCreditBalanceCents", () => {
      expect(fetchMetrics).not.toMatch(/totalConsumedCents/);
      expect(fetchMetrics).not.toMatch(/totalCreditBalanceCents/);
    });

    it("RunsStatsResponse includes totalCostInUsdCents top-level + per-month", () => {
      expect(fetchMetrics).toMatch(/interface RunsStatsResponse[\s\S]*?totalCostInUsdCents:\s*string/);
      expect(fetchMetrics).toMatch(/monthly:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
    });

    it("InvestorMetrics.billing exposes totalRevenueCents (drops totalConsumedCents / totalCreditBalanceCents)", () => {
      expect(fetchMetrics).toMatch(/totalRevenueCents:\s*string/);
      expect(fetchMetrics).not.toMatch(/totalConsumedCents:\s*string;\s*\n\s*\};/);
    });

    it("InvestorMetrics.runs exposes totalCostInUsdCents", () => {
      expect(fetchMetrics).toMatch(/runs:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
    });

    it("InvestorMetrics exposes weeklyGrowth", () => {
      expect(fetchMetrics).toMatch(/interface InvestorMetrics[\s\S]*?weeklyGrowth:/);
    });

    it("MonthlyRow includes creditedCents, consumedCents, revenueCents", () => {
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?creditedCents:/);
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?consumedCents:/);
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?revenueCents:/);
    });

    it("BillingGrowthRow cent fields are typed as decimal strings", () => {
      expect(fetchMetrics).toMatch(/credited_cents:\s*string/);
      expect(fetchMetrics).toMatch(/consumed_cents:\s*string/);
      expect(fetchMetrics).toMatch(/revenue_cents:\s*string/);
    });
  });

  describe("investors/page.tsx", () => {
    it("Revenue & Credits section renders Total Consumed and Revenue cards", () => {
      expect(page).toContain("Total Consumed");
      expect(page).toContain("Revenue");
      expect(page).toContain("metrics.runs.totalCostInUsdCents");
      expect(page).toContain("metrics.billing.totalRevenueCents");
    });

    it("does NOT render dropped Outstanding Balance / Credits Loaded cards", () => {
      expect(page).not.toContain("Outstanding Balance");
      expect(page).not.toContain("Total Credits Loaded");
    });

    it("Monthly Growth table has Credits Spent and Revenue columns", () => {
      expect(page).toContain("Credits Spent");
      expect(page).toContain("Revenue");
    });

    it("has a Weekly Growth section", () => {
      expect(page).toContain("Weekly Growth");
    });

    it("Weekly Growth table has period, Credits Loaded, Credits Spent, Revenue columns", () => {
      const weeklySection = page.slice(page.indexOf("Weekly Growth"));
      expect(weeklySection).toContain("Credits Loaded");
      expect(weeklySection).toContain("Credits Spent");
      expect(weeklySection).toContain("Revenue");
    });
  });
});
