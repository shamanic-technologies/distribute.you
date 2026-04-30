import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Admin pages load", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("home page shows service cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Services")).toBeVisible();
    await expect(page.getByTestId("service-card").first()).toBeVisible();
  });

  test("/apollo-service shows table cards", async ({ page }) => {
    await page.goto("/apollo-service");
    await expect(page.getByText("apollo-service")).toBeVisible();
    await expect(page.getByTestId("table-card").first()).toBeVisible();
  });

  test("unknown service shows error boundary", async ({ page }) => {
    await page.goto("/nonexistent-service-xyz");
    await expect(page.getByText("Failed to load service")).toBeVisible();
  });
});
