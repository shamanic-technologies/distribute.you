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
const dataSectionsPath = path.resolve(
  __dirname,
  "../../src/components/investors/data-sections.tsx"
);
const page = fs.readFileSync(pagePath, "utf-8");
const dataSections = fs.existsSync(dataSectionsPath)
  ? fs.readFileSync(dataSectionsPath, "utf-8")
  : "";
// Investor surface is split between page.tsx (shell) and data-sections.tsx (data).
// Tests target the union of both files since either may host a given string.
const surface = `${page}\n${dataSections}`;

describe("Investor metrics: billing + runs aggregates", () => {
  describe("fetch-metrics.ts", () => {
    it("BillingStatsResponse uses snake_case shape (billing-service v3 wire)", () => {
      expect(fetchMetrics).toMatch(/total_accounts:\s*number/);
      expect(fetchMetrics).toMatch(/accounts_with_payment_method:\s*number/);
      expect(fetchMetrics).toMatch(/total_credited_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_revenue_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_paid_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_local_credits_cents:\s*string/);
      expect(fetchMetrics).toMatch(/monthly_growth:/);
      expect(fetchMetrics).toMatch(/weekly_growth:/);
    });

    it("BillingStatsResponse does NOT keep camelCase or dropped fields", () => {
      expect(fetchMetrics).not.toMatch(/totalCreditBalanceCents/);
      expect(fetchMetrics).not.toMatch(/totalConsumedCents/);
      expect(fetchMetrics).not.toMatch(/monthlyGrowth:\s*BillingGrowthRow/);
    });

    it("BillingGrowthRow drops consumed_cents (no longer on wire)", () => {
      const block = fetchMetrics.match(/interface BillingGrowthRow[\s\S]*?\}/);
      expect(block).toBeTruthy();
      expect(block?.[0]).not.toContain("consumed_cents");
      expect(block?.[0]).toContain("credited_cents");
      expect(block?.[0]).toContain("revenue_cents");
    });

    it("RunsStatsResponse includes monthly + weekly buckets", () => {
      expect(fetchMetrics).toMatch(/interface RunsStatsResponse[\s\S]*?totalCostInUsdCents:\s*string/);
      expect(fetchMetrics).toMatch(/monthly:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
      expect(fetchMetrics).toMatch(/weekly:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
    });

    it("WeeklyRow includes period, creditedCents, consumedCents, revenueCents (camelCase)", () => {
      expect(fetchMetrics).toMatch(/interface WeeklyRow[\s\S]*?period:\s*string/);
      expect(fetchMetrics).toMatch(/interface WeeklyRow[\s\S]*?creditedCents:\s*string/);
      expect(fetchMetrics).toMatch(/interface WeeklyRow[\s\S]*?consumedCents:\s*string/);
      expect(fetchMetrics).toMatch(/interface WeeklyRow[\s\S]*?revenueCents:\s*string/);
    });

    it("InvestorMetrics.billing exposes totalRevenueCents + totalCreditedCents", () => {
      expect(fetchMetrics).toMatch(/totalRevenueCents:\s*string/);
      expect(fetchMetrics).toMatch(/totalCreditedCents:\s*string/);
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
  });

  describe("investors surface (page.tsx + data-sections.tsx)", () => {
    it("Revenue & Credits section renders Total Consumed and Revenue cards", () => {
      expect(surface).toContain("Total Consumed");
      expect(surface).toContain("Revenue");
      expect(surface).toContain("metrics.runs.totalCostInUsdCents");
      expect(surface).toContain("metrics.billing.totalRevenueCents");
    });

    it("does NOT render dropped Outstanding Balance / Credits Loaded cards", () => {
      expect(surface).not.toContain("Outstanding Balance");
      expect(surface).not.toContain("Total Credits Loaded");
    });

    it("Monthly Growth table has Credits Spent and Revenue columns", () => {
      expect(surface).toContain("Credits Spent");
      expect(surface).toContain("Revenue");
    });

    it("Monthly Growth table does NOT render dropped New Orgs / New Users columns", () => {
      expect(surface).not.toContain(">New Orgs<");
      expect(surface).not.toContain(">New Users<");
    });

    it("Monthly Growth section exposes both Credits Spent and Revenue growth cards", () => {
      expect(surface).toContain("Monthly credits spent growth");
      expect(surface).toContain("Monthly revenue growth");
    });

    it("Monthly Growth section renders both Credits Spent and Revenue bar charts", () => {
      const monthlyFn = dataSections.slice(
        dataSections.indexOf("function MonthlyGrowthSection"),
        dataSections.indexOf("function WeeklyGrowthSection")
      );
      expect(monthlyFn).toMatch(/BarChart[\s\S]*?title="Credits Spent"/);
      expect(monthlyFn).toMatch(/BarChart[\s\S]*?title="Revenue"/);
    });

    it("has a Weekly Growth section", () => {
      expect(surface).toContain("Weekly Growth");
    });

    it("Weekly Growth section renders Credits Spent + Revenue columns", () => {
      const weeklySection = surface.slice(surface.indexOf("Weekly Growth"));
      expect(weeklySection).toContain("Credits Spent");
      expect(weeklySection).toContain("Revenue");
      expect(weeklySection).not.toContain("Credits Loaded");
    });

    it("Weekly Growth section exposes both Credits Spent and Revenue growth cards", () => {
      expect(surface).toContain("Weekly credits spent growth");
      expect(surface).toContain("Weekly revenue growth");
    });

    it("Weekly Growth cards mention they are baselined since March", () => {
      const weeklyFn = dataSections.slice(dataSections.indexOf("function WeeklyGrowthSection"));
      expect(weeklyFn).toMatch(/sub="Since March"/);
    });

    it("Weekly CAGR is computed over rows from 2026-03-02 onwards (sub-dollar Feb noise excluded)", () => {
      const weeklyFn = dataSections.slice(dataSections.indexOf("function WeeklyGrowthSection"));
      expect(weeklyFn).toMatch(/period\s*>=\s*WEEKLY_CAGR_START/);
      expect(dataSections).toMatch(/WEEKLY_CAGR_START\s*=\s*"2026-03-02"/);
    });

    it("Weekly Growth section renders both Credits Spent and Revenue bar charts", () => {
      const weeklyFn = dataSections.slice(dataSections.indexOf("function WeeklyGrowthSection"));
      expect(weeklyFn).toMatch(/BarChart[\s\S]*?title="Credits Spent"/);
      expect(weeklyFn).toMatch(/BarChart[\s\S]*?title="Revenue"/);
    });
  });
});
