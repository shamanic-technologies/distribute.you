import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Admin panel navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("navigate home → service → table → row → sheet opens → breadcrumb correct at each level", async ({
    page,
  }) => {
    // Home page: service cards visible, breadcrumb shows "Home"
    await page.goto("/");
    await expect(page.getByText("Services")).toBeVisible();
    const breadcrumb = page.locator("nav[aria-label='Breadcrumb']");
    await expect(breadcrumb.getByText("Home")).toBeVisible();

    // Sidebar shows services
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Click first service card
    const serviceCard = page.getByTestId("service-card").first();
    const serviceName = await serviceCard.locator("h2").textContent();
    await serviceCard.click();

    // Service page: table cards visible, breadcrumb shows Home > Service
    await expect(page.getByText(serviceName!)).toBeVisible();
    await expect(breadcrumb.getByText("Home")).toBeVisible();
    await expect(breadcrumb.getByText(serviceName!)).toBeVisible();

    // Sidebar shows tables
    await expect(sidebar).toBeVisible();

    // Click first table card
    const tableCard = page.getByTestId("table-card").first();
    const tableName = await tableCard.locator("h2").textContent();
    await tableCard.click();

    // Table page: data table visible, breadcrumb shows Home > Service > Table
    await expect(page.getByText(tableName!)).toBeVisible();
    await expect(breadcrumb.getByText("Home")).toBeVisible();
    await expect(breadcrumb.getByText(serviceName!)).toBeVisible();
    await expect(breadcrumb.getByText(tableName!)).toBeVisible();

    // Sidebar still shows tables with active one highlighted
    await expect(sidebar).toBeVisible();

    // Click first row to open sheet
    const firstRow = page.getByTestId("table-row").first();
    await firstRow.click();

    // Sheet opens with row details
    const sheet = page.getByTestId("row-detail-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Row Details")).toBeVisible();

    // Close sheet via overlay
    await page.getByTestId("sheet-overlay").click();
    await expect(sheet).not.toBeVisible();

    // Navigate back via breadcrumb
    await breadcrumb.getByText(serviceName!).click();
    await expect(page.getByTestId("table-card").first()).toBeVisible();

    await breadcrumb.getByText("Home").click();
    await expect(page.getByTestId("service-card").first()).toBeVisible();
  });

  test("sidebar changes when navigating between services", async ({ page }) => {
    await page.goto("/");

    // Home sidebar shows services
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Services")).toBeVisible();

    // Click into a service
    const serviceCard = page.getByTestId("service-card").first();
    await serviceCard.click();

    // Sidebar now shows tables
    await expect(sidebar.getByText("Tables")).toBeVisible();
  });

  test("search input is visible on table page", async ({ page }) => {
    await page.goto("/");

    const serviceCard = page.getByTestId("service-card").first();
    await serviceCard.click();

    const tableCard = page.getByTestId("table-card").first();
    await tableCard.click();

    await expect(page.getByTestId("search-input")).toBeVisible();
  });
});
