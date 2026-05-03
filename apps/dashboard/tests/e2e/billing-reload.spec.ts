import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run dashboard billing E2E tests.`);
  }
  return value;
}

async function mockDashboardApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/features") {
      await route.fulfill({ json: { features: [] } });
      return;
    }

    if (path === "/features/stats/registry" || path === "/features/entities/registry") {
      await route.fulfill({ json: { registry: {} } });
      return;
    }

    if (path === "/billing/accounts") {
      await route.fulfill({
        json: {
          creditBalanceCents: 2,
          currency: "usd",
          hasPaymentMethod: true,
          hasAutoReload: true,
          reloadAmountCents: 2500,
          reloadThresholdCents: 500,
        },
      });
      return;
    }

    if (path === "/billing/accounts/transactions") {
      await route.fulfill({ json: { transactions: [], has_more: false } });
      return;
    }

    if (path === "/activity" || path === "/emails/send") {
      await route.fulfill({ json: { ok: true } });
      return;
    }

    await route.fulfill({
      status: 500,
      json: { error: `Unhandled E2E API route: ${path}` },
    });
  });
}

test.describe("Billing reload", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await mockDashboardApi(page);
  });

  test("opens the credit reload modal from the billing header", async ({ page }) => {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(`/orgs/${orgId}/billing`);

    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    const reloadButton = page.getByRole("button", { name: "Reload Credits" });
    await expect(reloadButton).toBeVisible();

    await reloadButton.click();

    await expect(page.getByRole("heading", { name: "Insufficient Credits" })).toBeVisible();
    await expect(page.getByText("Add Credits")).toBeVisible();
    await expect(page.getByLabel("Enable auto-reload")).toBeChecked();
    await expect(page.getByText("Reload amount ($)")).toBeVisible();
  });
});
