import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard mobile responsiveness", () => {
  const dashboardLayout = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx"),
    "utf-8",
  );
  const contextSidebar = fs.readFileSync(
    path.join(__dirname, "../src/components/context-sidebar.tsx"),
    "utf-8",
  );
  const tablePagination = fs.readFileSync(
    path.join(__dirname, "../src/components/table-pagination.tsx"),
    "utf-8",
  );
  const conversionsTable = fs.readFileSync(
    path.join(__dirname, "../src/components/revenue/conversions-table.tsx"),
    "utf-8",
  );
  const billingPage = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
    "utf-8",
  );
  const brandInfoPage = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"),
    "utf-8",
  );
  const settingsPage = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx"),
    "utf-8",
  );
  const brandStatusControl = fs.readFileSync(
    path.join(__dirname, "../src/components/brand/brand-status-control.tsx"),
    "utf-8",
  );
  const outletsPage = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx"),
    "utf-8",
  );

  it("keeps the dashboard shell from horizontal overflow", () => {
    expect(dashboardLayout).toContain("relative flex min-h-0 flex-1 overflow-hidden");
    expect(dashboardLayout).toContain("min-w-0 flex-1 overflow-y-auto");
    expect(contextSidebar).toContain("max-w-[85vw]");
    expect(contextSidebar).toContain("min-w-0 flex-1 truncate");
  });

  it("lets shared dashboard tables and pagers reflow on mobile", () => {
    expect(tablePagination).toContain("flex flex-col gap-3");
    expect(tablePagination).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(tablePagination).toContain("flex flex-wrap items-center gap-2");
    expect(conversionsTable).toContain("overflow-x-auto");
    expect(conversionsTable).toContain("min-w-[640px] w-full text-sm");
  });

  it("stacks billing controls instead of squeezing two-column forms", () => {
    expect(billingPage).toContain("flex max-w-2xl flex-col gap-3 sm:flex-row");
    // Add-credits presets wrap on narrow screens (no fixed multi-column grid to squeeze).
    expect(billingPage).toContain("flex flex-wrap gap-2 mb-4");
    expect(billingPage).toContain("w-full rounded-lg bg-brand-600");
  });

  it("keeps brand info and settings actions usable on narrow screens", () => {
    expect(brandInfoPage).toContain("mb-4 flex flex-col gap-3 sm:flex-row");
    expect(brandInfoPage).toContain("overflow-x-auto");
    expect(brandInfoPage).toContain("whitespace-nowrap");
    expect(settingsPage).toContain("<BrandStatusControl brandId={brandId} />");
    expect(settingsPage).toContain('<BrandDailyBudgetCard brandId={brandId} variant="section" />');
    expect(brandStatusControl).toContain("flex flex-wrap items-center justify-between gap-3");
    expect(brandStatusControl).toContain("flex items-center gap-3");
  });

  it("wraps outlet rows and bulk actions inside the viewport", () => {
    expect(outletsPage).toContain("flex w-full flex-wrap items-center");
    expect(outletsPage).toContain("ml-11 flex w-full flex-wrap");
    expect(outletsPage).toContain("relative flex h-full min-h-0");
    expect(outletsPage).toContain("flex w-full flex-col gap-2 sm:w-auto");
  });
});
